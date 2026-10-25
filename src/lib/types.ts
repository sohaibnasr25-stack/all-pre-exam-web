export interface AcademicYear {
  id: string;
  name: string;
  code: string;
  description?: string;
  order_index: number;
  is_active: boolean;
  created_at?: string;
}

export interface Module {
  id: string;
  academic_year_id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  order_index: number;
  created_at?: string;
  academic_year?: AcademicYear;
}

export interface Subject {
  id: string;
  module_id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  order_index: number;
  created_at?: string;
  module?: Module;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  chapter_number?: number;
  description?: string;
  order_index: number;
  created_at?: string;
  subject?: Subject;
}

export interface Concept {
  id: string;
  chapter_id: string;
  name: string;
  code?: string;
  description?: string;
  importance_level?: 'low' | 'medium' | 'high' | 'critical';
  order_index: number;
  created_at?: string;
  chapter?: Chapter;
}

export interface Exam {
  id: string;
  academic_year_id: string;
  module_id: string;
  title: string;
  exam_type: 'end_module' | 'final' | string;
  term?: string;
  academic_period?: string;
  duration_minutes: number;
  passing_score: number;
  instructions?: string;
  is_published: boolean;
  created_at?: string;
  academic_year?: AcademicYear;
  module?: Module;
  question_count?: number;
  completion_status?: 'not_started' | 'in_progress' | 'completed';
  previous_score?: number;
}

export interface AnswerChoice {
  id: string;
  question_id: string;
  choice_letter: string; // 'A' | 'B' | 'C' | 'D' | 'E' ...
  choice_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface ExplanationItem {
  id: string;
  question_id: string;
  choice_id?: string | null; // specific to choice or general
  choice_letter?: string | null;
  explanation_text: string;
  is_why_correct?: boolean;
  is_why_incorrect?: boolean;
  source_document?: string; // Lecture note, textbook name
  source_page?: string; // Exact page e.g. "p. 214"
  source_reference?: string; // Chapter, slide number, or section
  created_at?: string;
}

export interface Question {
  id: string;
  academic_year_id: string;
  module_id: string;
  subject_id: string;
  chapter_id: string;
  concept_id: string;
  question_text: string;
  clinical_vignette?: string;
  image_url?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  order_index: number;
  created_at?: string;
  
  // Relations
  academic_year?: AcademicYear;
  module?: Module;
  subject?: Subject;
  chapter?: Chapter;
  concept?: Concept;
  answer_choices: AnswerChoice[];
  explanations: ExplanationItem[];
  exam_ids?: string[];
  exams?: Exam[];
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_id: string;
  order_index: number;
}

export type BookmarkCategory = 'important' | 'review_later' | 'not_understood';

export interface Bookmark {
  id: string;
  student_id: string;
  question_id: string;
  category: BookmarkCategory;
  notes?: string;
  created_at: string;
  question?: Question;
}

export interface StudentAttempt {
  id: string;
  student_id: string;
  mode: 'complete_exam' | 'subject_practice' | 'chapter_practice' | 'concept_practice' | 'retry_mode' | 'bookmarks_practice' | 'repeated_concept';
  entity_id: string;
  title: string;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  score_percentage: number;
  time_spent_seconds: number;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  answers?: StudentAnswer[];
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_choice_id: string | null;
  is_correct: boolean;
  is_flagged?: boolean;
  time_taken_seconds?: number;
  created_at: string;
}

export interface RepeatedConceptStat {
  concept_id: string;
  concept_name: string;
  subject_id?: string;
  subject_name: string;
  module_id?: string;
  module_name?: string;
  academic_year_id?: string;
  academic_year_name?: string;
  chapter_id?: string;
  chapter_name: string;
  appearance_count: number;
  exams: {
    id: string;
    title: string;
    year_name?: string;
  }[];
  questions: Question[];
}

export interface WeaknessMetric {
  subject_id: string;
  subject_name: string;
  chapter_id: string;
  chapter_name: string;
  concept_id: string;
  concept_name: string;
  total_attempts: number;
  correct_count: number;
  incorrect_count: number;
  accuracy_percentage: number;
  is_weak: boolean; // accuracy < 70%
}
