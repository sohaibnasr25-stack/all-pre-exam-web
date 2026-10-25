import fs from 'fs';
import path from 'path';
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

// Local file storage fallback path
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

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

// Ensure database file exists on disk
export function readLocalStore(): DatabaseStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const seed = generateSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading db.json, re-initializing seed:', err);
    const seed = generateSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

export function writeLocalStore(store: DatabaseStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
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
    if (!error && data && data.length > 0) return data;
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
  if (supabase) {
    const { error } = await supabase.from('academic_years').delete().eq('id', id);
    if (!error) return true;
  }

  const store = readLocalStore();
  store.academic_years = store.academic_years.filter((y) => y.id !== id);
  writeLocalStore(store);
  return true;
}

// ---------------- Modules -----------------
export async function getModules(academicYearId?: string): Promise<Module[]> {
  if (supabase) {
    let query = supabase.from('modules').select('*, academic_year:academic_years(*)');
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data && data.length > 0) return data;
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
  if (supabase) {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (!error) return true;
  }

  const store = readLocalStore();
  store.modules = store.modules.filter((m) => m.id !== id);
  writeLocalStore(store);
  return true;
}

// ---------------- Subjects -----------------
export async function getSubjects(moduleId?: string): Promise<Subject[]> {
  if (supabase) {
    let query = supabase.from('subjects').select('*, module:modules(*)');
    if (moduleId) query = query.eq('module_id', moduleId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data && data.length > 0) return data;
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
  if (supabase) {
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (!error) return true;
  }

  const store = readLocalStore();
  store.subjects = store.subjects.filter((s) => s.id !== id);
  writeLocalStore(store);
  return true;
}

// ---------------- Chapters -----------------
export async function getChapters(subjectId?: string): Promise<Chapter[]> {
  if (supabase) {
    let query = supabase.from('chapters').select('*, subject:subjects(*)');
    if (subjectId) query = query.eq('subject_id', subjectId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data && data.length > 0) return data;
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
  if (supabase) {
    const { error } = await supabase.from('chapters').delete().eq('id', id);
    if (!error) return true;
  }

  const store = readLocalStore();
  store.chapters = store.chapters.filter((c) => c.id !== id);
  writeLocalStore(store);
  return true;
}

// ---------------- Concepts -----------------
export async function getConcepts(chapterId?: string): Promise<Concept[]> {
  if (supabase) {
    let query = supabase.from('concepts').select('*, chapter:chapters(*)');
    if (chapterId) query = query.eq('chapter_id', chapterId);
    const { data, error } = await query.order('order_index', { ascending: true });
    if (!error && data && data.length > 0) return data;
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
  if (supabase) {
    const { error } = await supabase.from('concepts').delete().eq('id', id);
    if (!error) return true;
  }

  const store = readLocalStore();
  store.concepts = store.concepts.filter((c) => c.id !== id);
  writeLocalStore(store);
  return true;
}

// ---------------- Exams -----------------
export async function getExams(filters?: { academic_year_id?: string; module_id?: string }): Promise<Exam[]> {
  const store = readLocalStore();
  let list = store.exams;

  if (filters?.academic_year_id) {
    list = list.filter((e) => e.academic_year_id === filters.academic_year_id);
  }
  if (filters?.module_id) {
    list = list.filter((e) => e.module_id === filters.module_id);
  }

  return list.map((e) => {
    const count = store.exam_questions.filter((eq) => eq.exam_id === e.id).length;
    const lastAttempt = store.student_attempts
      .filter((a) => a.entity_id === e.id && a.is_completed)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      ...e,
      question_count: count,
      academic_year: store.academic_years.find((y) => y.id === e.academic_year_id),
      module: store.modules.find((m) => m.id === e.module_id),
      completion_status: lastAttempt ? 'completed' : 'not_started',
      previous_score: lastAttempt?.score_percentage,
    };
  });
}

export async function getExam(id: string): Promise<Exam | null> {
  const store = readLocalStore();
  const exam = store.exams.find((e) => e.id === id);
  if (!exam) return null;
  const count = store.exam_questions.filter((eq) => eq.exam_id === exam.id).length;
  return {
    ...exam,
    question_count: count,
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
  return newExam;
}

export async function updateExam(
  id: string,
  updates: Partial<Exam> & { question_ids?: string[] }
): Promise<Exam | null> {
  const store = readLocalStore();
  const index = store.exams.findIndex((e) => e.id === id);
  if (index === -1) return null;

  store.exams[index] = { ...store.exams[index], ...updates };

  if (updates.question_ids) {
    // Re-link questions
    store.exam_questions = store.exam_questions.filter((eq) => eq.exam_id !== id);
    updates.question_ids.forEach((qid, idx) => {
      store.exam_questions.push({
        id: `eq-${Date.now()}-${idx}`,
        exam_id: id,
        question_id: qid,
        order_index: idx + 1,
      });
    });
  }

  writeLocalStore(store);
  return store.exams[index];
}

export async function deleteExam(id: string): Promise<boolean> {
  const store = readLocalStore();
  store.exams = store.exams.filter((e) => e.id !== id);
  store.exam_questions = store.exam_questions.filter((eq) => eq.exam_id !== id);
  writeLocalStore(store);
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
  const store = readLocalStore();
  const qIndex = store.questions.findIndex((q) => q.id === id);
  if (qIndex === -1) return null;

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
  return true;
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
  const store = readLocalStore();
  const allQuestions = await getQuestions();

  // Group questions by concept
  const conceptMap = new Map<string, Question[]>();
  allQuestions.forEach((q) => {
    if (!q.concept_id) return;
    const existing = conceptMap.get(q.concept_id) || [];
    existing.push(q);
    conceptMap.set(q.concept_id, existing);
  });

  const stats: RepeatedConceptStat[] = [];

  conceptMap.forEach((questionsForConcept, conceptId) => {
    const conceptObj = store.concepts.find((c) => c.id === conceptId);
    if (!conceptObj) return;

    const chapterObj = store.chapters.find((ch) => ch.id === conceptObj.chapter_id);
    const subjectObj = chapterObj ? store.subjects.find((s) => s.id === chapterObj.subject_id) : undefined;
    const moduleObj = subjectObj ? store.modules.find((m) => m.id === subjectObj.module_id) : undefined;
    const yearObj = moduleObj ? store.academic_years.find((y) => y.id === moduleObj.academic_year_id) : undefined;

    // Collect distinct exams where questions of this concept appear
    const examMap = new Map<string, { id: string; title: string; year_name?: string }>();
    questionsForConcept.forEach((q) => {
      q.exams?.forEach((e) => {
        if (!examMap.has(e.id)) {
          const year = store.academic_years.find((y) => y.id === e.academic_year_id);
          examMap.set(e.id, {
            id: e.id,
            title: e.title,
            year_name: year?.name,
          });
        }
      });
    });

    const examsList = Array.from(examMap.values());

    stats.push({
      concept_id: conceptId,
      concept_name: conceptObj.name,
      subject_id: subjectObj?.id,
      subject_name: subjectObj?.name || 'Integrated Medicine',
      module_id: moduleObj?.id,
      module_name: moduleObj?.name,
      academic_year_id: yearObj?.id,
      academic_year_name: yearObj?.name,
      chapter_id: chapterObj?.id,
      chapter_name: chapterObj?.name || 'General Concepts',
      appearance_count: questionsForConcept.length,
      exams: examsList,
      questions: questionsForConcept,
    });
  });

  // Sort by appearance count descending (repeated concepts at the top!)
  return stats.sort((a, b) => b.appearance_count - a.appearance_count);
}

// ---------------- Weakness Analysis -----------------
export async function getWeaknessMetrics(studentId = 'default_student'): Promise<WeaknessMetric[]> {
  const store = readLocalStore();
  const allQuestions = await getQuestions();

  // Find all answers by student
  const studentAttempts = store.student_attempts.filter((a) => a.student_id === studentId);
  const attemptIds = studentAttempts.map((a) => a.id);
  const relevantAnswers = store.student_answers.filter((ans) => attemptIds.includes(ans.attempt_id));

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

  const metrics: WeaknessMetric[] = [];

  store.concepts.forEach((concept) => {
    const stat = conceptStats.get(concept.id);
    const chapter = store.chapters.find((ch) => ch.id === concept.chapter_id);
    const subject = chapter ? store.subjects.find((s) => s.id === chapter.subject_id) : undefined;

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

  const store = readLocalStore();

  const exams = store.exams
    .filter((e) => e.title.toLowerCase().includes(q) || (e.instructions && e.instructions.toLowerCase().includes(q)))
    .slice(0, 5);

  const modules = store.modules
    .filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
    .slice(0, 5);

  const subjects = store.subjects
    .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
    .slice(0, 5);

  const chapters = store.chapters
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, 5);

  const concepts = store.concepts
    .filter((c) => c.name.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q)))
    .slice(0, 5);

  const questions = store.questions
    .filter((item) => item.question_text.toLowerCase().includes(q) || (item.clinical_vignette && item.clinical_vignette.toLowerCase().includes(q)))
    .slice(0, 5);

  return { exams, modules, subjects, chapters, concepts, questions };
}

// ---------------- Stats -----------------
export async function getPlatformStats(studentId = 'default_student') {
  const store = readLocalStore();
  const attempts = store.student_attempts.filter((a) => a.student_id === studentId);
  const questionsAnswered = store.student_answers.length;
  const correctCount = store.student_answers.filter((ans) => ans.is_correct).length;
  const overallAccuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;
  const bookmarksCount = store.bookmarks.filter((b) => b.student_id === studentId).length;

  return {
    total_years: store.academic_years.length,
    total_modules: store.modules.length,
    total_subjects: store.subjects.length,
    total_chapters: store.chapters.length,
    total_concepts: store.concepts.length,
    total_exams: store.exams.length,
    total_questions: store.questions.length,
    completed_exams: attempts.filter((a) => a.mode === 'complete_exam').length,
    total_attempts: attempts.length,
    questions_answered: questionsAnswered,
    overall_accuracy: overallAccuracy,
    bookmarks_count: bookmarksCount,
    recent_attempts: attempts.slice(0, 5),
  };
}

// ---------------- Reset/Seed -----------------
export async function resetDatabaseWithSeed(): Promise<void> {
  const store = readLocalStore();
  const existingAdmins = store.admins || [];
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

    function mergeById<T extends { id: string }>(localArr: T[], cloudArr: T[] | null | undefined): { merged: T[]; addedCount: number } {
      if (!cloudArr || cloudArr.length === 0) return { merged: localArr, addedCount: 0 };
      const map = new Map<string, T>();
      localArr.forEach((item) => map.set(item.id, item));
      let added = 0;
      cloudArr.forEach((item) => {
        if (!map.has(item.id)) added += 1;
        map.set(item.id, { ...map.get(item.id), ...item });
      });
      return { merged: Array.from(map.values()), addedCount: added };
    }

    if (yearsRes?.data) store.academic_years = mergeById(store.academic_years, yearsRes.data).merged;
    if (modulesRes?.data) store.modules = mergeById(store.modules, modulesRes.data).merged;
    if (subjectsRes?.data) store.subjects = mergeById(store.subjects, subjectsRes.data).merged;
    if (chaptersRes?.data) store.chapters = mergeById(store.chapters, chaptersRes.data).merged;
    if (conceptsRes?.data) store.concepts = mergeById(store.concepts, conceptsRes.data).merged;

    if (examsRes?.data) {
      const { merged, addedCount } = mergeById(store.exams, examsRes.data);
      store.exams = merged;
      newExamsCount = addedCount;
    }

    if (questionsRes?.data) {
      const { merged, addedCount } = mergeById(store.questions, questionsRes.data);
      store.questions = merged;
      newQuestionsCount = addedCount;
    }

    if (choicesRes?.data) store.answer_choices = mergeById(store.answer_choices, choicesRes.data).merged;
    if (explanationsRes?.data) store.explanations = mergeById(store.explanations, explanationsRes.data).merged;
    if (examQuestionsRes?.data) store.exam_questions = mergeById(store.exam_questions, examQuestionsRes.data).merged;

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

