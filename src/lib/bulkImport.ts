import { AcademicYear, Module, Subject, Chapter, Concept, Exam, Question, AnswerChoice, ExplanationItem } from './types';
import { readLocalStore, writeLocalStore, DatabaseStore } from './db';
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
  let yearObj = store.academic_years.find(
    (y: AcademicYear) =>
      payload.academic_year_name &&
      y.name.toLowerCase().includes(payload.academic_year_name.toLowerCase())
  );
  if (!yearObj && payload.academic_year_name) {
    yearObj = {
      id: `year-${timestamp}`,
      name: payload.academic_year_name,
      code: `Y-${store.academic_years.length + 1}`,
      description: `Academic year created via bulk import`,
      order_index: store.academic_years.length + 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    store.academic_years.push(yearObj);
  } else if (!yearObj) {
    yearObj = store.academic_years[0] || {
      id: `year-default`,
      name: 'General Medical Year',
      code: 'MED-GEN',
      order_index: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    if (!store.academic_years.length) store.academic_years.push(yearObj);
  }

  // 2. Resolve or Create Module
  let moduleObj: Module | undefined = store.modules.find(
    (m: Module) =>
      payload.module_name &&
      m.name.toLowerCase().includes(payload.module_name.toLowerCase())
  );
  if (!moduleObj && payload.module_name) {
    moduleObj = {
      id: `mod-${timestamp}`,
      academic_year_id: yearObj.id,
      name: payload.module_name,
      code: `MOD-${store.modules.length + 1}`,
      description: `Module created via bulk import`,
      order_index: store.modules.length + 1,
      created_at: new Date().toISOString(),
    };
    store.modules.push(moduleObj);
  } else if (!moduleObj) {
    moduleObj = store.modules.find((m: Module) => m.academic_year_id === yearObj.id) || store.modules[0] || {
      id: `mod-default`,
      academic_year_id: yearObj.id,
      name: 'Integrated Systems',
      code: 'MOD-INT',
      order_index: 1,
      created_at: new Date().toISOString(),
    };
    if (!store.modules.some((m: Module) => m.id === moduleObj!.id)) store.modules.push(moduleObj);
  }

  const finalModuleObj: Module = moduleObj;

  // 3. Create the Exam
  const examId = `exam-${timestamp}`;
  const newExam: Exam = {
    id: examId,
    academic_year_id: yearObj.id,
    module_id: finalModuleObj.id,
    title: payload.exam_title || `Medical Examination ${new Date().toLocaleDateString()}`,
    exam_type: payload.exam_type === 'end_module' ? 'end_module' : 'final',
    duration_minutes: payload.duration_minutes || 60,
    passing_score: payload.passing_score || 70,
    instructions: payload.instructions || 'Answer all questions to the best of your ability.',
    is_published: true,
    created_at: new Date().toISOString(),
  };
  store.exams.push(newExam);

  // 4. Process and insert each question
  const safeQuestions = Array.isArray(payload.questions) ? payload.questions : [];
  safeQuestions.forEach((q, idx) => {
    const qTimestamp = timestamp + idx;
    const newQId = `q-${qTimestamp}`;

    // Resolve or create Subject
    const targetSubName = q.subject_name || payload.default_subject_name || 'Medical Sciences';
    let subjectObj = store.subjects.find((s: Subject) => s.name.toLowerCase() === targetSubName.toLowerCase());
    if (!subjectObj) {
      subjectObj = {
        id: `sub-${qTimestamp}`,
        module_id: finalModuleObj.id,
        name: targetSubName,
        code: `SUB-${store.subjects.length + 1}`,
        description: `Subject created via bulk import`,
        order_index: store.subjects.length + 1,
        created_at: new Date().toISOString(),
      };
      store.subjects.push(subjectObj);
    }

    // Resolve or create Chapter
    const targetChapName = q.chapter_name || payload.default_chapter_name || 'Core Curriculum Chapter';
    let chapterObj = store.chapters.find(
      (c: Chapter) => c.subject_id === subjectObj.id && c.name.toLowerCase() === targetChapName.toLowerCase()
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
    const targetConcName = q.concept_name || payload.default_concept_name || 'High-Yield Clinical Concept';
    let conceptObj = store.concepts.find(
      (c: Concept) => c.chapter_id === chapterObj.id && c.name.toLowerCase() === targetConcName.toLowerCase()
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

    // Link Question to Exam
    store.exam_questions.push({
      id: `eq-${qTimestamp}`,
      exam_id: examId,
      question_id: newQId,
      order_index: idx + 1,
    });

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

  return { examId, examTitle: newExam.title, count: safeQuestions.length };
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

  return {
    success: true,
    exam_id: res.examId,
    exam_title: res.examTitle,
    questions_count: res.count,
    imported_exams_count: 1,
  };
}
