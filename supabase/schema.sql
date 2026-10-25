-- ====================================================================
-- UNIVERSAL MEDICAL EXAMS PLATFORM — SUPABASE POSTGRESQL SCHEMA
-- Ready for direct deployment on Supabase
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ACADEMIC YEARS
CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY DEFAULT ('year-' || floor(extract(epoch from now()) * 1000)::text),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  order_index INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MODULES (Belongs to Academic Year)
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY DEFAULT ('mod-' || floor(extract(epoch from now()) * 1000)::text),
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Layers',
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SUBJECTS (Belongs to Module)
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY DEFAULT ('sub-' || floor(extract(epoch from now()) * 1000)::text),
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen',
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CHAPTERS (Belongs to Subject)
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY DEFAULT ('chap-' || floor(extract(epoch from now()) * 1000)::text),
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chapter_number INTEGER,
  description TEXT,
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CONCEPTS (Belongs to Chapter)
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY DEFAULT ('con-' || floor(extract(epoch from now()) * 1000)::text),
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  importance_level TEXT CHECK (importance_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'high',
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. EXAMS (Academic Year -> Module -> Exam)
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY DEFAULT ('exam-' || floor(extract(epoch from now()) * 1000)::text),
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_type TEXT CHECK (exam_type IN ('final', 'midterm', 'quiz', 'mock', 'shelf')) DEFAULT 'final',
  term TEXT,
  academic_period TEXT,
  duration_minutes INTEGER DEFAULT 60,
  passing_score INTEGER DEFAULT 70,
  instructions TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. QUESTIONS (Generic, linked to hierarchy)
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY DEFAULT ('q-' || floor(extract(epoch from now()) * 1000)::text),
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
  module_id TEXT REFERENCES modules(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  concept_id TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  clinical_vignette TEXT,
  image_url TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. ANSWER CHOICES (Dynamic choice count: A, B, C, D, E...)
CREATE TABLE IF NOT EXISTS answer_choices (
  id TEXT PRIMARY KEY DEFAULT ('c-' || floor(extract(epoch from now()) * 1000)::text),
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice_letter TEXT NOT NULL,
  choice_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 1
);

-- 10. EXPLANATIONS (Per-choice + Source document citations)
CREATE TABLE IF NOT EXISTS explanations (
  id TEXT PRIMARY KEY DEFAULT ('exp-' || floor(extract(epoch from now()) * 1000)::text),
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice_id TEXT REFERENCES answer_choices(id) ON DELETE SET NULL,
  choice_letter TEXT,
  explanation_text TEXT NOT NULL,
  is_why_correct BOOLEAN DEFAULT false,
  is_why_incorrect BOOLEAN DEFAULT false,
  source_document TEXT,
  source_page TEXT,
  source_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. EXAM QUESTIONS (Many-to-Many: Questions can belong to multiple exams)
CREATE TABLE IF NOT EXISTS exam_questions (
  id TEXT PRIMARY KEY DEFAULT ('eq-' || floor(extract(epoch from now()) * 1000)::text),
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 1,
  UNIQUE(exam_id, question_id)
);

-- 12. BOOKMARKS (Important, Review Later, Not Understood)
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY DEFAULT ('bm-' || floor(extract(epoch from now()) * 1000)::text),
  student_id TEXT NOT NULL DEFAULT 'default_student',
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('important', 'review_later', 'not_understood')) DEFAULT 'important',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, question_id)
);

-- 13. STUDENT ATTEMPTS
CREATE TABLE IF NOT EXISTS student_attempts (
  id TEXT PRIMARY KEY DEFAULT ('att-' || floor(extract(epoch from now()) * 1000)::text),
  student_id TEXT NOT NULL DEFAULT 'default_student',
  mode TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_questions INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  unanswered_count INTEGER DEFAULT 0,
  score_percentage NUMERIC DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. STUDENT ANSWERS
CREATE TABLE IF NOT EXISTS student_answers (
  id TEXT PRIMARY KEY DEFAULT ('ans-' || floor(extract(epoch from now()) * 1000)::text),
  attempt_id TEXT NOT NULL REFERENCES student_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_choice_id TEXT REFERENCES answer_choices(id) ON DELETE SET NULL,
  is_correct BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  time_taken_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_modules_academic_year ON modules(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_subjects_module ON subjects(module_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_concepts_chapter ON concepts(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_hierarchy ON questions(academic_year_id, module_id, subject_id, chapter_id, concept_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_question ON exam_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_answer_choices_q ON answer_choices(question_id);
CREATE INDEX IF NOT EXISTS idx_explanations_q ON explanations(question_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_student ON bookmarks(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON student_attempts(student_id);

-- ROW LEVEL SECURITY (Optional for Supabase, can be open or user-scoped)
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

-- Curriculum and Exam tables access policies (Read & Write for management)
CREATE POLICY "Public full access academic_years" ON academic_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access modules" ON modules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access chapters" ON chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access concepts" ON concepts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access exams" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access questions" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access answer_choices" ON answer_choices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access explanations" ON explanations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access exam_questions" ON exam_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Student read-write bookmarks" ON bookmarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Student read-write attempts" ON student_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Student read-write answers" ON student_answers FOR ALL USING (true) WITH CHECK (true);
