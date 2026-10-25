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

// Initial Rich Seed Data for Universal Medical Platform
function generateSeedData(): DatabaseStore {
  const academic_years: AcademicYear[] = [
    {
      id: 'year-1',
      name: 'Year 1: Pre-Clinical Sciences',
      code: 'MED-Y1',
      description: 'Foundations of biomedical sciences, histology, anatomy, and cellular physiology',
      order_index: 1,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'year-2',
      name: 'Year 2: Organ Systems & Pathophysiology',
      code: 'MED-Y2',
      description: 'Integrated organ systems, mechanisms of disease, pathology, and systemic pharmacology',
      order_index: 2,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'year-3',
      name: 'Year 3: Clinical Clerkship & Diagnostics',
      code: 'MED-Y3',
      description: 'Internal medicine, surgical principles, diagnostic reasoning, and therapeutics',
      order_index: 3,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const modules: Module[] = [
    {
      id: 'mod-cvs',
      academic_year_id: 'year-1',
      name: 'Cardiovascular System',
      code: 'CVS-101',
      description: 'Heart anatomy, cardiac hemodynamics, vascular control, and electrophysiology',
      icon: 'Heart',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mod-resp',
      academic_year_id: 'year-1',
      name: 'Respiratory System',
      code: 'RESP-102',
      description: 'Pulmonary mechanics, alveolar gas exchange, ventilation-perfusion dynamics',
      icon: 'Wind',
      order_index: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mod-renal',
      academic_year_id: 'year-2',
      name: 'Renal & Acid-Base Homeostasis',
      code: 'RENAL-201',
      description: 'Glomerular filtration, tubular transport, fluid-electrolyte balance, and renal failure',
      icon: 'Droplets',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mod-neuro',
      academic_year_id: 'year-2',
      name: 'Neuroscience & Special Senses',
      code: 'NEURO-202',
      description: 'Central and peripheral nervous system pathology, neuropharmacology, and cranial nerves',
      icon: 'Brain',
      order_index: 2,
      created_at: new Date().toISOString(),
    },
  ];

  const subjects: Subject[] = [
    {
      id: 'sub-physio',
      module_id: 'mod-cvs',
      name: 'Medical Physiology',
      code: 'PHY-CVS',
      description: 'Cellular and organ system physiological processes and compensatory reflexes',
      icon: 'Activity',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sub-pharm',
      module_id: 'mod-cvs',
      name: 'Medical Pharmacology',
      code: 'PHA-CVS',
      description: 'Drug classes, pharmacokinetics, molecular targets, and adverse drug reactions',
      icon: 'Pill',
      order_index: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sub-patho',
      module_id: 'mod-cvs',
      name: 'Systemic Pathology',
      code: 'PAT-CVS',
      description: 'Histopathological changes, etiology, morphologic patterns, and disease progression',
      icon: 'Microscope',
      order_index: 3,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sub-resp-phys',
      module_id: 'mod-resp',
      name: 'Pulmonary Physiology',
      code: 'PHY-RESP',
      description: 'Gas diffusion, compliance, spirometry, and ventilation control',
      icon: 'Lungs',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sub-renal-phys',
      module_id: 'mod-renal',
      name: 'Renal Physiology & Nephrology',
      code: 'PHY-RENAL',
      description: 'Tubular handling of sodium, potassium, water, and acid-base regulation',
      icon: 'Flame',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
  ];

  const chapters: Chapter[] = [
    {
      id: 'chap-electrophys',
      subject_id: 'sub-physio',
      name: 'Cardiac Electrophysiology & Rhythm',
      chapter_number: 1,
      description: 'Action potential generation, pacemaker channels, conductive velocity, and ECG vectors',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'chap-hemodynamics',
      subject_id: 'sub-physio',
      name: 'Hemodynamics & Cardiac Mechanics',
      chapter_number: 2,
      description: 'Pressure-volume loops, preload, afterload, inotropy, and arterial blood pressure control',
      order_index: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: 'chap-antiarrhythmics',
      subject_id: 'sub-pharm',
      name: 'Antiarrhythmic Pharmacotherapy',
      chapter_number: 1,
      description: 'Vaughan-Williams classes I-IV, adenosine, digoxin, and proarrhythmic toxicity',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'chap-ischemic',
      subject_id: 'sub-patho',
      name: 'Ischemic Heart Disease & Myocardial Infarction',
      chapter_number: 1,
      description: 'Plaque rupture, coronary occlusion, coagulative necrosis, and post-MI complications',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'chap-gas-exchange',
      subject_id: 'sub-resp-phys',
      name: 'Alveolar Gas Exchange & Hypoxemia',
      chapter_number: 1,
      description: 'A-a gradient, shunt vs dead space, Fick principle, and diffusion limitations',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'chap-acid-base',
      subject_id: 'sub-renal-phys',
      name: 'Acid-Base Derangements & Anion Gap',
      chapter_number: 1,
      description: 'Metabolic acidosis, Winter formula compensation, renal bicarbonate reabsorption',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
  ];

  const concepts: Concept[] = [
    {
      id: 'con-pacemaker',
      chapter_id: 'chap-electrophys',
      name: 'Phase 4 Pacemaker Depolarization & If Channels',
      code: 'CON-CVS-001',
      description: 'Role of hyperpolarization-activated cyclic nucleotide-gated (HCN) funny currents in SA nodal rhythmicity',
      importance_level: 'critical',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'con-frank-starling',
      chapter_id: 'chap-hemodynamics',
      name: 'Frank-Starling Relationship & Preload Regulation',
      code: 'CON-CVS-002',
      description: 'Length-tension relationship in cardiac myocytes and its impact on stroke volume and cardiac output',
      importance_level: 'critical',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'con-qt-prolongation',
      chapter_id: 'chap-antiarrhythmics',
      name: 'Class III K+ Channel Blockade & Torsades de Pointes',
      code: 'CON-PHA-001',
      description: 'Delayed rectifier potassium current inhibition leading to prolonged repolarization and polymorphic ventricular tachycardia',
      importance_level: 'high',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'con-post-mi-timeline',
      chapter_id: 'chap-ischemic',
      name: 'Histopathological Timeline of Acute Myocardial Infarction',
      code: 'CON-PAT-001',
      description: 'Sequence of microscopic cardiac changes from wavy fibers, neutrophil infiltration, macrophage clearing, to scar maturation',
      importance_level: 'critical',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'con-aa-gradient',
      chapter_id: 'chap-gas-exchange',
      name: 'Alveolar-Arterial (A-a) Oxygen Gradient Interpretation',
      code: 'CON-RES-001',
      description: 'Differentiating hypoxemia mechanisms: normal vs elevated A-a gradient under room air',
      importance_level: 'high',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 'con-anion-gap',
      chapter_id: 'chap-acid-base',
      name: 'High Anion Gap Metabolic Acidosis (MUDPILES / GOLD MARK)',
      code: 'CON-REN-001',
      description: 'Calculation of unmeasured serum anions and differential diagnosis of ketoacidosis, lactic acidosis, and toxins',
      importance_level: 'critical',
      order_index: 1,
      created_at: new Date().toISOString(),
    },
  ];

  const exams: Exam[] = [
    {
      id: 'exam-cvs-final-2024',
      academic_year_id: 'year-1',
      module_id: 'mod-cvs',
      title: 'Cardiovascular Integrated Final Examination — 2024',
      exam_type: 'final',
      term: 'Semester 1',
      academic_period: '2023-2024',
      duration_minutes: 60,
      passing_score: 70,
      instructions: 'Standard clinical vignette MCQs. Select the single best answer. Each question contains full reference justification.',
      is_published: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'exam-resp-midterm-2024',
      academic_year_id: 'year-1',
      module_id: 'mod-resp',
      title: 'Pulmonary Mechanics & Gas Diffusion End Module Examination — 2024',
      exam_type: 'end_module',
      term: 'Semester 2',
      academic_period: '2023-2024',
      duration_minutes: 45,
      passing_score: 65,
      instructions: 'Focused on blood-gas analysis, pulmonary pressures, and clinical scenarios.',
      is_published: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'exam-renal-shelf-2025',
      academic_year_id: 'year-2',
      module_id: 'mod-renal',
      title: 'Renal Pathophysiology & Acid-Base Clinical End Module — 2025',
      exam_type: 'end_module',
      term: 'Semester 1',
      academic_period: '2024-2025',
      duration_minutes: 75,
      passing_score: 70,
      instructions: 'Comprehensive organ pathology and diagnostic acid-base calculations.',
      is_published: true,
      created_at: new Date().toISOString(),
    },
  ];

  const questions: Question[] = [
    {
      id: 'q-1',
      academic_year_id: 'year-1',
      module_id: 'mod-cvs',
      subject_id: 'sub-physio',
      chapter_id: 'chap-electrophys',
      concept_id: 'con-pacemaker',
      question_text: 'A 68-year-old male with chronic stable angina and resting heart rate of 88 bpm is prescribed ivabradine. Which phase of the sinoatrial nodal action potential does this medication selectively inhibit?',
      clinical_vignette: 'The patient has moderate systolic heart failure and cannot tolerate further uptitration of beta-adrenergic antagonists due to symptomatic hypotension and reactive airway disease.',
      difficulty: 'medium',
      order_index: 1,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
    {
      id: 'q-2',
      academic_year_id: 'year-1',
      module_id: 'mod-cvs',
      subject_id: 'sub-physio',
      chapter_id: 'chap-hemodynamics',
      concept_id: 'con-frank-starling',
      question_text: 'In an isolated canine cardiac muscle experiment, increasing the initial resting length of ventricular sarcomeres from 1.8 µm to 2.2 µm produces a marked increase in active tension generation. Which molecular mechanism primarily accounts for this phenomenon?',
      clinical_vignette: 'This physiological property forms the primary biological basis of the Frank-Starling law of the heart.',
      difficulty: 'hard',
      order_index: 2,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
    {
      id: 'q-3',
      academic_year_id: 'year-1',
      module_id: 'mod-cvs',
      subject_id: 'sub-pharm',
      chapter_id: 'chap-antiarrhythmics',
      concept_id: 'con-qt-prolongation',
      question_text: 'A 54-year-old woman receiving oral sotalol for paroxysmal atrial fibrillation presents to the emergency department with syncope. Telemetry reveals runs of polymorphic ventricular tachycardia with twisting of the QRS complexes around the isoelectric line. What is the fundamental electrophysiologic trigger responsible for this arrhythmia?',
      clinical_vignette: 'Her baseline 12-lead ECG demonstrates a corrected QT (QTc) interval of 560 ms. Serum potassium is 3.1 mEq/L and magnesium is 1.4 mg/dL.',
      difficulty: 'medium',
      order_index: 3,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
    {
      id: 'q-4',
      academic_year_id: 'year-1',
      module_id: 'mod-cvs',
      subject_id: 'sub-patho',
      chapter_id: 'chap-ischemic',
      concept_id: 'con-post-mi-timeline',
      question_text: 'An autopsy is conducted on a 62-year-old man who succumbed to sudden cardiogenic shock 4 days after an acute anterior wall myocardial infarction. Histological examination of the infarcted myocardium is most likely to demonstrate which of the following findings?',
      clinical_vignette: 'Post-mortem examination reveals transmural myocardial infarction in the distribution of the left anterior descending coronary artery.',
      difficulty: 'hard',
      order_index: 4,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
    {
      id: 'q-5',
      academic_year_id: 'year-1',
      module_id: 'mod-resp',
      subject_id: 'sub-resp-phys',
      chapter_id: 'chap-gas-exchange',
      concept_id: 'con-aa-gradient',
      question_text: 'A 24-year-old male is brought to the emergency department after an unintentional opioid overdose. Arterial blood gas on room air shows: pH 7.24, PaCO2 62 mmHg, PaO2 58 mmHg, HCO3- 26 mEq/L. Assuming a respiratory quotient of 0.8, which statement best characterizes his alveolar-arterial (A-a) oxygen gradient?',
      clinical_vignette: 'Patient has pinpoint pupils and shallow breathing at 6 breaths per minute. He has no prior cardiopulmonary medical history.',
      difficulty: 'hard',
      order_index: 1,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
    {
      id: 'q-6',
      academic_year_id: 'year-2',
      module_id: 'mod-renal',
      subject_id: 'sub-renal-phys',
      chapter_id: 'chap-acid-base',
      concept_id: 'con-anion-gap',
      question_text: 'A 19-year-old female with type 1 diabetes presents with nausea, vomiting, abdominal pain, and Kussmaul respirations. Laboratory evaluation reveals: Na+ 132 mEq/L, K+ 5.4 mEq/L, Cl- 94 mEq/L, HCO3- 10 mEq/L, Glucose 480 mg/dL. What is her serum anion gap, and what is the primary pathophysiologic cause?',
      clinical_vignette: 'Urinalysis reveals 4+ ketones and 3+ glucose. Serum beta-hydroxybutyrate is markedly elevated.',
      difficulty: 'medium',
      order_index: 1,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
    {
      id: 'q-7',
      academic_year_id: 'year-1',
      module_id: 'mod-cvs',
      subject_id: 'sub-pharm',
      chapter_id: 'chap-antiarrhythmics',
      concept_id: 'con-qt-prolongation',
      question_text: 'Which of the following antiarrhythmic agents carries the highest risk of QTc prolongation through block of rapid delayed rectifier potassium current (IKr), while paradoxically maintaining a relatively low clinical incidence of Torsades de Pointes?',
      clinical_vignette: 'The drug possesses mixed Class I, II, III, and IV electrophysiological properties and has extensive tissue accumulation with a half-life of 40-55 days.',
      difficulty: 'medium',
      order_index: 5,
      created_at: new Date().toISOString(),
      answer_choices: [],
      explanations: [],
    },
  ];

  const answer_choices: AnswerChoice[] = [
    // Q1 Choices
    { id: 'c-1-a', question_id: 'q-1', choice_letter: 'A', choice_text: 'Phase 0 rapid sodium influx through voltage-gated Nav1.5 channels', is_correct: false, order_index: 1 },
    { id: 'c-1-b', question_id: 'q-1', choice_letter: 'B', choice_text: 'Phase 4 spontaneous slow diastolic depolarization mediated by funny (If) inward mixed Na+/K+ currents', is_correct: true, order_index: 2 },
    { id: 'c-1-c', question_id: 'q-1', choice_letter: 'C', choice_text: 'Phase 2 plateau maintained by L-type calcium channel activation', is_correct: false, order_index: 3 },
    { id: 'c-1-d', question_id: 'q-1', choice_letter: 'D', choice_text: 'Phase 3 rapid repolarization through delayed rectifier potassium channels', is_correct: false, order_index: 4 },

    // Q2 Choices
    { id: 'c-2-a', question_id: 'q-2', choice_letter: 'A', choice_text: 'Increased sensitivity of troponin C to intracellular Ca2+ and optimal actin-myosin overlap geometry', is_correct: true, order_index: 1 },
    { id: 'c-2-b', question_id: 'q-2', choice_letter: 'B', choice_text: 'Phosphorylation of phospholamban by cyclic AMP-dependent protein kinase A', is_correct: false, order_index: 2 },
    { id: 'c-2-c', question_id: 'q-2', choice_letter: 'C', choice_text: 'Enhanced extracellular sodium efflux via the 3Na+/2K+ ATPase pump', is_correct: false, order_index: 3 },
    { id: 'c-2-d', question_id: 'q-2', choice_letter: 'D', choice_text: 'Direct opening of ryanodine receptors independent of transsarcolemmal calcium influx', is_correct: false, order_index: 4 },

    // Q3 Choices
    { id: 'c-3-a', question_id: 'q-3', choice_letter: 'A', choice_text: 'Delayed afterdepolarizations (DADs) triggered by intracellular calcium overload in Phase 4', is_correct: false, order_index: 1 },
    { id: 'c-3-b', question_id: 'q-3', choice_letter: 'B', choice_text: 'Early afterdepolarizations (EADs) occurring during prolonged Phase 2 or Phase 3 repolarization', is_correct: true, order_index: 2 },
    { id: 'c-3-c', question_id: 'q-3', choice_letter: 'C', choice_text: 'Anatomical reentry circuit around an infarcted myocardial scar border zone', is_correct: false, order_index: 3 },
    { id: 'c-3-d', question_id: 'q-3', choice_letter: 'D', choice_text: 'Loss of vagal efferent transmission at the atrioventricular junction', is_correct: false, order_index: 4 },

    // Q4 Choices
    { id: 'c-4-a', question_id: 'q-4', choice_letter: 'A', choice_text: 'Wavy myocardial fibers with contraction band necrosis and early edema without cellular infiltrate', is_correct: false, order_index: 1 },
    { id: 'c-4-b', question_id: 'q-4', choice_letter: 'B', choice_text: 'Dense neutrophil infiltration with extensive karyorrhexis and early macrophage-mediated disintegration of necrotic myocytes', is_correct: true, order_index: 2 },
    { id: 'c-4-c', question_id: 'q-4', choice_letter: 'C', choice_text: 'Established dense hypocellular collagen scar with extensive neovascular capillary regression', is_correct: false, order_index: 3 },
    { id: 'c-4-d', question_id: 'q-4', choice_letter: 'D', choice_text: 'Granulation tissue with abundant proliferating capillary loops and active myofibroblast collagen deposition', is_correct: false, order_index: 4 },

    // Q5 Choices
    { id: 'c-5-a', question_id: 'q-5', choice_letter: 'A', choice_text: 'Normal A-a gradient (~5 to 10 mmHg), confirming pure alveolar hypoventilation as the sole cause of hypoxemia', is_correct: true, order_index: 1 },
    { id: 'c-5-b', question_id: 'q-5', choice_letter: 'B', choice_text: 'Elevated A-a gradient (>35 mmHg), indicating acute cardiogenic pulmonary edema', is_correct: false, order_index: 2 },
    { id: 'c-5-c', question_id: 'q-5', choice_letter: 'C', choice_text: 'Elevated A-a gradient (>25 mmHg), indicating acute pulmonary embolism with ventilation-perfusion mismatch', is_correct: false, order_index: 3 },
    { id: 'c-5-d', question_id: 'q-5', choice_letter: 'D', choice_text: 'Markedly depressed A-a gradient (<0 mmHg), indicating severe diffusion barrier impairment', is_correct: false, order_index: 4 },

    // Q6 Choices
    { id: 'c-6-a', question_id: 'q-6', choice_letter: 'A', choice_text: 'Anion gap = 12 mEq/L (Normal anion gap acidosis due to bicarbonate wasting)', is_correct: false, order_index: 1 },
    { id: 'c-6-b', question_id: 'q-6', choice_letter: 'B', choice_text: 'Anion gap = 28 mEq/L (High anion gap metabolic acidosis secondary to unmeasured ketoacid anions: acetoacetate and beta-hydroxybutyrate)', is_correct: true, order_index: 2 },
    { id: 'c-6-c', question_id: 'q-6', choice_letter: 'C', choice_text: 'Anion gap = 38 mEq/L (High anion gap acidosis secondary to severe hyperchloremic expansion)', is_correct: false, order_index: 3 },
    { id: 'c-6-d', question_id: 'q-6', choice_letter: 'D', choice_text: 'Anion gap = 8 mEq/L (Low anion gap acidosis due to hypoalbuminemia)', is_correct: false, order_index: 4 },

    // Q7 Choices
    { id: 'c-7-a', question_id: 'q-7', choice_letter: 'A', choice_text: 'Procainamide', is_correct: false, order_index: 1 },
    { id: 'c-7-b', question_id: 'q-7', choice_letter: 'B', choice_text: 'Amiodarone', is_correct: true, order_index: 2 },
    { id: 'c-7-c', question_id: 'q-7', choice_letter: 'C', choice_text: 'Ibutilide', is_correct: false, order_index: 3 },
    { id: 'c-7-d', question_id: 'q-7', choice_letter: 'D', choice_text: 'Quinidine', is_correct: false, order_index: 4 },
  ];

  const explanations: ExplanationItem[] = [
    // Explanations for Q1
    {
      id: 'exp-1-main',
      question_id: 'q-1',
      choice_id: 'c-1-b',
      choice_letter: 'B',
      explanation_text: 'CORRECT: Ivabradine acts specifically on the hyperpolarization-activated cyclic nucleotide-gated (HCN) channels in the SA node. By selectively blocking the inward mixed Na+/K+ funny current (If) during Phase 4 slow diastolic depolarization, ivabradine decreases the slope of Phase 4 and slows heart rate without exerting negative inotropic or vasodilatory actions.',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'Goodman & Gilman\'s The Pharmacological Basis of Therapeutics, 14th Edition',
      source_page: 'p. 542',
      source_reference: 'Chapter 28: Pharmacotherapy of Congestive Heart Failure',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-1-a',
      question_id: 'q-1',
      choice_id: 'c-1-a',
      choice_letter: 'A',
      explanation_text: 'INCORRECT: Phase 0 in SA nodal pacemaker cells is mediated by inward calcium flow through L-type Ca2+ channels (Cav1.2), not fast voltage-gated Nav1.5 channels (which are absent or inactivated in nodal tissue). Class I antiarrhythmics block Nav1.5 in working ventricular myocytes.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Guyton and Hall Textbook of Medical Physiology, 14th Edition',
      source_page: 'p. 116',
      source_reference: 'Chapter 10: Rhythmical Excitation of the Heart',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-1-c',
      question_id: 'q-1',
      choice_id: 'c-1-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: Phase 2 plateau is prominent in working ventricular and atrial myocytes, not SA pacemaker cells which have no sustained plateau phase. Dihydropyridine and non-dihydropyridine calcium channel blockers inhibit L-type calcium channels.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Guyton and Hall Textbook of Medical Physiology, 14th Edition',
      source_page: 'p. 115',
      source_reference: 'Chapter 9: Cardiac Muscle; The Heart as a Pump',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-1-d',
      question_id: 'q-1',
      choice_id: 'c-1-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Phase 3 repolarization in the SA node is carried by outward delayed rectifier potassium currents (IKr, IKs). Class III antiarrhythmic agents block these channels, prolonging action potential duration.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Katzung\'s Basic & Clinical Pharmacology, 15th Edition',
      source_page: 'p. 251',
      source_reference: 'Chapter 14: Agents Used in Cardiac Arrhythmias',
      created_at: new Date().toISOString(),
    },

    // Explanations for Q2
    {
      id: 'exp-2-main',
      question_id: 'q-2',
      choice_id: 'c-2-a',
      choice_letter: 'A',
      explanation_text: 'CORRECT: The Frank-Starling mechanism relies on length-dependent activation of cardiac muscle. As end-diastolic sarcomere length increases toward the optimal length (~2.2 µm), reduced interfilament lattice spacing enhances cross-bridge formation and increases the affinity of troponin C for ionized calcium, producing greater contractile tension at any given cytosolic [Ca2+].',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'Boron & Boulpaep Medical Physiology, 3rd Edition',
      source_page: 'p. 518',
      source_reference: 'Chapter 22: The Heart as a Pump; Frank-Starling Law',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-2-b',
      question_id: 'q-2',
      choice_id: 'c-2-b',
      choice_letter: 'B',
      explanation_text: 'INCORRECT: Phospholamban phosphorylation by PKA occurs upon beta-1 adrenergic stimulation (positive inotropy/lusitropy) and disinhibits SERCA2a, accelerating calcium re-uptake. It is not the baseline mechanism of length-dependent passive stretch.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Boron & Boulpaep Medical Physiology, 3rd Edition',
      source_page: 'p. 520',
      source_reference: 'Chapter 22: Autonomic Regulation of Cardiac Performance',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-2-c',
      question_id: 'q-2',
      choice_id: 'c-2-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: The Na+/K+ ATPase maintains transmembrane resting electrochemical gradients. Inhibition (e.g. by digoxin), rather than increased efflux, raises intracellular Na+ and indirectly drives Ca2+ accumulation via NCX reverse mode.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Guyton and Hall Textbook of Medical Physiology, 14th Edition',
      source_page: 'p. 61',
      source_reference: 'Chapter 4: Transport of Substances Through Cell Membranes',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-2-d',
      question_id: 'q-2',
      choice_id: 'c-2-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Ryanodine receptor (RyR2) activation in cardiac myocytes is strictly dependent on calcium-induced calcium release (CICR) triggered by transsarcolemmal Ca2+ influx through L-type channels.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Guyton and Hall Textbook of Medical Physiology, 14th Edition',
      source_page: 'p. 113',
      source_reference: 'Chapter 9: Excitation-Contraction Coupling in Cardiac Muscle',
      created_at: new Date().toISOString(),
    },

    // Explanations for Q3
    {
      id: 'exp-3-main',
      question_id: 'q-3',
      choice_id: 'c-3-b',
      choice_letter: 'B',
      explanation_text: 'CORRECT: Sotalol blocks the rapid delayed rectifier potassium current (IKr), causing marked prolongation of myocardial repolarization (prolonged QT interval). When repolarization is excessively delayed, voltage-gated L-type Ca2+ channels can recover from inactivation, precipitating early afterdepolarizations (EADs). If an EAD reaches threshold during the relative refractory period, it initiates Torsades de Pointes.',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'Braunwald\'s Heart Disease: A Textbook of Cardiovascular Medicine, 12th Ed',
      source_page: 'p. 782',
      source_reference: 'Chapter 42: Mechanisms of Cardiac Arrhythmias',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-3-a',
      question_id: 'q-3',
      choice_id: 'c-3-a',
      choice_letter: 'A',
      explanation_text: 'INCORRECT: Delayed afterdepolarizations (DADs) occur after complete repolarization during Phase 4 and are driven by sarcoplasmic reticulum spontaneous calcium release causing transient inward currents (Iti). DADs are classic for digoxin toxicity, catecholaminergic polymorphic VT, and hypercalcemia.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Braunwald\'s Heart Disease, 12th Ed',
      source_page: 'p. 784',
      source_reference: 'Chapter 42: Triggered Activity & DADs',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-3-c',
      question_id: 'q-3',
      choice_id: 'c-3-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: Fixed anatomic reentry around scar tissue produces monomorphic ventricular tachycardia with uniform QRS morphology, not polymorphic Torsades de Pointes characterized by undulation of QRS axes.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Braunwald\'s Heart Disease, 12th Ed',
      source_page: 'p. 789',
      source_reference: 'Chapter 43: Ventricular Tachyarrhythmias',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-3-d',
      question_id: 'q-3',
      choice_id: 'c-3-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Vagal loss would increase sinus node automaticity and AV nodal conduction velocity, but does not generate EAD-mediated polymorphic ventricular dysrhythmias.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'The explanation is not available in the provided source files.',
      source_page: 'N/A',
      source_reference: 'Reference not cited',
      created_at: new Date().toISOString(),
    },

    // Explanations for Q4
    {
      id: 'exp-4-main',
      question_id: 'q-4',
      choice_id: 'c-4-b',
      choice_letter: 'B',
      explanation_text: 'CORRECT: At day 3 to 7 post-MI, microscopic inspection reveals dense neutrophilic infiltration undergoing apoptosis/karyorrhexis, with active phagocytosis of dead necrotic myocytes by incoming mononuclear macrophages. The necrotic muscle tissue is markedly softened, explaining why mechanical complications (such as ventricular free wall rupture, ventricular septal defect, and papillary muscle rupture) peak between days 3 and 7.',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'Robbins & Cotran Pathologic Basis of Disease, 10th Edition',
      source_page: 'p. 556',
      source_reference: 'Chapter 12: Diseases of the Heart; Myocardial Infarction Timeline',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-4-a',
      question_id: 'q-4',
      choice_id: 'c-4-a',
      choice_letter: 'A',
      explanation_text: 'INCORRECT: Wavy myocardial fibers at borders, contraction band necrosis, and early interstitial edema are characteristic of early reperfusion or acute ischemia within the first 1 to 4 hours post-infarction, before significant leukocytic invasion.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Robbins & Cotran Pathologic Basis of Disease, 10th Edition',
      source_page: 'p. 555',
      source_reference: 'Chapter 12: Morphologic Evolution of Myocardial Infarction',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-4-c',
      question_id: 'q-4',
      choice_id: 'c-4-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: Dense, acellular collagenous scar tissue requires at least 2 to 3 months to develop fully after progressive remodeling of granulation tissue.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Robbins & Cotran Pathologic Basis of Disease, 10th Edition',
      source_page: 'p. 557',
      source_reference: 'Chapter 12: Scarring & Healing of Myocardial Infarcts',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-4-d',
      question_id: 'q-4',
      choice_id: 'c-4-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Granulation tissue with budding neovessels and young loose fibroblastic stroma predominates between days 7 and 14 post-MI, as macrophage debridement winds down.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Robbins & Cotran Pathologic Basis of Disease, 10th Edition',
      source_page: 'p. 557',
      source_reference: 'Chapter 12: Granulation Phase of MI Repair',
      created_at: new Date().toISOString(),
    },

    // Explanations for Q5
    {
      id: 'exp-5-main',
      question_id: 'q-5',
      choice_id: 'c-5-a',
      choice_letter: 'A',
      explanation_text: 'CORRECT: Alveolar gas equation: PAO2 = PiO2 - (PaCO2 / R) = (150 mmHg) - (62 / 0.8) = 150 - 77.5 = 72.5 mmHg. The patient\'s measured PaO2 is 58 mmHg. Therefore, A-a gradient = PAO2 - PaO2 = 72.5 - 58 = 14.5 mmHg (normal for age, typically < 15-20 mmHg). A normal A-a gradient in the setting of severe hypoxemia and hypercapnia conclusively demonstrates central alveolar hypoventilation (opioid respiratory depression) as the sole etiology.',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'West\'s Respiratory Physiology: The Essentials, 11th Edition',
      source_page: 'p. 68',
      source_reference: 'Chapter 5: Ventilation-Perfusion Relationships; The A-a Gradient',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-5-b',
      question_id: 'q-5',
      choice_id: 'c-5-b',
      choice_letter: 'B',
      explanation_text: 'INCORRECT: Pulmonary edema produces fluid-filled alveoli with true right-to-left physiologic shunt, causing an abnormally elevated A-a gradient that fails to correct with modest supplemental O2.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'West\'s Respiratory Physiology, 11th Edition',
      source_page: 'p. 72',
      source_reference: 'Chapter 5: Physiologic Shunt and Elevated A-a Gradient',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-5-c',
      question_id: 'q-5',
      choice_id: 'c-5-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: Pulmonary embolism creates dead-space ventilation and localized V/Q mismatches with compensatory tachypnea (hypocapnia, low PaCO2) and an elevated A-a gradient, whereas this patient has respiratory bradypnea and severe hypercapnia.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'West\'s Respiratory Physiology, 11th Edition',
      source_page: 'p. 75',
      source_reference: 'Chapter 5: Pulmonary Embolism & V/Q Derangements',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-5-d',
      question_id: 'q-5',
      choice_id: 'c-5-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Under normal ambient conditions, PAO2 is always greater than or equal to PaO2; a negative A-a gradient is non-physiologic and indicates laboratory calibration error.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'The explanation is not available in the provided source files.',
      source_page: 'N/A',
      source_reference: 'Unreferenced physiological constraint',
      created_at: new Date().toISOString(),
    },

    // Explanations for Q6
    {
      id: 'exp-6-main',
      question_id: 'q-6',
      choice_id: 'c-6-b',
      choice_letter: 'B',
      explanation_text: 'CORRECT: Serum Anion Gap = [Na+] - ([Cl-] + [HCO3-]) = 132 - (94 + 10) = 132 - 104 = 28 mEq/L (Normal reference is 8-12 mEq/L). In diabetic ketoacidosis (DKA), absolute insulin deficiency stimulates uncontrolled adipocyte lipolysis, shunting free fatty acids to hepatic beta-oxidation and ketogenesis. Accumulation of acetoacetate and beta-hydroxybutyrate anions creates a profound high anion gap metabolic acidosis.',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'Harrison\'s Principles of Internal Medicine, 21st Edition',
      source_page: 'p. 412',
      source_reference: 'Chapter 53: Acid-Base Disorders; Anion Gap Acidosis',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-6-a',
      question_id: 'q-6',
      choice_id: 'c-6-a',
      choice_letter: 'A',
      explanation_text: 'INCORRECT: A calculated value of 12 mEq/L ignores the actual measured serum electrolytes: 132 - 104 = 28 mEq/L. Normal anion gap acidosis (e.g. diarrhea, renal tubular acidosis) features proportional hyperchloremia.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Harrison\'s Principles of Internal Medicine, 21st Edition',
      source_page: 'p. 414',
      source_reference: 'Chapter 53: Normal Anion Gap (Hyperchloremic) Acidosis',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-6-c',
      question_id: 'q-6',
      choice_id: 'c-6-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: The mathematical calculation yields 28 mEq/L, not 38 mEq/L. Furthermore, hyperchloremic saline expansion causes a non-anion gap metabolic acidosis, not a widened gap.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Harrison\'s Principles of Internal Medicine, 21st Edition',
      source_page: 'p. 415',
      source_reference: 'Chapter 53: Iatrogenic Acid-Base Derangements',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-6-d',
      question_id: 'q-6',
      choice_id: 'c-6-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Low anion gap (<6 mEq/L) is caused by severe hypoalbuminemia (each 1 g/dL drop in albumin drops anion gap by ~2.5 mEq/L) or paraproteinemia (multiple myeloma), which is absent in this acute DKA presentation.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Harrison\'s Principles of Internal Medicine, 21st Edition',
      source_page: 'p. 413',
      source_reference: 'Chapter 53: Low Anion Gap Determinants',
      created_at: new Date().toISOString(),
    },

    // Explanations for Q7
    {
      id: 'exp-7-main',
      question_id: 'q-7',
      choice_id: 'c-7-b',
      choice_letter: 'B',
      explanation_text: 'CORRECT: Amiodarone prominently prolongs the QT interval due to IKr potassium channel blockade (Class III effect). However, it exhibits a remarkably low incidence (<1%) of Torsades de Pointes. This cardioprotective profile stems from its multi-channel blockade: by concurrently inhibiting inward L-type Ca2+ currents and late sodium currents, it suppresses the early afterdepolarizations (EADs) that trigger triggered arrhythmias and produces homogenous prolongation of ventricular repolarization without spatial dispersion.',
      is_why_correct: true,
      is_why_incorrect: false,
      source_document: 'Goodman & Gilman\'s The Pharmacological Basis of Therapeutics, 14th Edition',
      source_page: 'p. 558',
      source_reference: 'Chapter 29: Antiarrhythmic Drugs; Class III Amiodarone',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-7-a',
      question_id: 'q-7',
      choice_id: 'c-7-a',
      choice_letter: 'A',
      explanation_text: 'INCORRECT: Procainamide is a Class Ia agent that prolongs QT and has an active metabolite (NAPA) with pure Class III properties that poses a substantial risk of Torsades de Pointes, particularly in renal dysfunction.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Katzung\'s Basic & Clinical Pharmacology, 15th Edition',
      source_page: 'p. 253',
      source_reference: 'Chapter 14: Class Ia Antiarrhythmics',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-7-c',
      question_id: 'q-7',
      choice_id: 'c-7-c',
      choice_letter: 'C',
      explanation_text: 'INCORRECT: Ibutilide is a potent pure Class III IV agent that causes marked transmural dispersion of repolarization, producing Torsades de Pointes in up to 4-8% of treated patients.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Katzung\'s Basic & Clinical Pharmacology, 15th Edition',
      source_page: 'p. 257',
      source_reference: 'Chapter 14: Pure Class III Agents and Proarrhythmia',
      created_at: new Date().toISOString(),
    },
    {
      id: 'exp-7-d',
      question_id: 'q-7',
      choice_id: 'c-7-d',
      choice_letter: 'D',
      explanation_text: 'INCORRECT: Quinidine was historically the prototypical cause of "quinidine syncope" due to marked concentration-independent prolongation of repolarization and frequent Torsades de Pointes.',
      is_why_correct: false,
      is_why_incorrect: true,
      source_document: 'Goodman & Gilman\'s The Pharmacological Basis of Therapeutics, 14th Edition',
      source_page: 'p. 550',
      source_reference: 'Chapter 29: Quinidine Syncope and Torsades',
      created_at: new Date().toISOString(),
    },
  ];

  const exam_questions: ExamQuestion[] = [
    { id: 'eq-1', exam_id: 'exam-cvs-final-2024', question_id: 'q-1', order_index: 1 },
    { id: 'eq-2', exam_id: 'exam-cvs-final-2024', question_id: 'q-2', order_index: 2 },
    { id: 'eq-3', exam_id: 'exam-cvs-final-2024', question_id: 'q-3', order_index: 3 },
    { id: 'eq-4', exam_id: 'exam-cvs-final-2024', question_id: 'q-4', order_index: 4 },
    { id: 'eq-5', exam_id: 'exam-cvs-final-2024', question_id: 'q-7', order_index: 5 },
    { id: 'eq-6', exam_id: 'exam-resp-midterm-2024', question_id: 'q-5', order_index: 1 },
    { id: 'eq-7', exam_id: 'exam-renal-shelf-2025', question_id: 'q-6', order_index: 1 },
    // Notice: Concept "con-qt-prolongation" appears in BOTH q-3 and q-7!
  ];

  const bookmarks: Bookmark[] = [
    {
      id: 'bm-1',
      student_id: 'default_student',
      question_id: 'q-3',
      category: 'important',
      notes: 'High yield for USMLE / Finals: Sotalol vs Amiodarone TdP risk',
      created_at: new Date().toISOString(),
    },
    {
      id: 'bm-2',
      student_id: 'default_student',
      question_id: 'q-5',
      category: 'review_later',
      notes: 'Review alveolar gas equation calculation steps',
      created_at: new Date().toISOString(),
    },
  ];

  const student_attempts: StudentAttempt[] = [
    {
      id: 'att-sample-1',
      student_id: 'default_student',
      mode: 'complete_exam',
      entity_id: 'exam-cvs-final-2024',
      title: 'Cardiovascular Integrated Final Examination — 2024',
      total_questions: 5,
      correct_count: 4,
      incorrect_count: 1,
      unanswered_count: 0,
      score_percentage: 80,
      time_spent_seconds: 320,
      is_completed: true,
      completed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  const student_answers: StudentAnswer[] = [
    { id: 'ans-1', attempt_id: 'att-sample-1', question_id: 'q-1', selected_choice_id: 'c-1-b', is_correct: true, time_taken_seconds: 45, created_at: new Date().toISOString() },
    { id: 'ans-2', attempt_id: 'att-sample-1', question_id: 'q-2', selected_choice_id: 'c-2-a', is_correct: true, time_taken_seconds: 70, created_at: new Date().toISOString() },
    { id: 'ans-3', attempt_id: 'att-sample-1', question_id: 'q-3', selected_choice_id: 'c-3-a', is_correct: false, time_taken_seconds: 65, created_at: new Date().toISOString() },
    { id: 'ans-4', attempt_id: 'att-sample-1', question_id: 'q-4', selected_choice_id: 'c-4-b', is_correct: true, time_taken_seconds: 80, created_at: new Date().toISOString() },
    { id: 'ans-5', attempt_id: 'att-sample-1', question_id: 'q-7', selected_choice_id: 'c-7-b', is_correct: true, time_taken_seconds: 60, created_at: new Date().toISOString() },
  ];

  return {
    academic_years,
    modules,
    subjects,
    chapters,
    concepts,
    exams,
    questions,
    answer_choices,
    explanations,
    exam_questions,
    bookmarks,
    student_attempts,
    student_answers,
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
  payload.answer_choices.forEach((c, idx) => {
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
  payload.explanations.forEach((e, idx) => {
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
  if (payload.exam_ids && payload.exam_ids.length > 0) {
    payload.exam_ids.forEach((eid, idx) => {
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
    exam_ids: payload.exam_ids || [],
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

  store.questions[qIndex] = { ...store.questions[qIndex], ...payload.question };

  if (payload.answer_choices) {
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

  if (payload.explanations) {
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

  if (payload.exam_ids) {
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
  const seed = generateSeedData();
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

