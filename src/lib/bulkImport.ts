import { AcademicYear, Module, Subject, Chapter, Concept, Exam, Question, AnswerChoice, ExplanationItem } from './types';
import { readLocalStore, writeLocalStore, syncLocalStoreToSupabase, syncCloudToLocal, DatabaseStore } from './db';
import {
  ParsedChoice,
  ParsedQuestion,
  ParsedExamPayload,
  parseBulkExamText,
} from './examTextParser';

export type { ParsedChoice, ParsedQuestion, ParsedExamPayload };
export { parseBulkExamText };

function importSingleExamIntoStore(
  payload: ParsedExamPayload,
  store: DatabaseStore,
  timestamp: number
): { examId: string; examTitle: string; count: number } {
  // 1. Resolve or Create Academic Year
  const safeYearName = (payload.academic_year_name || '').trim();
  let yearObj = store.academic_years.find(
    (y: AcademicYear) =>
      safeYearName &&
      (y.name.trim().toLowerCase() === safeYearName.toLowerCase() ||
       y.name.toLowerCase().includes(safeYearName.toLowerCase()) ||
       safeYearName.toLowerCase().includes(y.name.toLowerCase()))
  );
  if (!yearObj && safeYearName) {
    const uniqueYearCode = `Y-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    yearObj = {
      id: `year-${timestamp}`,
      name: safeYearName,
      code: uniqueYearCode,
      description: `Academic year created via bulk import`,
      order_index: store.academic_years.length + 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    store.academic_years.push(yearObj);
  } else if (!yearObj) {
    yearObj = store.academic_years[0] || {
      id: `year-${timestamp}`,
      name: 'General Medical Year',
      code: `MED-GEN-${timestamp}`,
      order_index: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    if (!store.academic_years.some((y) => y.id === yearObj!.id)) store.academic_years.push(yearObj);
  }

  // 2. Resolve or Create Module
  const safeModuleName = (payload.module_name || '').trim();
  let moduleObj: Module | undefined = store.modules.find(
    (m: Module) =>
      m.academic_year_id === yearObj.id &&
      safeModuleName &&
      (m.name.trim().toLowerCase() === safeModuleName.toLowerCase() ||
       m.name.toLowerCase().includes(safeModuleName.toLowerCase()) ||
       safeModuleName.toLowerCase().includes(m.name.toLowerCase()))
  );
  if (!moduleObj && safeModuleName) {
    const uniqueModCode = `MOD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    moduleObj = {
      id: `mod-${timestamp}`,
      academic_year_id: yearObj.id,
      name: safeModuleName,
      code: uniqueModCode,
      description: `Module created via bulk import`,
      order_index: store.modules.length + 1,
      created_at: new Date().toISOString(),
    };
    store.modules.push(moduleObj);
  } else if (!moduleObj) {
    moduleObj = store.modules.find((m: Module) => m.academic_year_id === yearObj.id) || store.modules[0] || {
      id: `mod-${timestamp}`,
      academic_year_id: yearObj.id,
      name: 'Integrated Systems',
      code: `MOD-${timestamp}`,
      order_index: 1,
      created_at: new Date().toISOString(),
    };
    if (!store.modules.some((m: Module) => m.id === moduleObj!.id)) store.modules.push(moduleObj);
  }

  const finalModuleObj: Module = moduleObj;

  // 3. Resolve or Create the Exam
  const targetExamTitle = (payload.exam_title || `Medical Examination ${new Date().toLocaleDateString()}`).trim();
  let existingExam = store.exams.find(
    (e: Exam) =>
      e.module_id === finalModuleObj.id &&
      e.title.trim().toLowerCase() === targetExamTitle.toLowerCase()
  );
  const examId = existingExam ? existingExam.id : `exam-${timestamp}`;
  if (!existingExam) {
    existingExam = {
      id: examId,
      academic_year_id: yearObj.id,
      module_id: finalModuleObj.id,
      title: targetExamTitle,
      exam_type: payload.exam_type === 'end_module' ? 'end_module' : 'final',
      duration_minutes: payload.duration_minutes || 60,
      passing_score: payload.passing_score || 70,
      instructions: payload.instructions || 'Answer all questions to the best of your ability.',
      is_published: true,
      created_at: new Date().toISOString(),
    };
    store.exams.push(existingExam);
  }
  const examTitle = existingExam.title;

  // 4. Process and insert each question
  const safeQuestions = Array.isArray(payload.questions) ? payload.questions : [];
  safeQuestions.forEach((q, idx) => {
    const qTimestamp = timestamp + idx;
    const newQId = `q-${qTimestamp}`;

    // Resolve or create Subject
    const targetSubName = (q.subject_name || payload.default_subject_name || 'Medical Sciences').trim();
    let subjectObj = store.subjects.find(
      (s: Subject) =>
        s.module_id === finalModuleObj.id &&
        (s.name.trim().toLowerCase() === targetSubName.toLowerCase() ||
         s.name.toLowerCase().includes(targetSubName.toLowerCase()) ||
         targetSubName.toLowerCase().includes(s.name.toLowerCase()))
    );
    if (!subjectObj) {
      subjectObj = {
        id: `sub-${qTimestamp}`,
        module_id: finalModuleObj.id,
        name: targetSubName,
        code: `SUB-${Date.now()}-${store.subjects.length + 1}`,
        description: `Subject created via bulk import`,
        order_index: store.subjects.length + 1,
        created_at: new Date().toISOString(),
      };
      store.subjects.push(subjectObj);
    }

    // Resolve or create Chapter
    const targetChapName = (q.chapter_name || payload.default_chapter_name || 'Core Curriculum Chapter').trim();
    let chapterObj = store.chapters.find(
      (c: Chapter) =>
        c.subject_id === subjectObj.id &&
        (c.name.trim().toLowerCase() === targetChapName.toLowerCase() ||
         c.name.toLowerCase().includes(targetChapName.toLowerCase()) ||
         targetChapName.toLowerCase().includes(c.name.toLowerCase()))
    );
    if (!chapterObj) {
      chapterObj = {
        id: `chap-${qTimestamp}`,
        subject_id: subjectObj.id,
        name: targetChapName,
        chapter_number: store.chapters.filter((c: Chapter) => c.subject_id === subjectObj.id).length + 1,
        order_index: store.chapters.length + 1,
        created_at: new Date().toISOString(),
      };
      store.chapters.push(chapterObj);
    }

    // Resolve or create Concept
    const targetConcName = (q.concept_name || payload.default_concept_name || 'High-Yield Clinical Concept').trim();
    let conceptObj = store.concepts.find(
      (c: Concept) =>
        c.chapter_id === chapterObj.id &&
        (c.name.trim().toLowerCase() === targetConcName.toLowerCase() ||
         c.name.toLowerCase().includes(targetConcName.toLowerCase()) ||
         targetConcName.toLowerCase().includes(c.name.toLowerCase()))
    );
    if (!conceptObj) {
      conceptObj = {
        id: `concept-${qTimestamp}`,
        chapter_id: chapterObj.id,
        name: targetConcName,
        importance_level: 'high',
        order_index: store.concepts.length + 1,
        created_at: new Date().toISOString(),
      };
      store.concepts.push(conceptObj);
    }

    // Insert Question
    const questionObj: Question = {
      id: newQId,
      academic_year_id: yearObj.id,
      module_id: finalModuleObj.id,
      subject_id: subjectObj.id,
      chapter_id: chapterObj.id,
      concept_id: conceptObj.id,
      question_text: q.question_text,
      clinical_vignette: q.clinical_vignette,
      order_index: idx + 1,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    };
    store.questions.push(questionObj);

    // Link Question to Exam (avoid duplicate links)
    if (!store.exam_questions.some((eq) => eq.exam_id === examId && eq.question_id === newQId)) {
      store.exam_questions.push({
        id: `eq-${qTimestamp}`,
        exam_id: examId,
        question_id: newQId,
        order_index: idx + 1,
      });
    }

    // Insert Answer Choices and Explanations
    const safeChoices = Array.isArray(q.choices) ? q.choices : [];
    safeChoices.forEach((c, cIdx) => {
      const choiceId = `c-${newQId}-${cIdx}`;
      const choiceObj: AnswerChoice = {
        id: choiceId,
        question_id: newQId,
        choice_letter: c.letter,
        choice_text: c.text,
        is_correct: c.is_correct,
        order_index: cIdx + 1,
      };
      store.answer_choices.push(choiceObj);

      if (c.explanation || c.is_correct) {
        const explanationObj: ExplanationItem = {
          id: `exp-${choiceId}`,
          question_id: newQId,
          choice_id: choiceId,
          choice_letter: c.letter,
          explanation_text: c.explanation || (c.is_correct ? 'Correct medical answer.' : 'Incorrect option.'),
          is_why_correct: c.is_correct,
          is_why_incorrect: !c.is_correct,
          source_document: c.source_document || 'Core Medical Literature',
          source_page: c.source_page || 'p. Reference',
          source_reference: c.source_reference || 'Core Curriculum',
          created_at: new Date().toISOString(),
        };
        store.explanations.push(explanationObj);
      }
    });
  });

  return { examId, examTitle, count: safeQuestions.length };
}

/**
 * Execute the bulk import into the local database and link all hierarchy elements.
 * Supports importing single or multiple exams in a single transaction.
 */
export async function executeBulkImport(payload: ParsedExamPayload): Promise<{
  success: boolean;
  exam_id: string;
  exam_title: string;
  questions_count: number;
  imported_exams_count?: number;
}> {
  // 1. Sync latest cloud state first so IDs match existing Supabase entities
  try {
    await syncCloudToLocal();
  } catch (err) {
    console.warn('[BulkImport] Cloud sync warning, using local state:', err);
  }

  const store = readLocalStore();
  const timestamp = Date.now();

  if (payload.all_exams && payload.all_exams.length > 1) {
    let totalQuestions = 0;
    const examTitles: string[] = [];
    let firstExamId = '';

    payload.all_exams.forEach((singlePayload, idx) => {
      const res = importSingleExamIntoStore(singlePayload, store, timestamp + (idx * 5000));
      if (!firstExamId) firstExamId = res.examId;
      totalQuestions += res.count;
      examTitles.push(res.examTitle);
    });

    writeLocalStore(store);
    try {
      await syncLocalStoreToSupabase(store);
    } catch (err) {
      console.error('[BulkImport] Error syncing to Supabase:', err);
    }

    return {
      success: true,
      exam_id: firstExamId,
      exam_title: `${payload.all_exams.length} Exams: ${examTitles.join(' + ')}`,
      questions_count: totalQuestions,
      imported_exams_count: payload.all_exams.length,
    };
  }

  const res = importSingleExamIntoStore(payload, store, timestamp);
  writeLocalStore(store);
  try {
    await syncLocalStoreToSupabase(store);
  } catch (err) {
    console.error('[BulkImport] Error syncing to Supabase:', err);
  }

  return {
    success: true,
    exam_id: res.examId,
    exam_title: res.examTitle,
    questions_count: res.count,
    imported_exams_count: 1,
  };
}
