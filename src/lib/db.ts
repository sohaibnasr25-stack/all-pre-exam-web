import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AcademicYear,
  Module,
  Subject,
  Chapter,
  Concept,
  Exam,
  Question,
  AnswerChoice,
  ExplanationItem,
  ExamQuestion,
  Bookmark,
  StudentAttempt,
  StudentAnswer,
  RepeatedConceptStat,
  WeaknessMetric,
  AdminUser,
} from './types';
import { getStorageConfig, getStorageMode, setStorageMode, recordLastSync, StorageMode } from './storageConfig';

export { getStorageConfig, getStorageMode, setStorageMode, recordLastSync };
export type { StorageMode, AdminUser };

// Detect Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.warn('Could not initialize Supabase client:', err);
  }
}

export { supabase };

/**
 * Checks if Supabase should be queried.
 * Respects user's active StorageMode ('local_only' disables Supabase calls completely for max speed/offline resilience).
 */
export function shouldQuerySupabase(): boolean {
  if (!supabase) return false;
  return getStorageMode() !== 'local_only';
}

/**
 * Wraps Supabase queries with a strict timeout (default 2500ms).
 * If connection is slow, weak, or dropped, it times out immediately and returns null,
 * triggering an instant and seamless failover to the local JSON database without blocking the UI.
 */
export async function safeSupabaseCall<T>(call: () => Promise<T>, timeoutMs = 2500): Promise<T | null> {
  if (!shouldQuerySupabase()) return null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timed out')), timeoutMs)
    );
    return await Promise.race([call(), timeoutPromise]);
  } catch (err) {
    console.warn('[Storage Failover] Supabase timed out or encountered an error; seamlessly falling back to Local DB:', (err as Error).message);
    return null;
  }
}

// In-memory store cache for serverless environments (prevents EROFS read-only crashes on Vercel)
let inMemoryStore: DatabaseStore | null = null;

function getDbStoragePaths() {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );
  const localDataDir = path.join(process.cwd(), 'data');
  const tmpDataDir = path.join(os.tmpdir(), 'omnimed_data');
  const activeDataDir = isServerless ? tmpDataDir : localDataDir;
  const activeDbFile = path.join(activeDataDir, 'db.json');
  const bundledDbFile = path.join(localDataDir, 'db.json');
  return { isServerless, activeDataDir, activeDbFile, bundledDbFile };
}

function ensureDbDir(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}

export interface DatabaseStore {
  academic_years: AcademicYear[];
  modules: Module[];
  subjects: Subject[];
  chapters: Chapter[];
  concepts: Concept[];
  exams: Exam[];
  questions: Question[];
  answer_choices: AnswerChoice[];
  explanations: ExplanationItem[];
  exam_questions: ExamQuestion[];
  bookmarks: Bookmark[];
  student_attempts: StudentAttempt[];
  student_answers: StudentAnswer[];
  admins?: AdminUser[];
}

// Initial Clean Database Store (Starts 100% empty for clean production data)
function generateSeedData(): DatabaseStore {
  return {
    academic_years: [],
    modules: [],
    subjects: [],
    chapters: [],
    concepts: [],
    exams: [],
    questions: [],
    answer_choices: [],
    explanations: [],
    exam_questions: [],
    bookmarks: [],
    student_attempts: [],
    student_answers: [],
    admins: [],
  };
}

// Serverless-safe store reader
export function readLocalStore(): DatabaseStore {
  if (inMemoryStore) {
    return inMemoryStore;
  }

  const { isServerless, activeDataDir, activeDbFile, bundledDbFile } = getDbStoragePaths();

  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ activeDbFile)) {
      const content = fs.readFileSync(/*turbopackIgnore: true*/ activeDbFile, 'utf-8');
      inMemoryStore = JSON.parse(content);
      return inMemoryStore!;
    }

    if (fs.existsSync(/*turbopackIgnore: true*/ bundledDbFile)) {
      const content = fs.readFileSync(/*turbopackIgnore: true*/ bundledDbFile, 'utf-8');
      inMemoryStore = JSON.parse(content);
      if (isServerless && ensureDbDir(activeDataDir)) {
        try {
          fs.writeFileSync(activeDbFile, content, 'utf-8');
        } catch {}
      }
      return inMemoryStore!;
    }

    const seed = generateSeedData();
    inMemoryStore = seed;
    if (ensureDbDir(activeDataDir)) {
      try {
        fs.writeFileSync(activeDbFile, JSON.stringify(seed, null, 2), 'utf-8');
      } catch {}
    }
    return seed;
  } catch (err) {
    console.error('Error reading store, falling back to clean in-memory seed:', err);
    if (!inMemoryStore) {
      inMemoryStore = generateSeedData();
    }
    return inMemoryStore;
  }
}

// Serverless-safe store writer (Never crashes with EROFS)
export function writeLocalStore(store: DatabaseStore): void {
  // Update in-memory state immediately
  inMemoryStore = store;

  const { isServerless, activeDataDir, activeDbFile } = getDbStoragePaths();
  try {
    if (ensureDbDir(activeDataDir)) {
      fs.writeFileSync(activeDbFile, JSON.stringify(store, null, 2), 'utf-8');
    }
  } catch (err) {
    // If writing to active path failed (e.g. read-only container), try /tmp fallback
    if (!isServerless) {
      try {
        const tmpDir = path.join(os.tmpdir(), 'omnimed_data');
        if (ensureDbDir(tmpDir)) {
          fs.writeFileSync(path.join(tmpDir, 'db.json'), JSON.stringify(store, null, 2), 'utf-8');
        }
      } catch {}
    }
    console.warn('[Storage] Read-only serverless filesystem: persisted store in-memory without error:', (err as Error).message);
  }
}

// ==========================================
// UNIFIED DATABASE REPOSITORY METHODS
// ==========================================

export async function getAcademicYears(): Promise<AcademicYear[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .order('order_index', { ascending: true });
    if (!error && data) return data;
  }
  const store = readLocalStore();
  return store.academic_years.sort((a, b) => a.order_index - b.order_index);
}

export async function createAcademicYear(data: Omit<AcademicYear, 'id'>): Promise<AcademicYear> {
  const newYear: AcademicYear = {
    ...data,
    id: `year-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data: inserted, error } = await supabase
      .from('academic_years')
      .insert([newYear])
      .select()
      .single();
    if (!error && inserted) return inserted;
  }

  const store = readLocalStore();
  store.academic_years.push(newYear);
  writeLocalStore(store);
  return newYear;
}

export async function updateAcademicYear(id: string, updates: Partial<AcademicYear>): Promise<AcademicYear | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('academic_years')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) return data;
  }

  const store = readLocalStore();
  const index = store.academic_years.findIndex((y) => y.id === id);
  if (index === -1) return null;
  store.academic_years[index] = { ...store.academic_years[index], ...updates };
  writeLocalStore(store);
  return store.academic_years[index];
}

export async function deleteAcademicYear(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.academic_years = store.academic_years.filter((y) => y.id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      const { error } = await supabase.from('academic_years').delete().eq('id', id);
      if (error) console.error('Error deleting academic year from Supabase:', error);
    } catch (e) {
      console.warn('Error deleting academic year from Supabase:', e);
    }
  }

  return true;
}

// ---------------- Modules -----------------
export async function getModules(academicYearId?: string): Promise<Module[]> {
  if (supabase) {
    let query = supabase.from('modules').select('*, academic_year:academic_years(*)');
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data) return data;
  }

  const store = readLocalStore();
  let list = store.modules;
  if (academicYearId) {
    list = list.filter((m) => m.academic_year_id === academicYearId);
  }
  return list
    .map((m) => ({
      ...m,
      academic_year: store.academic_years.find((y) => y.id === m.academic_year_id),
    }))
    .sort((a, b) => a.order_index - b.order_index);
}

export async function createModule(data: Omit<Module, 'id'>): Promise<Module> {
  const newMod: Module = {
    ...data,
    id: `mod-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data: inserted, error } = await supabase.from('modules').insert([newMod]).select().single();
    if (!error && inserted) return inserted;
  }

  const store = readLocalStore();
  store.modules.push(newMod);
  writeLocalStore(store);
  return newMod;
}

export async function updateModule(id: string, updates: Partial<Module>): Promise<Module | null> {
  if (supabase) {
    const { data, error } = await supabase.from('modules').update(updates).eq('id', id).select().single();
    if (!error && data) return data;
  }

  const store = readLocalStore();
  const index = store.modules.findIndex((m) => m.id === id);
  if (index === -1) return null;
  store.modules[index] = { ...store.modules[index], ...updates };
  writeLocalStore(store);
  return store.modules[index];
}

export async function deleteModule(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.modules = store.modules.filter((m) => m.id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      const { error } = await supabase.from('modules').delete().eq('id', id);
      if (error) console.error('Error deleting module from Supabase:', error);
    } catch (e) {
      console.warn('Error deleting module from Supabase:', e);
    }
  }

  return true;
}

// ---------------- Subjects -----------------
export async function getSubjects(moduleId?: string): Promise<Subject[]> {
  if (supabase) {
    let query = supabase.from('subjects').select('*, module:modules(*)');
    if (moduleId) query = query.eq('module_id', moduleId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data) return data;
  }

  const store = readLocalStore();
  let list = store.subjects;
  if (moduleId) {
    list = list.filter((s) => s.module_id === moduleId);
  }
  return list
    .map((s) => ({
      ...s,
      module: store.modules.find((m) => m.id === s.module_id),
    }))
    .sort((a, b) => a.order_index - b.order_index);
}

export async function createSubject(data: Omit<Subject, 'id'>): Promise<Subject> {
  const newSub: Subject = {
    ...data,
    id: `sub-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data: inserted, error } = await supabase.from('subjects').insert([newSub]).select().single();
    if (!error && inserted) return inserted;
  }

  const store = readLocalStore();
  store.subjects.push(newSub);
  writeLocalStore(store);
  return newSub;
}

export async function updateSubject(id: string, updates: Partial<Subject>): Promise<Subject | null> {
  if (supabase) {
    const { data, error } = await supabase.from('subjects').update(updates).eq('id', id).select().single();
    if (!error && data) return data;
  }

  const store = readLocalStore();
  const index = store.subjects.findIndex((s) => s.id === id);
  if (index === -1) return null;
  store.subjects[index] = { ...store.subjects[index], ...updates };
  writeLocalStore(store);
  return store.subjects[index];
}

export async function deleteSubject(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.subjects = store.subjects.filter((s) => s.id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) console.error('Error deleting subject from Supabase:', error);
    } catch (e) {
      console.warn('Error deleting subject from Supabase:', e);
    }
  }

  return true;
}

// ---------------- Chapters -----------------
export async function getChapters(subjectId?: string): Promise<Chapter[]> {
  if (supabase) {
    let query = supabase.from('chapters').select('*, subject:subjects(*)');
    if (subjectId) query = query.eq('subject_id', subjectId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data) return data;
  }

  const store = readLocalStore();
  let list = store.chapters;
  if (subjectId) {
    list = list.filter((c) => c.subject_id === subjectId);
  }
  return list
    .map((c) => ({
      ...c,
      subject: store.subjects.find((s) => s.id === c.subject_id),
    }))
    .sort((a, b) => a.order_index - b.order_index);
}

export async function createChapter(data: Omit<Chapter, 'id'>): Promise<Chapter> {
  const newChap: Chapter = {
    ...data,
    id: `chap-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data: inserted, error } = await supabase.from('chapters').insert([newChap]).select().single();
    if (!error && inserted) return inserted;
  }

  const store = readLocalStore();
  store.chapters.push(newChap);
  writeLocalStore(store);
  return newChap;
}

export async function updateChapter(id: string, updates: Partial<Chapter>): Promise<Chapter | null> {
  if (supabase) {
    const { data, error } = await supabase.from('chapters').update(updates).eq('id', id).select().single();
    if (!error && data) return data;
  }

  const store = readLocalStore();
  const index = store.chapters.findIndex((c) => c.id === id);
  if (index === -1) return null;
  store.chapters[index] = { ...store.chapters[index], ...updates };
  writeLocalStore(store);
  return store.chapters[index];
}

export async function deleteChapter(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.chapters = store.chapters.filter((c) => c.id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) console.error('Error deleting chapter from Supabase:', error);
    } catch (e) {
      console.warn('Error deleting chapter from Supabase:', e);
    }
  }

  return true;
}

// ---------------- Concepts -----------------
export async function getConcepts(chapterId?: string): Promise<Concept[]> {
  if (supabase) {
    let query = supabase.from('concepts').select('*, chapter:chapters(*)');
    if (chapterId) query = query.eq('chapter_id', chapterId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data) return data;
  }

  const store = readLocalStore();
  let list = store.concepts;
  if (chapterId) {
    list = list.filter((c) => c.chapter_id === chapterId);
  }
  return list
    .map((c) => ({
      ...c,
      chapter: store.chapters.find((ch) => ch.id === c.chapter_id),
    }))
    .sort((a, b) => a.order_index - b.order_index);
}

export async function createConcept(data: Omit<Concept, 'id'>): Promise<Concept> {
  const newCon: Concept = {
    ...data,
    id: `con-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { data: inserted, error } = await supabase.from('concepts').insert([newCon]).select().single();
    if (!error && inserted) return inserted;
  }

  const store = readLocalStore();
  store.concepts.push(newCon);
  writeLocalStore(store);
  return newCon;
}

export async function updateConcept(id: string, updates: Partial<Concept>): Promise<Concept | null> {
  if (supabase) {
    const { data, error } = await supabase.from('concepts').update(updates).eq('id', id).select().single();
    if (!error && data) return data;
  }

  const store = readLocalStore();
  const index = store.concepts.findIndex((c) => c.id === id);
  if (index === -1) return null;
  store.concepts[index] = { ...store.concepts[index], ...updates };
  writeLocalStore(store);
  return store.concepts[index];
}

export async function deleteConcept(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.concepts = store.concepts.filter((c) => c.id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      const { error } = await supabase.from('concepts').delete().eq('id', id);
      if (error) console.error('Error deleting concept from Supabase:', error);
    } catch (e) {
      console.warn('Error deleting concept from Supabase:', e);
    }
  }

  return true;
}

// ---------------- Exams -----------------
export async function getExams(filters?: { academic_year_id?: string; module_id?: string }): Promise<Exam[]> {
  if (supabase) {
    try {
      let query = supabase.from('exams').select('*, academic_year:academic_years(*), module:modules(*), exam_questions(id, question_id)');
      if (filters?.academic_year_id) query = query.eq('academic_year_id', filters.academic_year_id);
      if (filters?.module_id) query = query.eq('module_id', filters.module_id);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((e: any) => ({
          ...e,
          exam_type: (e.exam_type === 'midterm' || e.exam_type === 'end_module') ? 'end_module' : (e.exam_type || 'final'),
          question_count: Array.isArray(e.exam_questions) ? e.exam_questions.length : 0,
          question_ids: Array.isArray(e.exam_questions) ? e.exam_questions.map((eq: any) => eq.question_id) : [],
          completion_status: 'not_started',
        }));
      }
    } catch (err) {
      console.warn('Error fetching exams from Supabase:', err);
    }
  }

  const store = readLocalStore();
  let list = store.exams;

  if (filters?.academic_year_id) {
    list = list.filter((e) => e.academic_year_id === filters.academic_year_id);
  }
  if (filters?.module_id) {
    list = list.filter((e) => e.module_id === filters.module_id);
  }

  return list.map((e) => {
    const linkedEq = store.exam_questions.filter((eq) => eq.exam_id === e.id);
    const count = linkedEq.length;
    const qids = linkedEq.map((eq) => eq.question_id);
    const lastAttempt = store.student_attempts
      .filter((a) => a.entity_id === e.id && a.is_completed)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      ...e,
      exam_type: (e.exam_type === 'midterm' || e.exam_type === 'end_module') ? 'end_module' : (e.exam_type || 'final'),
      question_count: count,
      question_ids: qids,
      academic_year: store.academic_years.find((y) => y.id === e.academic_year_id),
      module: store.modules.find((m) => m.id === e.module_id),
      completion_status: lastAttempt ? 'completed' : 'not_started',
      previous_score: lastAttempt?.score_percentage,
    };
  });
}

export async function getExam(id: string): Promise<Exam | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*, academic_year:academic_years(*), module:modules(*), exam_questions(id, question_id)')
        .eq('id', id)
        .single();
      if (!error && data) {
        return {
          ...data,
          exam_type: (data.exam_type === 'midterm' || data.exam_type === 'end_module') ? 'end_module' : (data.exam_type || 'final'),
          question_count: Array.isArray(data.exam_questions) ? data.exam_questions.length : 0,
          question_ids: Array.isArray(data.exam_questions) ? data.exam_questions.map((eq: any) => eq.question_id) : [],
        };
      }
    } catch (err) {
      console.warn('Error fetching exam from Supabase:', err);
    }
  }

  const store = readLocalStore();
  const exam = store.exams.find((e) => e.id === id);
  if (!exam) return null;
  const linkedEq = store.exam_questions.filter((eq) => eq.exam_id === exam.id);
  const count = linkedEq.length;
  const qids = linkedEq.map((eq) => eq.question_id);
  return {
    ...exam,
    exam_type: (exam.exam_type === 'midterm' || exam.exam_type === 'end_module') ? 'end_module' : (exam.exam_type || 'final'),
    question_count: count,
    question_ids: qids,
    academic_year: store.academic_years.find((y) => y.id === exam.academic_year_id),
    module: store.modules.find((m) => m.id === exam.module_id),
  };
}

export async function createExam(data: Omit<Exam, 'id'> & { question_ids?: string[] }): Promise<Exam> {
  const newExam: Exam = {
    id: `exam-${Date.now()}`,
    academic_year_id: data.academic_year_id,
    module_id: data.module_id,
    title: data.title,
    exam_type: data.exam_type || 'final',
    term: data.term,
    academic_period: data.academic_period,
    duration_minutes: data.duration_minutes || 60,
    passing_score: data.passing_score || 70,
    instructions: data.instructions,
    is_published: data.is_published ?? true,
    created_at: new Date().toISOString(),
  };

  const store = readLocalStore();
  store.exams.push(newExam);

  if (data.question_ids && data.question_ids.length > 0) {
    data.question_ids.forEach((qid, idx) => {
      store.exam_questions.push({
        id: `eq-${Date.now()}-${idx}`,
        exam_id: newExam.id,
        question_id: qid,
        order_index: idx + 1,
      });
    });
  }

  writeLocalStore(store);

  if (supabase) {
    try {
      const { academic_year: _y, module: _m, questions: _q, question_count: _qc, ...examRow } = newExam as any;
      if (examRow.exam_type === 'end_module') {
        examRow.exam_type = 'midterm';
      }
      await supabase.from('exams').upsert([examRow], { onConflict: 'id' });
      if (data.question_ids && data.question_ids.length > 0) {
        const eqRows = data.question_ids.map((qid, idx) => ({
          id: `eq-${Date.now()}-${idx}`,
          exam_id: newExam.id,
          question_id: qid,
          order_index: idx + 1,
        }));
        await supabase.from('exam_questions').upsert(eqRows, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Error syncing exam to Supabase:', e);
    }
  }

  return newExam;
}

export async function updateExam(
  id: string,
  updates: Partial<Exam> & { question_ids?: string[] }
): Promise<Exam | null> {
  const { question_ids, ...examUpdates } = updates;
  let updatedExam: Exam | null = null;

  if (supabase) {
    try {
      const dbPayload = { ...examUpdates };
      if ((dbPayload as any).exam_type === 'end_module') {
        (dbPayload as any).exam_type = 'midterm';
      }
      delete (dbPayload as any).academic_year;
      delete (dbPayload as any).module;
      delete (dbPayload as any).question_count;
      delete (dbPayload as any).question_ids;
      delete (dbPayload as any).exam_questions;
      delete (dbPayload as any).questions;
      delete (dbPayload as any).completion_status;
      delete (dbPayload as any).previous_score;

      if (Object.keys(dbPayload).length > 0) {
        const { data, error } = await supabase
          .from('exams')
          .update(dbPayload)
          .eq('id', id)
          .select('*, academic_year:academic_years(*), module:modules(*)')
          .single();
        if (!error && data) {
          updatedExam = {
            ...data,
            exam_type: (data.exam_type === 'midterm' || data.exam_type === 'end_module') ? 'end_module' : (data.exam_type || 'final'),
          };
        }
      }

      if (Array.isArray(question_ids)) {
        await supabase.from('exam_questions').delete().eq('exam_id', id);
        if (question_ids.length > 0) {
          const links = question_ids.map((qid, idx) => ({
            id: `eq-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            exam_id: id,
            question_id: qid,
            order_index: idx + 1,
          }));
          await supabase.from('exam_questions').insert(links);
        }
      }
    } catch (e) {
      console.warn('Error updating exam in Supabase:', e);
    }
  }

  const store = readLocalStore();
  const index = store.exams.findIndex((e) => e.id === id);
  if (index !== -1) {
    store.exams[index] = { ...store.exams[index], ...examUpdates };
    if (Array.isArray(question_ids)) {
      store.exam_questions = store.exam_questions.filter((eq) => eq.exam_id !== id);
      question_ids.forEach((qid, idx) => {
        store.exam_questions.push({
          id: `eq-${Date.now()}-${idx}`,
          exam_id: id,
          question_id: qid,
          order_index: idx + 1,
        });
      });
    }
    writeLocalStore(store);
    if (!updatedExam) {
      updatedExam = store.exams[index];
    }
  }

  return updatedExam || (await getExam(id));
}

export async function deleteExam(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.exams = store.exams.filter((e) => e.id !== id);
  store.exam_questions = store.exam_questions.filter((eq) => eq.exam_id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      await supabase.from('exams').delete().eq('id', id);
    } catch (e) {
      console.warn('Error deleting exam from Supabase:', e);
    }
  }

  return true;
}

// ---------------- Questions -----------------
export async function getQuestions(filters?: {
  academic_year_id?: string;
  module_id?: string;
  subject_id?: string;
  chapter_id?: string;
  concept_id?: string;
  exam_id?: string;
  difficulty?: string;
}): Promise<Question[]> {
  if (supabase) {
    try {
      let query = supabase.from('questions').select(`
        *,
        answer_choices(*),
        explanations(*),
        exam_questions(id, exam_id),
        academic_year:academic_years(*),
        module:modules(*),
        subject:subjects(*),
        chapter:chapters(*),
        concept:concepts(*)
      `);

      if (filters?.academic_year_id) query = query.eq('academic_year_id', filters.academic_year_id);
      if (filters?.module_id) query = query.eq('module_id', filters.module_id);
      if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id);
      if (filters?.chapter_id) query = query.eq('chapter_id', filters.chapter_id);
      if (filters?.concept_id) query = query.eq('concept_id', filters.concept_id);
      if (filters?.difficulty) query = query.eq('difficulty', filters.difficulty);

      const { data, error } = await query.order('order_index', { ascending: true });
      if (!error && data) {
        let list: Question[] = data.map((q: any) => {
          const choices = (q.answer_choices || []).sort((a: any, b: any) => a.order_index - b.order_index);
          const linkedExamIds = (q.exam_questions || []).map((eq: any) => eq.exam_id);
          return {
            ...q,
            answer_choices: choices,
            explanations: q.explanations || [],
            exam_ids: linkedExamIds,
          };
        });

        if (filters?.exam_id) {
          list = list.filter((q) => q.exam_ids && q.exam_ids.includes(filters.exam_id!));
        }

        return list;
      }
    } catch (err) {
      console.warn('Error fetching questions from Supabase:', err);
    }
  }

  const store = readLocalStore();
  let list = store.questions;

  if (filters?.exam_id) {
    const questionIdsInExam = store.exam_questions
      .filter((eq) => eq.exam_id === filters.exam_id)
      .map((eq) => eq.question_id);
    list = list.filter((q) => questionIdsInExam.includes(q.id));
  }
  if (filters?.academic_year_id) {
    list = list.filter((q) => q.academic_year_id === filters.academic_year_id);
  }
  if (filters?.module_id) {
    list = list.filter((q) => q.module_id === filters.module_id);
  }
  if (filters?.subject_id) {
    list = list.filter((q) => q.subject_id === filters.subject_id);
  }
  if (filters?.chapter_id) {
    list = list.filter((q) => q.chapter_id === filters.chapter_id);
  }
  if (filters?.concept_id) {
    list = list.filter((q) => q.concept_id === filters.concept_id);
  }
  if (filters?.difficulty) {
    list = list.filter((q) => q.difficulty === filters.difficulty);
  }

  return list.map((q) => {
    const choices = store.answer_choices
      .filter((c) => c.question_id === q.id)
      .sort((a, b) => a.order_index - b.order_index);
    const expls = store.explanations.filter((e) => e.question_id === q.id);
    const linkedExamIds = store.exam_questions.filter((eq) => eq.question_id === q.id).map((eq) => eq.exam_id);
    const linkedExams = store.exams.filter((e) => linkedExamIds.includes(e.id));

    return {
      ...q,
      answer_choices: choices,
      explanations: expls,
      exam_ids: linkedExamIds,
      exams: linkedExams,
      academic_year: store.academic_years.find((y) => y.id === q.academic_year_id),
      module: store.modules.find((m) => m.id === q.module_id),
      subject: store.subjects.find((s) => s.id === q.subject_id),
      chapter: store.chapters.find((c) => c.id === q.chapter_id),
      concept: store.concepts.find((c) => c.id === q.concept_id),
    };
  });
}

export async function getQuestion(id: string): Promise<Question | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          answer_choices(*),
          explanations(*),
          exam_questions(id, exam_id),
          academic_year:academic_years(*),
          module:modules(*),
          subject:subjects(*),
          chapter:chapters(*),
          concept:concepts(*)
        `)
        .eq('id', id)
        .single();

      if (!error && data) {
        const choices = (data.answer_choices || []).sort((a: any, b: any) => a.order_index - b.order_index);
        const linkedExamIds = (data.exam_questions || []).map((eq: any) => eq.exam_id);
        return {
          ...data,
          answer_choices: choices,
          explanations: data.explanations || [],
          exam_ids: linkedExamIds,
        };
      }
    } catch (err) {
      console.warn('Error fetching question from Supabase:', err);
    }
  }

  const store = readLocalStore();
  const q = store.questions.find((item) => item.id === id);
  if (!q) return null;

  const choices = store.answer_choices
    .filter((c) => c.question_id === q.id)
    .sort((a, b) => a.order_index - b.order_index);
  const expls = store.explanations.filter((e) => e.question_id === q.id);
  const linkedExamIds = store.exam_questions.filter((eq) => eq.question_id === q.id).map((eq) => eq.exam_id);

  return {
    ...q,
    answer_choices: choices,
    explanations: expls,
    exam_ids: linkedExamIds,
    academic_year: store.academic_years.find((y) => y.id === q.academic_year_id),
    module: store.modules.find((m) => m.id === q.module_id),
    subject: store.subjects.find((s) => s.id === q.subject_id),
    chapter: store.chapters.find((c) => c.id === q.chapter_id),
    concept: store.concepts.find((c) => c.id === q.concept_id),
  };
}

export async function createQuestion(payload: {
  question: Omit<Question, 'id' | 'answer_choices' | 'explanations'>;
  answer_choices: Omit<AnswerChoice, 'id' | 'question_id'>[];
  explanations: Omit<ExplanationItem, 'id' | 'question_id'>[];
  exam_ids?: string[];
}): Promise<Question> {
  const store = readLocalStore();
  const newQId = `q-${Date.now()}`;

  const newQuestion: Question = {
    ...payload.question,
    id: newQId,
    order_index: payload.question.order_index || store.questions.length + 1,
    created_at: new Date().toISOString(),
    answer_choices: [],
    explanations: [],
  };

  store.questions.push(newQuestion);

  // Insert choices
  const insertedChoices: AnswerChoice[] = [];
  const safeChoices = Array.isArray(payload.answer_choices) ? payload.answer_choices : [];
  safeChoices.forEach((c, idx) => {
    const choiceItem: AnswerChoice = {
      ...c,
      id: `c-${newQId}-${idx}`,
      question_id: newQId,
      order_index: c.order_index || idx + 1,
    };
    store.answer_choices.push(choiceItem);
    insertedChoices.push(choiceItem);
  });

  // Insert explanations
  const insertedExpls: ExplanationItem[] = [];
  const safeExpls = Array.isArray(payload.explanations) ? payload.explanations : [];
  safeExpls.forEach((e, idx) => {
    // Map choice_letter to choice_id if present
    const matchedChoice = insertedChoices.find((c) => c.choice_letter === e.choice_letter);
    const explItem: ExplanationItem = {
      ...e,
      id: `exp-${newQId}-${idx}`,
      question_id: newQId,
      choice_id: matchedChoice ? matchedChoice.id : e.choice_id || null,
      created_at: new Date().toISOString(),
    };
    store.explanations.push(explItem);
    insertedExpls.push(explItem);
  });

  // Link to exams
  const safeExamIds = Array.isArray(payload.exam_ids) ? payload.exam_ids : [];
  if (safeExamIds.length > 0) {
    safeExamIds.forEach((eid, idx) => {
      store.exam_questions.push({
        id: `eq-${Date.now()}-${idx}`,
        exam_id: eid,
        question_id: newQId,
        order_index: idx + 1,
      });
    });
  }

  writeLocalStore(store);

  if (supabase) {
    try {
      const {
        answer_choices: _c,
        explanations: _e,
        exam_ids: _ei,
        exams: _ex,
        academic_year: _ay,
        module: _m,
        subject: _s,
        chapter: _ch,
        concept: _co,
        ...questionRow
      } = newQuestion as any;
      await supabase.from('questions').upsert([questionRow], { onConflict: 'id' });
      if (insertedChoices.length > 0) {
        await supabase.from('answer_choices').upsert(insertedChoices, { onConflict: 'id' });
      }
      if (insertedExpls.length > 0) {
        await supabase.from('explanations').upsert(insertedExpls, { onConflict: 'id' });
      }
      if (safeExamIds.length > 0) {
        const eqRows = safeExamIds.map((eid, idx) => ({
          id: `eq-${Date.now()}-${idx}`,
          exam_id: eid,
          question_id: newQId,
          order_index: idx + 1,
        }));
        await supabase.from('exam_questions').upsert(eqRows, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Error syncing new question to Supabase:', e);
    }
  }

  return {
    ...newQuestion,
    answer_choices: insertedChoices,
    explanations: insertedExpls,
    exam_ids: safeExamIds,
  };
}

export async function updateQuestion(
  id: string,
  payload: {
    question: Partial<Question>;
    answer_choices?: Omit<AnswerChoice, 'question_id'>[];
    explanations?: Omit<ExplanationItem, 'question_id'>[];
    exam_ids?: string[];
  }
): Promise<Question | null> {
  if (supabase) {
    try {
      if (payload.question && Object.keys(payload.question).length > 0) {
        const qUpdate = { ...payload.question };
        delete (qUpdate as any).answer_choices;
        delete (qUpdate as any).explanations;
        delete (qUpdate as any).exam_ids;
        delete (qUpdate as any).exams;
        delete (qUpdate as any).academic_year;
        delete (qUpdate as any).module;
        delete (qUpdate as any).subject;
        delete (qUpdate as any).chapter;
        delete (qUpdate as any).concept;
        if (Object.keys(qUpdate).length > 0) {
          await supabase.from('questions').update(qUpdate).eq('id', id);
        }
      }
      if (Array.isArray(payload.answer_choices)) {
        await supabase.from('answer_choices').delete().eq('question_id', id);
        const choicesToInsert = payload.answer_choices.map((c, idx) => ({
          id: c.id || `c-${id}-${idx}`,
          question_id: id,
          choice_letter: c.choice_letter,
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_index: c.order_index || idx + 1,
        }));
        if (choicesToInsert.length > 0) {
          await supabase.from('answer_choices').insert(choicesToInsert);
        }
      }
      if (Array.isArray(payload.explanations)) {
        await supabase.from('explanations').delete().eq('question_id', id);
        const explsToInsert = payload.explanations.map((e, idx) => ({
          id: e.id || `exp-${id}-${idx}`,
          question_id: id,
          choice_id: e.choice_id || null,
          choice_letter: e.choice_letter,
          explanation_text: e.explanation_text,
          is_why_correct: e.is_why_correct,
          is_why_incorrect: e.is_why_incorrect,
          source_document: e.source_document,
          source_page: e.source_page,
          source_reference: e.source_reference,
          created_at: new Date().toISOString(),
        }));
        if (explsToInsert.length > 0) {
          await supabase.from('explanations').insert(explsToInsert);
        }
      }
      if (Array.isArray(payload.exam_ids)) {
        await supabase.from('exam_questions').delete().eq('question_id', id);
        const eqToInsert = payload.exam_ids.map((eid, idx) => ({
          id: `eq-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          exam_id: eid,
          question_id: id,
          order_index: idx + 1,
        }));
        if (eqToInsert.length > 0) {
          await supabase.from('exam_questions').insert(eqToInsert);
        }
      }
    } catch (e) {
      console.warn('Error syncing updated question to Supabase:', e);
    }
  }

  const store = readLocalStore();
  const qIndex = store.questions.findIndex((q) => q.id === id);
  if (qIndex !== -1) {
    store.questions[qIndex] = { ...store.questions[qIndex], ...(payload.question || {}) };

    if (Array.isArray(payload.answer_choices)) {
      store.answer_choices = store.answer_choices.filter((c) => c.question_id !== id);
      payload.answer_choices.forEach((c, idx) => {
        store.answer_choices.push({
          id: c.id || `c-${id}-${idx}`,
          question_id: id,
          choice_letter: c.choice_letter,
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_index: c.order_index || idx + 1,
        });
      });
    }

    if (Array.isArray(payload.explanations)) {
      store.explanations = store.explanations.filter((e) => e.question_id !== id);
      payload.explanations.forEach((e, idx) => {
        const matchedChoice = store.answer_choices.find(
          (c) => c.question_id === id && c.choice_letter === e.choice_letter
        );
        store.explanations.push({
          id: e.id || `exp-${id}-${idx}`,
          question_id: id,
          choice_id: matchedChoice?.id || e.choice_id || null,
          choice_letter: e.choice_letter,
          explanation_text: e.explanation_text,
          is_why_correct: e.is_why_correct,
          is_why_incorrect: e.is_why_incorrect,
          source_document: e.source_document,
          source_page: e.source_page,
          source_reference: e.source_reference,
          created_at: new Date().toISOString(),
        });
      });
    }

    if (Array.isArray(payload.exam_ids)) {
      store.exam_questions = store.exam_questions.filter((eq) => eq.question_id !== id);
      payload.exam_ids.forEach((eid, idx) => {
        store.exam_questions.push({
          id: `eq-${Date.now()}-${idx}`,
          exam_id: eid,
          question_id: id,
          order_index: idx + 1,
        });
      });
    }

    writeLocalStore(store);
  }

  return getQuestion(id);
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.questions = store.questions.filter((q) => q.id !== id);
  store.answer_choices = store.answer_choices.filter((c) => c.question_id !== id);
  store.explanations = store.explanations.filter((e) => e.question_id !== id);
  store.exam_questions = store.exam_questions.filter((eq) => eq.question_id !== id);
  store.bookmarks = store.bookmarks.filter((b) => b.question_id !== id);
  writeLocalStore(store);

  if (supabase) {
    try {
      await supabase.from('questions').delete().eq('id', id);
    } catch (e) {
      console.warn('Error deleting question from Supabase:', e);
    }
  }

  return true;
}

/**
 * Sync entire local store to Supabase (upsert merge in strict hierarchical order)
 */
export async function syncLocalStoreToSupabase(store: DatabaseStore): Promise<void> {
  if (!supabase) return;
  try {
    // 1. Sync academic years
    if (store.academic_years.length > 0) {
      const cleanYears = store.academic_years.map(({ ...rest }: any) => rest);
      const { error: yErr } = await supabase.from('academic_years').upsert(cleanYears, { onConflict: 'id' });
      if (yErr) console.error('[Supabase Sync] academic_years error:', yErr);
    }
    const validYearIds = new Set(store.academic_years.map((y) => y.id));

    // 2. Sync modules (only valid foreign keys)
    const validModules = store.modules.filter((m) => validYearIds.has(m.academic_year_id));
    if (validModules.length > 0) {
      const cleanModules = validModules.map(({ academic_year: _, ...rest }: any) => rest);
      const { error: mErr } = await supabase.from('modules').upsert(cleanModules, { onConflict: 'id' });
      if (mErr) console.error('[Supabase Sync] modules error:', mErr);
    }
    const validModIds = new Set(validModules.map((m) => m.id));

    // 3. Sync subjects (only valid module_id)
    const validSubjects = store.subjects.filter((s) => validModIds.has(s.module_id));
    if (validSubjects.length > 0) {
      const cleanSubjects = validSubjects.map(({ module: _, ...rest }: any) => rest);
      const { error: sErr } = await supabase.from('subjects').upsert(cleanSubjects, { onConflict: 'id' });
      if (sErr) console.error('[Supabase Sync] subjects error:', sErr);
    }
    const validSubIds = new Set(validSubjects.map((s) => s.id));

    // 4. Sync chapters (only valid subject_id)
    const validChapters = store.chapters.filter((c) => validSubIds.has(c.subject_id));
    if (validChapters.length > 0) {
      const cleanChapters = validChapters.map(({ subject: _, ...rest }: any) => rest);
      const { error: chErr } = await supabase.from('chapters').upsert(cleanChapters, { onConflict: 'id' });
      if (chErr) console.error('[Supabase Sync] chapters error:', chErr);
    }
    const validChapIds = new Set(validChapters.map((c) => c.id));

    // 5. Sync concepts (only valid chapter_id)
    const validConcepts = store.concepts.filter((co) => validChapIds.has(co.chapter_id));
    if (validConcepts.length > 0) {
      const cleanConcepts = validConcepts.map(({ chapter: _, ...rest }: any) => rest);
      const { error: coErr } = await supabase.from('concepts').upsert(cleanConcepts, { onConflict: 'id' });
      if (coErr) console.error('[Supabase Sync] concepts error:', coErr);
    }

    // Ensure all exams have valid academic_year_id from their module if missing
    store.exams.forEach((e) => {
      if (!validYearIds.has(e.academic_year_id)) {
        const parentMod = store.modules.find((m) => m.id === e.module_id);
        if (parentMod && validYearIds.has(parentMod.academic_year_id)) {
          e.academic_year_id = parentMod.academic_year_id;
        } else if (store.academic_years[0]) {
          e.academic_year_id = store.academic_years[0].id;
        }
      }
    });

    // Ensure all questions have valid academic_year_id from their module if missing
    store.questions.forEach((q) => {
      if (!validYearIds.has(q.academic_year_id)) {
        const parentMod = store.modules.find((m) => m.id === q.module_id);
        if (parentMod && validYearIds.has(parentMod.academic_year_id)) {
          q.academic_year_id = parentMod.academic_year_id;
        } else if (store.academic_years[0]) {
          q.academic_year_id = store.academic_years[0].id;
        }
      }
    });

    // 6. Sync exams (only valid year & module)
    const validExams = store.exams.filter((e) => validYearIds.has(e.academic_year_id) && validModIds.has(e.module_id));
    if (validExams.length > 0) {
      const cleanExams = validExams.map(({ academic_year: _ay, module: _m, questions: _q, question_count: _qc, completion_status: _cs, previous_score: _ps, ...rest }: any) => ({
        ...rest,
        exam_type: (rest.exam_type === 'end_module' || rest.exam_type === 'midterm') ? 'midterm' : (rest.exam_type || 'final'),
      }));
      const { error: exErr } = await supabase.from('exams').upsert(cleanExams, { onConflict: 'id' });
      if (exErr) console.error('[Supabase Sync] exams error:', exErr);
    }
    const validExamIds = new Set(validExams.map((e) => e.id));

    // 7. Sync questions (only valid hierarchy links)
    const validQuestions = store.questions.filter((q) =>
      validYearIds.has(q.academic_year_id) &&
      validModIds.has(q.module_id) &&
      (!q.subject_id || validSubIds.has(q.subject_id)) &&
      (!q.chapter_id || validChapIds.has(q.chapter_id))
    );
    if (validQuestions.length > 0) {
      const cleanQuestions = validQuestions.map(({
        answer_choices: _c,
        explanations: _e,
        exam_ids: _ei,
        exams: _ex,
        academic_year: _ay,
        module: _m,
        subject: _s,
        chapter: _ch,
        concept: _co,
        ...rest
      }: any) => rest);
      const { error: qErr } = await supabase.from('questions').upsert(cleanQuestions, { onConflict: 'id' });
      if (qErr) console.error('[Supabase Sync] questions error:', qErr);
    }
    const validQIds = new Set(validQuestions.map((q) => q.id));

    // 8. Sync answer choices (only for valid questions)
    const validChoices = store.answer_choices.filter((c) => validQIds.has(c.question_id));
    if (validChoices.length > 0) {
      const { error: aErr } = await supabase.from('answer_choices').upsert(validChoices, { onConflict: 'id' });
      if (aErr) console.error('[Supabase Sync] answer_choices error:', aErr);
    }

    // 9. Sync explanations (only for valid questions)
    const validExpls = store.explanations.filter((e) => validQIds.has(e.question_id));
    if (validExpls.length > 0) {
      const { error: expErr } = await supabase.from('explanations').upsert(validExpls, { onConflict: 'id' });
      if (expErr) console.error('[Supabase Sync] explanations error:', expErr);
    }

    // 10. Sync exam questions (only for valid exams & questions)
    const validExamQs = store.exam_questions.filter((eq) => validExamIds.has(eq.exam_id) && validQIds.has(eq.question_id));
    if (validExamQs.length > 0) {
      const { error: eqErr } = await supabase.from('exam_questions').upsert(validExamQs, { onConflict: 'id' });
      if (eqErr) console.error('[Supabase Sync] exam_questions error:', eqErr);
    }
  } catch (err) {
    console.error('[Supabase Sync Engine] Fatal sync error:', err);
  }
}

// ---------------- Bookmarks -----------------
export async function getBookmarks(studentId = 'default_student', category?: string): Promise<Bookmark[]> {
  const store = readLocalStore();
  let list = store.bookmarks.filter((b) => b.student_id === studentId);
  if (category) {
    list = list.filter((b) => b.category === category);
  }
  const fullQuestions = await getQuestions();
  return list.map((b) => ({
    ...b,
    question: fullQuestions.find((q) => q.id === b.question_id),
  }));
}

export async function toggleBookmark(
  studentId = 'default_student',
  questionId: string,
  category: 'important' | 'review_later' | 'not_understood',
  notes?: string,
  action?: 'toggle' | 'save' | 'remove'
): Promise<Bookmark | null> {
  const store = readLocalStore();
  const existingIndex = store.bookmarks.findIndex(
    (b) => b.student_id === studentId && b.question_id === questionId
  );

  if (action === 'remove') {
    if (existingIndex > -1) {
      store.bookmarks.splice(existingIndex, 1);
      writeLocalStore(store);
    }
    return null;
  }

  if (existingIndex > -1) {
    if (action === 'save' || notes !== undefined) {
      store.bookmarks[existingIndex].category = category;
      store.bookmarks[existingIndex].notes = notes;
      writeLocalStore(store);
      return store.bookmarks[existingIndex];
    }

    if (store.bookmarks[existingIndex].category === category) {
      // Toggle off
      store.bookmarks.splice(existingIndex, 1);
      writeLocalStore(store);
      return null;
    } else {
      // Switch category
      store.bookmarks[existingIndex].category = category;
      writeLocalStore(store);
      return store.bookmarks[existingIndex];
    }
  }

  const newBookmark: Bookmark = {
    id: `bm-${Date.now()}`,
    student_id: studentId,
    question_id: questionId,
    category,
    notes,
    created_at: new Date().toISOString(),
  };

  store.bookmarks.push(newBookmark);
  writeLocalStore(store);
  return newBookmark;
}

export async function deleteBookmark(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.bookmarks = store.bookmarks.filter((b) => b.id !== id);
  writeLocalStore(store);
  return true;
}

// ---------------- Student Attempts -----------------
export async function getStudentAttempts(
  studentId = 'default_student',
  entityId?: string,
  includeAnswers = false
): Promise<StudentAttempt[]> {
  const store = readLocalStore();
  const filtered = store.student_attempts
    .filter((a) => a.student_id === studentId && (!entityId || a.entity_id === entityId))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (!includeAnswers) return filtered;

  return filtered.map((attempt) => {
    const answers = store.student_answers.filter((ans) => ans.attempt_id === attempt.id);
    return {
      ...attempt,
      answers,
    };
  });
}

export async function getAttempt(id: string): Promise<StudentAttempt | null> {
  const store = readLocalStore();
  const attempt = store.student_attempts.find((a) => a.id === id);
  if (!attempt) return null;
  const answers = store.student_answers.filter((ans) => ans.attempt_id === id);
  return {
    ...attempt,
    answers,
  };
}

export async function recordAttempt(data: {
  student_id?: string;
  mode: StudentAttempt['mode'];
  entity_id: string;
  title: string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  score_percentage: number;
  time_spent_seconds: number;
  answers: {
    question_id: string;
    selected_choice_id: string | null;
    is_correct: boolean;
    is_flagged?: boolean;
    time_taken_seconds?: number;
  }[];
}): Promise<StudentAttempt> {
  const store = readLocalStore();
  const attemptId = `att-${Date.now()}`;

  const newAttempt: StudentAttempt = {
    id: attemptId,
    student_id: data.student_id || 'default_student',
    mode: data.mode,
    entity_id: data.entity_id,
    title: data.title,
    total_questions: data.total_questions,
    correct_count: data.correct_count,
    incorrect_count: data.incorrect_count,
    unanswered_count: data.unanswered_count,
    score_percentage: data.score_percentage,
    time_spent_seconds: data.time_spent_seconds,
    is_completed: true,
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  store.student_attempts.push(newAttempt);

  const insertedAnswers: StudentAnswer[] = [];
  data.answers.forEach((ans, idx) => {
    const studentAns: StudentAnswer = {
      id: `ans-${attemptId}-${idx}`,
      attempt_id: attemptId,
      question_id: ans.question_id,
      selected_choice_id: ans.selected_choice_id,
      is_correct: ans.is_correct,
      is_flagged: ans.is_flagged,
      time_taken_seconds: ans.time_taken_seconds || 0,
      created_at: new Date().toISOString(),
    };
    store.student_answers.push(studentAns);
    insertedAnswers.push(studentAns);
  });

  writeLocalStore(store);

  if (supabase) {
    try {
      await supabase.from('student_attempts').insert(newAttempt);
      if (insertedAnswers.length > 0) {
        await supabase.from('student_answers').insert(insertedAnswers);
      }
    } catch (e) {
      console.warn('Error recording student attempt in Supabase:', e);
    }
  }

  return {
    ...newAttempt,
    answers: insertedAnswers,
  };
}

// ---------------- Repeated Concepts -----------------
// ---------------- Reset Student Progress -----------------
export async function resetStudentProgress(studentId = 'default_student'): Promise<{ success: boolean; message: string }> {
  // 1. Delete from Supabase if connected
  if (supabase) {
    try {
      const { data: attempts } = await supabase.from('student_attempts').select('id').eq('student_id', studentId);
      if (attempts && attempts.length > 0) {
        const attemptIds = attempts.map((a) => a.id);
        await supabase.from('student_answers').delete().in('attempt_id', attemptIds);
      }
      await supabase.from('student_attempts').delete().eq('student_id', studentId);
    } catch (e) {
      console.warn('Error resetting student progress in Supabase:', e);
    }
  }

  // 2. Delete from Local Store
  const store = readLocalStore();
  const studentAttemptIds = new Set(
    store.student_attempts.filter((a) => a.student_id === studentId).map((a) => a.id)
  );
  store.student_attempts = store.student_attempts.filter((a) => a.student_id !== studentId);
  store.student_answers = store.student_answers.filter((ans) => !studentAttemptIds.has(ans.attempt_id));
  writeLocalStore(store);

  return { success: true, message: 'تم مسح كافة النتائج والحلول السابقة بنجاح' };
}

export async function getRepeatedConcepts(): Promise<RepeatedConceptStat[]> {
  const [allQuestions, allConcepts, allChapters, allSubjects, allModules, allYears, allExams] = await Promise.all([
    getQuestions(),
    getConcepts(),
    getChapters(),
    getSubjects(),
    getModules(),
    getAcademicYears(),
    getExams(),
  ]);

  const conceptLookup = new Map(allConcepts.map((c) => [c.id, c]));
  const chapterLookup = new Map(allChapters.map((c) => [c.id, c]));
  const subjectLookup = new Map(allSubjects.map((s) => [s.id, s]));
  const moduleLookup = new Map(allModules.map((m) => [m.id, m]));
  const yearLookup = new Map(allYears.map((y) => [y.id, y]));
  const examLookup = new Map(allExams.map((e) => [e.id, e]));

  // Group questions by normalized concept name so identical concepts with different IDs are aggregated
  const conceptMap = new Map<string, { conceptId: string; conceptName: string; questions: Question[] }>();
  allQuestions.forEach((q) => {
    let name = '';
    let cId = q.concept_id || '';
    if (q.concept_id) {
      const c = conceptLookup.get(q.concept_id);
      if (c) {
        name = c.name;
        cId = c.id;
      }
    }
    if (!name && (q as any).concept?.name) {
      name = (q as any).concept.name;
      if (!cId && (q as any).concept.id) cId = (q as any).concept.id;
    }

    const normKey = name.trim().toLowerCase();
    if (!normKey) return;

    const existing = conceptMap.get(normKey);
    if (existing) {
      existing.questions.push(q);
    } else {
      conceptMap.set(normKey, {
        conceptId: cId || `concept-${normKey}`,
        conceptName: name.trim(),
        questions: [q],
      });
    }
  });

  const stats: RepeatedConceptStat[] = [];

  conceptMap.forEach(({ conceptId, conceptName, questions: questionsForConcept }) => {
    const conceptObj = conceptLookup.get(conceptId);
    const fallbackConcept = questionsForConcept.find((q: any) => q.concept?.id === conceptId)?.concept;

    const chapterId = conceptObj?.chapter_id || fallbackConcept?.chapter_id || questionsForConcept[0]?.chapter_id;
    const chapterObj = chapterId ? chapterLookup.get(chapterId) : undefined;
    const fallbackChapter = questionsForConcept.find((q: any) => q.chapter)?.chapter;

    const subjectId = chapterObj?.subject_id || fallbackChapter?.subject_id || questionsForConcept[0]?.subject_id;
    const subjectObj = subjectId ? subjectLookup.get(subjectId) : undefined;
    const fallbackSubject = questionsForConcept.find((q: any) => q.subject)?.subject;

    const moduleId = subjectObj?.module_id || fallbackSubject?.module_id || questionsForConcept[0]?.module_id;
    const moduleObj = moduleId ? moduleLookup.get(moduleId) : undefined;
    const fallbackModule = questionsForConcept.find((q: any) => q.module)?.module;

    const academicYearId = moduleObj?.academic_year_id || fallbackModule?.academic_year_id || questionsForConcept[0]?.academic_year_id;
    const yearObj = academicYearId ? yearLookup.get(academicYearId) : undefined;
    const fallbackYear = questionsForConcept.find((q: any) => q.academic_year)?.academic_year;

    // Collect distinct exams where questions of this concept appear
    const examMap = new Map<string, { id: string; title: string; year_name?: string }>();
    questionsForConcept.forEach((q) => {
      const examIds = q.exam_ids || q.exams?.map((e) => e.id) || [];
      examIds.forEach((eid) => {
        if (!examMap.has(eid)) {
          const ex = examLookup.get(eid) || q.exams?.find((e) => e.id === eid);
          if (ex) {
            const y = ex.academic_year_id ? yearLookup.get(ex.academic_year_id) : undefined;
            examMap.set(eid, {
              id: eid,
              title: ex.title,
              year_name: y?.name,
            });
          }
        }
      });
    });

    const examsList = Array.from(examMap.values());

    stats.push({
      concept_id: conceptId,
      concept_name: conceptName,
      subject_id: subjectObj?.id || fallbackSubject?.id || questionsForConcept[0]?.subject_id,
      subject_name: subjectObj?.name || fallbackSubject?.name || 'Integrated Medicine',
      module_id: moduleObj?.id || fallbackModule?.id || questionsForConcept[0]?.module_id,
      module_name: moduleObj?.name || fallbackModule?.name,
      academic_year_id: yearObj?.id || fallbackYear?.id || questionsForConcept[0]?.academic_year_id,
      academic_year_name: yearObj?.name || fallbackYear?.name,
      chapter_id: chapterObj?.id || fallbackChapter?.id || questionsForConcept[0]?.chapter_id,
      chapter_name: chapterObj?.name || fallbackChapter?.name || 'General Concepts',
      appearance_count: questionsForConcept.length,
      exams: examsList,
      questions: questionsForConcept,
    });
  });

  // Filter only genuinely repeated concepts (appearance_count > 1) and sort descending
  return stats
    .filter((item) => item.appearance_count > 1)
    .sort((a, b) => b.appearance_count - a.appearance_count);
}

// ---------------- Weakness Analysis -----------------
export async function getWeaknessMetrics(studentId = 'default_student'): Promise<WeaknessMetric[]> {
  const [allQuestions, allConcepts, allChapters, allSubjects] = await Promise.all([
    getQuestions(),
    getConcepts(),
    getChapters(),
    getSubjects(),
  ]);

  let relevantAnswers: StudentAnswer[] = [];

  if (supabase) {
    try {
      const { data: attempts } = await supabase.from('student_attempts').select('id').eq('student_id', studentId);
      if (attempts && attempts.length > 0) {
        const attemptIds = attempts.map((a) => a.id);
        const { data: answers } = await supabase.from('student_answers').select('*').in('attempt_id', attemptIds);
        if (answers) relevantAnswers = answers;
      }
    } catch (e) {
      console.warn('Error fetching weakness metrics from Supabase:', e);
    }
  }

  if (relevantAnswers.length === 0) {
    const store = readLocalStore();
    const studentAttempts = store.student_attempts.filter((a) => a.student_id === studentId);
    const attemptIds = studentAttempts.map((a) => a.id);
    relevantAnswers = store.student_answers.filter((ans) => attemptIds.includes(ans.attempt_id));
  }

  // Tally by concept
  const conceptStats = new Map<
    string,
    { total: number; correct: number; incorrect: number }
  >();

  relevantAnswers.forEach((ans) => {
    const q = allQuestions.find((item) => item.id === ans.question_id);
    if (!q || !q.concept_id) return;

    const current = conceptStats.get(q.concept_id) || { total: 0, correct: 0, incorrect: 0 };
    current.total += 1;
    if (ans.is_correct) {
      current.correct += 1;
    } else {
      current.incorrect += 1;
    }
    conceptStats.set(q.concept_id, current);
  });

  const chapterMap = new Map(allChapters.map((c) => [c.id, c]));
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));

  const metrics: WeaknessMetric[] = [];

  allConcepts.forEach((concept) => {
    const stat = conceptStats.get(concept.id);
    const chapter = chapterMap.get(concept.chapter_id);
    const subject = chapter ? subjectMap.get(chapter.subject_id) : undefined;

    const total = stat?.total || 0;
    const correct = stat?.correct || 0;
    const incorrect = stat?.incorrect || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 100;
    const isWeak = total > 0 && accuracy < 70;

    metrics.push({
      subject_id: subject?.id || '',
      subject_name: subject?.name || 'Unassigned Subject',
      chapter_id: chapter?.id || '',
      chapter_name: chapter?.name || 'Unassigned Chapter',
      concept_id: concept.id,
      concept_name: concept.name,
      total_attempts: total,
      correct_count: correct,
      incorrect_count: incorrect,
      accuracy_percentage: accuracy,
      is_weak: isWeak,
    });
  });

  // Sort so weakest concepts (accuracy ascending, attempts descending) appear first
  return metrics.sort((a, b) => {
    if (a.is_weak && !b.is_weak) return -1;
    if (!a.is_weak && b.is_weak) return 1;
    return a.accuracy_percentage - b.accuracy_percentage;
  });
}

// ---------------- Global Search -----------------
export async function searchContent(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { exams: [], modules: [], subjects: [], chapters: [], concepts: [], questions: [] };

  const [allExams, allModules, allSubjects, allChapters, allConcepts, allQuestions] = await Promise.all([
    getExams(),
    getModules(),
    getSubjects(),
    getChapters(),
    getConcepts(),
    getQuestions(),
  ]);

  const exams = allExams
    .filter((e) => e.title.toLowerCase().includes(q) || (e.instructions && e.instructions.toLowerCase().includes(q)))
    .slice(0, 5);

  const modules = allModules
    .filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
    .slice(0, 5);

  const subjects = allSubjects
    .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
    .slice(0, 5);

  const chapters = allChapters
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 5);

  const concepts = allConcepts
    .filter((c) => c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)))
    .slice(0, 5);

  const questions = allQuestions
    .filter((item) => item.question_text.toLowerCase().includes(q) || (item.clinical_vignette && item.clinical_vignette.toLowerCase().includes(q)))
    .slice(0, 5);

  return { exams, modules, subjects, chapters, concepts, questions };
}

// ---------------- Stats -----------------
export async function getPlatformStats(studentId = 'default_student') {
  const [allYears, allModules, allSubjects, allChapters, allConcepts, allExams, allQuestions] = await Promise.all([
    getAcademicYears(),
    getModules(),
    getSubjects(),
    getChapters(),
    getConcepts(),
    getExams(),
    getQuestions(),
  ]);

  let studentAttempts: StudentAttempt[] = [];
  let studentAnswers: StudentAnswer[] = [];

  if (supabase) {
    try {
      const { data: attempts } = await supabase.from('student_attempts').select('*').eq('student_id', studentId);
      if (attempts && attempts.length > 0) {
        studentAttempts = attempts;
        const attemptIds = attempts.map((a) => a.id);
        const { data: answers } = await supabase.from('student_answers').select('*').in('attempt_id', attemptIds);
        if (answers) studentAnswers = answers;
      }
    } catch (e) {
      console.warn('Error fetching platform student stats from Supabase:', e);
    }
  }

  if (studentAttempts.length === 0) {
    const store = readLocalStore();
    studentAttempts = store.student_attempts.filter((a) => a.student_id === studentId);
    studentAnswers = store.student_answers.filter((ans) =>
      studentAttempts.some((a) => a.id === ans.attempt_id)
    );
  }

  const questionsAnswered = studentAnswers.length;
  const correctCount = studentAnswers.filter((ans) => ans.is_correct).length;
  const overallAccuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;
  const bookmarksCount = 0;

  return {
    total_years: allYears.length,
    total_modules: allModules.length,
    total_subjects: allSubjects.length,
    total_chapters: allChapters.length,
    total_concepts: allConcepts.length,
    total_exams: allExams.length,
    total_questions: allQuestions.length,
    completed_exams: studentAttempts.filter((a) => a.mode === 'complete_exam').length,
    total_attempts: studentAttempts.length,
    questions_answered: questionsAnswered,
    overall_accuracy: overallAccuracy,
    bookmarks_count: bookmarksCount,
    recent_attempts: studentAttempts.slice(0, 5),
  };
}

// ---------------- Reset/Seed & Clean Slate Wipe -----------------
export async function wipeDatabaseCleanSlate(): Promise<void> {
  // 1. Wipe Supabase tables in strict reverse foreign-key order (preserve admins)
  if (supabase) {
    try {
      const tables = [
        'student_answers',
        'student_attempts',
        'bookmarks',
        'exam_questions',
        'explanations',
        'answer_choices',
        'questions',
        'exams',
        'concepts',
        'chapters',
        'subjects',
        'modules',
        'academic_years',
      ];
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().not('id', 'is', null);
        if (error) {
          console.error(`[Clean Slate] Error clearing table ${table}:`, error);
        }
      }
    } catch (err) {
      console.error('[Clean Slate] Fatal error clearing Supabase:', err);
    }
  }

  // 2. Wipe local store (preserving existing admins)
  const store = readLocalStore();
  const existingAdmins = store.admins && store.admins.length > 0 ? store.admins : [];
  const emptyStore: DatabaseStore = {
    academic_years: [],
    modules: [],
    subjects: [],
    chapters: [],
    concepts: [],
    exams: [],
    questions: [],
    answer_choices: [],
    explanations: [],
    exam_questions: [],
    bookmarks: [],
    student_attempts: [],
    student_answers: [],
    admins: existingAdmins,
  };
  writeLocalStore(emptyStore);
}

export async function mergeModules(sourceModuleId: string, targetModuleId: string): Promise<{
  success: boolean;
  message: string;
  moved_questions: number;
  moved_exams: number;
  moved_subjects: number;
}> {
  const store = readLocalStore();
  const sourceMod = store.modules.find((m) => m.id === sourceModuleId);
  const targetMod = store.modules.find((m) => m.id === targetModuleId);

  if (!sourceMod || !targetMod) {
    // If not found in local store, check Supabase
    if (supabase) {
      const { data: mods } = await supabase.from('modules').select('*').in('id', [sourceModuleId, targetModuleId]);
      if (!mods || mods.length < 2) {
        throw new Error('One or both modules could not be found.');
      }
    } else {
      throw new Error('One or both modules could not be found.');
    }
  }

  const targetYearId = targetMod?.academic_year_id || store.academic_years[0]?.id || 'year-1';

  // 1. Move exams
  let movedExams = 0;
  store.exams.forEach((e) => {
    if (e.module_id === sourceModuleId) {
      e.module_id = targetModuleId;
      e.academic_year_id = targetYearId;
      movedExams++;
    }
  });

  // 2. Move & deduplicate subjects and chapters
  let movedSubjects = 0;
  const sourceSubjects = store.subjects.filter((s) => s.module_id === sourceModuleId);
  const subjectsToDeleteFromLocal: string[] = [];
  const chaptersToDeleteFromLocal: string[] = [];

  for (const sSub of sourceSubjects) {
    const matchingTargetSub = store.subjects.find(
      (t) => t.module_id === targetModuleId && t.name.trim().toLowerCase() === sSub.name.trim().toLowerCase()
    );

    if (matchingTargetSub) {
      // Merge sSub into matchingTargetSub
      subjectsToDeleteFromLocal.push(sSub.id);
      const sChapters = store.chapters.filter((c) => c.subject_id === sSub.id);

      for (const sChap of sChapters) {
        const matchingTargetChap = store.chapters.find(
          (tc) => tc.subject_id === matchingTargetSub.id && tc.name.trim().toLowerCase() === sChap.name.trim().toLowerCase()
        );

        if (matchingTargetChap) {
          chaptersToDeleteFromLocal.push(sChap.id);
          store.concepts.forEach((con) => {
            if (con.chapter_id === sChap.id) con.chapter_id = matchingTargetChap.id;
          });
          store.questions.forEach((q) => {
            if (q.chapter_id === sChap.id) {
              q.chapter_id = matchingTargetChap.id;
              q.subject_id = matchingTargetSub.id;
              q.module_id = targetModuleId;
              q.academic_year_id = targetYearId;
            }
          });

          if (supabase) {
            try {
              await supabase.from('concepts').update({ chapter_id: matchingTargetChap.id }).eq('chapter_id', sChap.id);
              await supabase.from('questions').update({
                chapter_id: matchingTargetChap.id,
                subject_id: matchingTargetSub.id,
                module_id: targetModuleId,
                academic_year_id: targetYearId,
              }).eq('chapter_id', sChap.id);
              await supabase.from('chapters').delete().eq('id', sChap.id);
            } catch (err) {
              console.error('[mergeModules] Supabase chapter merge error:', err);
            }
          }
        } else {
          // Move chapter to matchingTargetSub
          sChap.subject_id = matchingTargetSub.id;
          store.questions.forEach((q) => {
            if (q.chapter_id === sChap.id) {
              q.subject_id = matchingTargetSub.id;
              q.module_id = targetModuleId;
              q.academic_year_id = targetYearId;
            }
          });

          if (supabase) {
            try {
              await supabase.from('chapters').update({ subject_id: matchingTargetSub.id }).eq('id', sChap.id);
              await supabase.from('questions').update({
                subject_id: matchingTargetSub.id,
                module_id: targetModuleId,
                academic_year_id: targetYearId,
              }).eq('chapter_id', sChap.id);
            } catch (err) {
              console.error('[mergeModules] Supabase chapter move error:', err);
            }
          }
        }
      }

      // Reassign any remaining questions for sSub
      store.questions.forEach((q) => {
        if (q.subject_id === sSub.id) {
          q.subject_id = matchingTargetSub.id;
          q.module_id = targetModuleId;
          q.academic_year_id = targetYearId;
        }
      });

      if (supabase) {
        try {
          await supabase.from('questions').update({
            subject_id: matchingTargetSub.id,
            module_id: targetModuleId,
            academic_year_id: targetYearId,
          }).eq('subject_id', sSub.id);
          await supabase.from('subjects').delete().eq('id', sSub.id);
        } catch (err) {
          console.error('[mergeModules] Supabase subject delete error:', err);
        }
      }
    } else {
      // No duplicate subject, simply repoint to target module
      sSub.module_id = targetModuleId;
      movedSubjects++;
      store.questions.forEach((q) => {
        if (q.subject_id === sSub.id) {
          q.module_id = targetModuleId;
          q.academic_year_id = targetYearId;
        }
      });

      if (supabase) {
        try {
          await supabase.from('subjects').update({ module_id: targetModuleId }).eq('id', sSub.id);
        } catch (err) {
          console.error('[mergeModules] Supabase subject move error:', err);
        }
      }
    }
  }

  // Remove merged local subjects and chapters
  store.subjects = store.subjects.filter((s) => !subjectsToDeleteFromLocal.includes(s.id));
  store.chapters = store.chapters.filter((c) => !chaptersToDeleteFromLocal.includes(c.id));

  // 3. Move questions
  let movedQuestions = 0;
  store.questions.forEach((q) => {
    if (q.module_id === sourceModuleId) {
      q.module_id = targetModuleId;
      q.academic_year_id = targetYearId;
      movedQuestions++;
    }
  });

  // 4. Remove source module from local store
  store.modules = store.modules.filter((m) => m.id !== sourceModuleId);
  writeLocalStore(store);

  // 5. Update Supabase if available
  if (supabase) {
    try {
      const { data: movedExData } = await supabase
        .from('exams')
        .update({ module_id: targetModuleId, academic_year_id: targetYearId })
        .eq('module_id', sourceModuleId)
        .select('id');
      if (movedExData) movedExams = Math.max(movedExams, movedExData.length);

      const { data: movedQData } = await supabase
        .from('questions')
        .update({ module_id: targetModuleId, academic_year_id: targetYearId })
        .eq('module_id', sourceModuleId)
        .select('id');
      if (movedQData) movedQuestions = Math.max(movedQuestions, movedQData.length);

      await supabase.from('modules').delete().eq('id', sourceModuleId);
    } catch (err) {
      console.error('[mergeModules] Supabase error:', err);
    }
  }

  return {
    success: true,
    message: `Successfully merged module into "${targetMod?.name || targetModuleId}". Moved ${movedQuestions} questions, ${movedExams} exams, and ${movedSubjects} subjects.`,
    moved_questions: movedQuestions,
    moved_exams: movedExams,
    moved_subjects: movedSubjects,
  };
}

export async function resetDatabaseWithSeed(): Promise<void> {
  // 1. Wipe Supabase tables in strict reverse foreign-key order (preserve admins)
  if (supabase) {
    try {
      const tables = [
        'student_answers',
        'student_attempts',
        'bookmarks',
        'exam_questions',
        'explanations',
        'answer_choices',
        'questions',
        'exams',
        'concepts',
        'chapters',
        'subjects',
        'modules',
        'academic_years',
      ];
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().not('id', 'is', null);
        if (error) {
          console.error(`[Database Reset] Error clearing table ${table}:`, error);
        }
      }
    } catch (err) {
      console.error('[Database Reset] Fatal error clearing Supabase:', err);
    }
  }

  // 2. Wipe local store (preserving existing admins)
  const store = readLocalStore();
  const existingAdmins = store.admins && store.admins.length > 0 ? store.admins : [];
  const seed = generateSeedData();
  seed.admins = existingAdmins;
  writeLocalStore(seed);
}

// ---------------- Database Health & Diagnostics -----------------
export async function getDatabaseStatus() {
  const cfg = getStorageConfig();
  const isConfigured = Boolean(supabaseUrl && supabaseKey);
  let isSupabaseReachable = false;
  let latencyMs = 0;

  if (isConfigured && supabase) {
    try {
      const start = Date.now();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Ping timeout')), 1800)
      );
      await Promise.race([
        supabase.from('academic_years').select('id').limit(1),
        timeoutPromise,
      ]);
      latencyMs = Date.now() - start;
      isSupabaseReachable = true;
    } catch {
      isSupabaseReachable = false;
    }
  }

  const store = readLocalStore();
  const activeSource = (cfg.mode === 'local_only' || !isConfigured || !isSupabaseReachable) ? 'local' : 'supabase';

  return {
    mode: cfg.mode,
    auto_sync_enabled: cfg.auto_sync_enabled,
    last_synced_at: cfg.last_synced_at,
    isSupabaseConfigured: isConfigured,
    isSupabaseReachable,
    activeSource,
    latencyMs,
    stats: {
      questions: store.questions.length,
      exams: store.exams.length,
      academic_years: store.academic_years.length,
      modules: store.modules.length,
      subjects: store.subjects.length,
      chapters: store.chapters.length,
      concepts: store.concepts.length,
      attempts: store.student_attempts.length,
      bookmarks: store.bookmarks.length,
    },
  };
}

// ---------------- Cloud-to-Local Synchronization -----------------
export async function syncCloudToLocal(): Promise<{
  success: boolean;
  message: string;
  syncedStats?: {
    exams: number;
    questions: number;
    concepts: number;
  };
}> {
  const isConfigured = Boolean(supabaseUrl && supabaseKey);
  if (!isConfigured || !supabase) {
    recordLastSync();
    return {
      success: true,
      message: 'قاعدة البيانات المحلية تعمل بكامل بياناتها المحدثة محلياً (المزامنة مع السحابة غير مفعلة لعدم وجود مفاتيح اتصال).',
      syncedStats: { exams: 0, questions: 0, concepts: 0 },
    };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('انتهت مهلة الاتصال بالسحابة (Timeout)')), 4500)
    );

    const fetchAllPromise = Promise.all([
      supabase.from('academic_years').select('*'),
      supabase.from('modules').select('*'),
      supabase.from('subjects').select('*'),
      supabase.from('chapters').select('*'),
      supabase.from('concepts').select('*'),
      supabase.from('exams').select('*'),
      supabase.from('questions').select('*'),
      supabase.from('answer_choices').select('*'),
      supabase.from('explanations').select('*'),
      supabase.from('exam_questions').select('*'),
    ]);

    const [
      yearsRes,
      modulesRes,
      subjectsRes,
      chaptersRes,
      conceptsRes,
      examsRes,
      questionsRes,
      choicesRes,
      explanationsRes,
      examQuestionsRes,
    ] = (await Promise.race([fetchAllPromise, timeoutPromise])) as any[];

    const store = readLocalStore();
    let newExamsCount = 0;
    let newQuestionsCount = 0;

    function mergeAuthoritativeCloud<T extends { id: string }>(localArr: T[], cloudArr: T[] | null | undefined): { merged: T[]; addedCount: number } {
      if (!cloudArr || cloudArr.length === 0) return { merged: localArr, addedCount: 0 };
      return { merged: cloudArr, addedCount: cloudArr.length };
    }

    if (!yearsRes?.error && yearsRes?.data) store.academic_years = yearsRes.data;
    if (!modulesRes?.error && modulesRes?.data) store.modules = modulesRes.data;
    if (!subjectsRes?.error && subjectsRes?.data) store.subjects = subjectsRes.data;
    if (!chaptersRes?.error && chaptersRes?.data) store.chapters = chaptersRes.data;
    if (!conceptsRes?.error && conceptsRes?.data) store.concepts = conceptsRes.data;

    if (!examsRes?.error && examsRes?.data) {
      store.exams = examsRes.data.map((e: any) => ({
        ...e,
        exam_type: (e.exam_type === 'midterm' || e.exam_type === 'end_module') ? 'end_module' : (e.exam_type || 'final'),
      }));
      newExamsCount = examsRes.data.length;
    }

    if (!questionsRes?.error && questionsRes?.data) {
      store.questions = questionsRes.data;
      newQuestionsCount = questionsRes.data.length;
    }

    if (!choicesRes?.error && choicesRes?.data) store.answer_choices = choicesRes.data;
    if (!explanationsRes?.error && explanationsRes?.data) store.explanations = explanationsRes.data;
    if (!examQuestionsRes?.error && examQuestionsRes?.data) store.exam_questions = examQuestionsRes.data;

    // Persist to local disk
    writeLocalStore(store);

    const now = new Date().toISOString();
    recordLastSync(now);

    return {
      success: true,
      message: `تمت مزامنة التحديثات السحابية بنجاح! تم تنزيل ${newExamsCount} امتحانات جديدة و ${newQuestionsCount} أسئلة وتحديث النسخة المحلية.`,
      syncedStats: {
        exams: newExamsCount,
        questions: newQuestionsCount,
        concepts: conceptsRes?.data?.length || 0,
      },
    };
  } catch (err) {
    console.warn('[Sync Engine] Error during cloud-to-local sync:', err);
    return {
      success: false,
      message: `تعذرت المزامنة: ${(err as Error).message}`,
    };
  }
}

// ==========================================
// ADMIN USER REPOSITORY & VERIFICATION
// ==========================================

export async function getAdmins(): Promise<AdminUser[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id, username, email, full_name, is_active, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Error fetching admins from Supabase:', e);
    }
  }
  const store = readLocalStore();
  return (store.admins || []).map(({ password: _, ...rest }) => rest as AdminUser);
}

export async function createAdmin(data: Omit<AdminUser, 'id'>): Promise<AdminUser> {
  const newAdmin: AdminUser = {
    ...data,
    id: `admin-${Date.now()}`,
    is_active: data.is_active ?? true,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from('admins')
        .insert([newAdmin])
        .select('id, username, email, full_name, is_active, created_at')
        .single();
      if (!error && inserted) return inserted;
    } catch (e) {
      console.warn('Error inserting admin in Supabase:', e);
    }
  }

  const store = readLocalStore();
  if (!store.admins) store.admins = [];
  store.admins.push(newAdmin);
  writeLocalStore(store);

  const { password: _, ...safeAdmin } = newAdmin;
  return safeAdmin as AdminUser;
}

export async function deleteAdmin(id: string): Promise<boolean> {
  if (supabase) {
    try {
      const { error } = await supabase.from('admins').delete().eq('id', id);
      if (!error) return true;
    } catch (e) {
      console.warn('Error deleting admin from Supabase:', e);
    }
  }
  const store = readLocalStore();
  if (store.admins) {
    store.admins = store.admins.filter((a) => a.id !== id);
    writeLocalStore(store);
  }
  return true;
}

export async function verifyAdminInDatabase(password: string, username?: string): Promise<{ valid: boolean; admin?: AdminUser }> {
  if (!password) return { valid: false };

  // 1. Check Supabase
  if (supabase) {
    try {
      let query = supabase.from('admins').select('*').eq('is_active', true);
      if (username && username.trim()) {
        const u = username.trim().toLowerCase();
        query = query.or(`username.ilike.${u},email.ilike.${u}`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const match = data.find((a: any) => a.password === password.trim());
        if (match) {
          const { password: _, ...safeAdmin } = match;
          return { valid: true, admin: safeAdmin };
        }
      }
    } catch (err) {
      console.warn('Could not query Supabase admins table:', err);
    }
  }

  // 2. Check Local Store
  const store = readLocalStore();
  if (store.admins && store.admins.length > 0) {
    const match = store.admins.find((a) => {
      if (!a.is_active) return false;
      if (username && username.trim()) {
        const u = username.trim().toLowerCase();
        const matchesUser = a.username.toLowerCase() === u || (a.email && a.email.toLowerCase() === u);
        return matchesUser && a.password === password.trim();
      }
      return a.password === password.trim();
    });
    if (match) {
      const { password: _, ...safeAdmin } = match;
      return { valid: true, admin: safeAdmin };
    }
  }

  return { valid: false };
}

