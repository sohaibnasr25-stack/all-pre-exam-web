'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Lock,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  Layers,
  BookOpen,
  Sparkles,
  FileCheck2,
  RotateCcw,
  LogOut,
  X,
  Upload,
  FileUp,
  FileText,
  Check,
  Copy,
  Users,
  KeyRound,
  Search,
  CheckSquare,
  Square,
} from 'lucide-react';
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
  AdminUser,
} from '@/lib/types';
import { parseBulkExamText, ParsedExamPayload } from '@/lib/examTextParser';

interface FormExplanation {
  choice_letter: string;
  explanation_text: string;
  is_why_correct?: boolean;
  is_why_incorrect?: boolean;
  source_document?: string;
  source_page?: string;
  source_reference?: string;
}

interface QuestionFormState {
  academic_year_id: string;
  module_id: string;
  subject_id: string;
  chapter_id: string;
  concept_id: string;
  question_text: string;
  clinical_vignette: string;
  exam_ids: string[];
  answer_choices: { choice_letter: string; choice_text: string; is_correct: boolean }[];
  explanations: FormExplanation[];
}

export default function AdminDashboardPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string>('Administrator');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<
    'questions' | 'exams' | 'years' | 'modules' | 'subjects' | 'chapters' | 'concepts' | 'bulk-import' | 'system' | 'admins'
  >('questions');

  // Bulk Import States
  const [bulkText, setBulkText] = useState('');
  const [parsedExam, setParsedExam] = useState<ParsedExamPayload | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [importSuccessResult, setImportSuccessResult] = useState<{ exam_id: string; exam_title: string; questions_count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Curriculum Data States
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminModalOpen, setNewAdminModalOpen] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ username: '', password: '', full_name: '', email: '' });
  const [dataLoading, setDataLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storageStatus, setStorageStatus] = useState<any>(null);

  // Exam Creation & Editing Modal State
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [selectedExamQuestionIds, setSelectedExamQuestionIds] = useState<string[]>([]);
  const [examQuestionSearch, setExamQuestionSearch] = useState('');
  const [examQuestionFilterModule, setExamQuestionFilterModule] = useState('all');
  const [examForm, setExamForm] = useState({
    title: '',
    academic_year_id: '',
    module_id: '',
    exam_type: 'end_module' as 'end_module' | 'final',
    duration_minutes: 60,
    passing_score: 70,
    instructions: '',
  });

  // Question Form Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qForm, setQForm] = useState<QuestionFormState>({
    academic_year_id: '',
    module_id: '',
    subject_id: '',
    chapter_id: '',
    concept_id: '',
    question_text: '',
    clinical_vignette: '',
    exam_ids: [],
    answer_choices: [
      { choice_letter: 'A', choice_text: '', is_correct: true },
      { choice_letter: 'B', choice_text: '', is_correct: false },
      { choice_letter: 'C', choice_text: '', is_correct: false },
      { choice_letter: 'D', choice_text: '', is_correct: false },
    ],
    explanations: [
      {
        choice_letter: 'A',
        explanation_text: '',
        is_why_correct: true,
        is_why_incorrect: false,
        source_document: '',
        source_page: '',
        source_reference: '',
      },
      { choice_letter: 'B', explanation_text: '', is_why_correct: false, is_why_incorrect: true, source_document: '', source_page: '', source_reference: '' },
      { choice_letter: 'C', explanation_text: '', is_why_correct: false, is_why_incorrect: true, source_document: '', source_page: '', source_reference: '' },
      { choice_letter: 'D', explanation_text: '', is_why_correct: false, is_why_incorrect: true, source_document: '', source_page: '', source_reference: '' },
    ],
  });

  // Admin authenticated fetch wrapper that always attaches Bearer token & cookies (no-cache)
  const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('omnimed_admin_token') : null;
    const headers = new Headers(init.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (!headers.has('Pragma')) {
      headers.set('Pragma', 'no-cache');
    }
    return fetch(input, { ...init, cache: 'no-store', credentials: 'include', headers });
  };

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('omnimed_admin_token') : null;
        const res = await fetch('/api/admin/auth', {
          cache: 'no-store',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' } : { 'Cache-Control': 'no-cache' },
        });
        const data = await res.json();
        setIsAuthenticated(!!data.authenticated);
        if (data.authenticated && data.username) {
          setLoggedInUser(data.username);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch all curriculum data once authenticated with timestamp cache buster
  const refreshAllData = async () => {
    setDataLoading(true);
    try {
      const ts = Date.now();
      const [yRes, mRes, sRes, cRes, conRes, eRes, qRes] = await Promise.all([
        adminFetch(`/api/academic-years?_t=${ts}`),
        adminFetch(`/api/modules?_t=${ts}`),
        adminFetch(`/api/subjects?_t=${ts}`),
        adminFetch(`/api/chapters?_t=${ts}`),
        adminFetch(`/api/concepts?_t=${ts}`),
        adminFetch(`/api/exams?_t=${ts}`),
        adminFetch(`/api/questions?_t=${ts}`),
      ]);

      const [yData, mData, sData, cData, conData, eData, qData] = await Promise.all([
        yRes.json(),
        mRes.json(),
        sRes.json(),
        cRes.json(),
        conRes.json(),
        eRes.json(),
        qRes.json(),
      ]);

      if (yData.success) setAcademicYears(yData.data);
      if (mData.success) setModules(mData.data);
      if (sData.success) setSubjects(sData.data);
      if (cData.success) setChapters(cData.data);
      if (conData.success) setConcepts(conData.data);
      if (eData.success) setExams(eData.data);
      if (qData.success) setQuestions(qData.data);

      try {
        const adminsRes = await adminFetch('/api/admin/users');
        const adminsData = await adminsRes.json();
        if (adminsData.success) setAdminUsers(adminsData.data);
      } catch {}

      try {
        const sModeRes = await adminFetch('/api/system/storage-mode');
        const sModeData = await sModeRes.json();
        if (sModeData.success) setStorageStatus(sModeData.data);
      } catch {}
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
    }
  }, [isAuthenticated]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token && typeof window !== 'undefined') {
          localStorage.setItem('omnimed_admin_token', data.token);
        }
        setIsAuthenticated(true);
        if (data.admin?.username) setLoggedInUser(data.admin.username);
      } else {
        setAuthError(data.message || 'Invalid administrator password');
      }
    } catch (err) {
      setAuthError('Authentication request failed');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('omnimed_admin_token');
    }
    await fetch('/api/admin/auth', { method: 'DELETE', credentials: 'include' });
    setIsAuthenticated(false);
  };

  // Temporary feedback toast helper
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // ----------------------------------------------------
  // QUESTION FORM LOGIC
  // ----------------------------------------------------
  const openNewQuestionModal = () => {
    setEditingQuestionId(null);
    setQForm({
      academic_year_id: academicYears[0]?.id || '',
      module_id: modules[0]?.id || '',
      subject_id: subjects[0]?.id || '',
      chapter_id: chapters[0]?.id || '',
      concept_id: concepts[0]?.id || '',
      question_text: '',
      clinical_vignette: '',
      exam_ids: [],
      answer_choices: [
        { choice_letter: 'A', choice_text: '', is_correct: true },
        { choice_letter: 'B', choice_text: '', is_correct: false },
        { choice_letter: 'C', choice_text: '', is_correct: false },
        { choice_letter: 'D', choice_text: '', is_correct: false },
      ],
      explanations: [
        { choice_letter: 'A', explanation_text: '', is_why_correct: true, is_why_incorrect: false, source_document: '', source_page: '', source_reference: '' },
        { choice_letter: 'B', explanation_text: '', is_why_correct: false, is_why_incorrect: true, source_document: '', source_page: '', source_reference: '' },
        { choice_letter: 'C', explanation_text: '', is_why_correct: false, is_why_incorrect: true, source_document: '', source_page: '', source_reference: '' },
        { choice_letter: 'D', explanation_text: '', is_why_correct: false, is_why_incorrect: true, source_document: '', source_page: '', source_reference: '' },
      ],
    });
    setQuestionModalOpen(true);
  };

  const openEditQuestionModal = (q: Question) => {
    setEditingQuestionId(q.id);
    setQForm({
      academic_year_id: q.academic_year_id || '',
      module_id: q.module_id || '',
      subject_id: q.subject_id || '',
      chapter_id: q.chapter_id || '',
      concept_id: q.concept_id || '',
      question_text: q.question_text,
      clinical_vignette: q.clinical_vignette || '',
      exam_ids: q.exam_ids || [],
      answer_choices: q.answer_choices.map((c) => ({
        choice_letter: c.choice_letter,
        choice_text: c.choice_text,
        is_correct: c.is_correct,
      })),
      explanations: q.answer_choices.map((c) => {
        const found = q.explanations.find((e) => e.choice_letter === c.choice_letter || e.choice_id === c.id);
        return {
          choice_letter: c.choice_letter,
          explanation_text: found?.explanation_text || '',
          is_why_correct: c.is_correct,
          is_why_incorrect: !c.is_correct,
          source_document: found?.source_document || '',
          source_page: found?.source_page || '',
          source_reference: found?.source_reference || '',
        };
      }),
    });
    setQuestionModalOpen(true);
  };

  const SAMPLE_TXT_TEMPLATE = `الامتحان: CVS Comprehensive End Module Examination 2026
نوع الامتحان: END MODULE
العام: Year 1: Pre-Clinical Sciences
الموديول: Cardiovascular System
المادة: Medical Physiology
الشابتر: Cardiac Electrophysiology & Rhythm
المفهوم: Frank-Starling Mechanism
المدة: 60
درجة النجاح: 70

السؤال 1:
الحالة السريرية: A 62-year-old male with chronic heart failure presents for a cardiology follow-up. Echocardiography demonstrates ventricular dilatation with an ejection fraction of 28%.
نص السؤال: Which cellular alteration best explains the depressed ventricular function curve observed in this patient?
المادة: Medical Physiology
المفهوم: Frank-Starling Mechanism
A) Phosphorylation of phospholamban by protein kinase A
   التفسير: Incorrect. Phospholamban phosphorylation disinhibits SERCA2a and enhances inotropy and lusitropy.
   المرجع: Boron & Boulpaep Medical Physiology
   ص: 520
*B) Disruption of optimal actin-myosin overlap due to extreme sarcomere overstretching
   التفسير: Correct. When end-diastolic sarcomere length exceeds optimal limits (~2.2 um), myofilament cross-bridge interaction decreases, leading to diminished stroke volume.
   المرجع: Guyton and Hall Textbook of Medical Physiology 14th Ed
   ص: 115
C) Increased open probability of ryanodine receptors (RyR2)
   التفسير: Incorrect. Enhanced RyR2 open probability would transiently increase systolic calcium release.
D) Downregulation of forward-mode sodium-calcium exchange (NCX)
   التفسير: Incorrect. NCX inhibition increases intracellular calcium, similar to digitalis action.

السؤال 2:
الحالة السريرية: A 22-year-old medical student records a ventricular cardiomyocyte action potential during a physiology laboratory exercise.
نص السؤال: Which ionic current balance is primarily responsible for generating and maintaining the Phase 2 plateau?
المادة: Medical Physiology
المفهوم: Cardiac Action Potential
A) Inward fast sodium current (INa) balanced by outward delayed rectifier potassium current (IK)
   التفسير: Incorrect. Fast INa is inactivated at Phase 0 and plays no role in maintaining the Phase 2 plateau.
*B) Inward L-type calcium current (ICa-L) balanced by outward delayed rectifier potassium current (IK)
   التفسير: Correct. The Phase 2 plateau is uniquely characterized by a balance between slowly inactivating inward Ca2+ influx and outward K+ repolarizing efflux.
   المرجع: Katz Physiology of the Heart 5th Ed
   ص: 298
C) Outward transient potassium current (Ito) only
   التفسير: Incorrect. Ito is responsible for Phase 1 early rapid repolarization.
D) Inward hyperpolarization-activated pacemaker funny current (If)
   التفسير: Incorrect. The If current is exclusive to SA node and AV node pacemaker cells during Phase 4 prepotential.

=== الامتحان الثاني في نفس الملف ===
الامتحان: CVS Comprehensive Integrated Final Exam 2026
نوع الامتحان: FINAL
العام: Year 1: Pre-Clinical Sciences
الموديول: Cardiovascular System
المادة: Pathology
الشابتر: Ischemic Heart Disease
المفهوم: Histopathological Timeline of Acute Myocardial Infarction
المدة: 75
درجة النجاح: 70

السؤال 1:
الحالة السريرية: A 58-year-old male dies suddenly 3 days following an acute anterior myocardial infarction.
نص السؤال: Which microscopic finding is most characteristically predominant in the infarcted myocardium at this time?
المادة: Pathology
المفهوم: Histopathological Timeline of Acute Myocardial Infarction
A) Dense collagenous scar tissue and abundant fibroblasts
   التفسير: Incorrect. Dense scar formation occurs after 2 months.
*B) Extensive macrophage infiltration and early phagocytosis of necrotic myocytes
   التفسير: Correct. Days 3 to 7 are characterized by dense macrophage infiltration phagocytosing necrotic debris.
   المرجع: Robbins and Cotran Pathologic Basis of Disease 10th Ed
   ص: 556
C) Coagulative necrosis with prominent neutrophilic infiltrate
   التفسير: Incorrect. Neutrophils dominate earlier between 24-72 hours.
D) Normal myocardium with subtle wavy fibers only
   التفسير: Incorrect. Wavy fibers appear in the earliest 1-3 hours.`;

  const handleParseText = (textToParse: string) => {
    if (!textToParse.trim()) {
      setParsedExam(null);
      return;
    }
    try {
      const result = parseBulkExamText(textToParse);
      setParsedExam(result);
      setImportSuccessResult(null);
    } catch (err) {
      showFeedback('error', 'Failed to parse text: ' + String(err));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setBulkText(content);
      handleParseText(content);
      showFeedback('success', `File "${file.name}" loaded and parsed successfully!`);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!parsedExam || parsedExam.questions.length === 0) {
      showFeedback('error', 'No parsed questions to import. Please check text.');
      return;
    }

    try {
      setBulkLoading(true);
      const res = await adminFetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedExam),
      });

      const data = await res.json();
      if (data.success) {
        setImportSuccessResult({
          exam_id: data.exam_id,
          exam_title: data.exam_title,
          questions_count: data.questions_count,
        });
        showFeedback('success', `Successfully imported "${data.exam_title}" with ${data.questions_count} questions!`);
        refreshAllData();
      } else {
        showFeedback('error', data.message || data.error || 'Failed to import exam.');
      }
    } catch (err) {
      showFeedback('error', 'Error executing bulk import: ' + String(err));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qForm.question_text.trim()) {
      showFeedback('error', 'Question text is required');
      return;
    }

    const payload = {
      question: {
        academic_year_id: qForm.academic_year_id,
        module_id: qForm.module_id,
        subject_id: qForm.subject_id,
        chapter_id: qForm.chapter_id,
        concept_id: qForm.concept_id,
        question_text: qForm.question_text,
        clinical_vignette: qForm.clinical_vignette,
        order_index: 1,
      },
      answer_choices: qForm.answer_choices,
      explanations: qForm.explanations,
      exam_ids: qForm.exam_ids,
    };

    try {
      let res;
      if (editingQuestionId) {
        res = await adminFetch('/api/questions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingQuestionId, ...payload }),
        });
      } else {
        res = await adminFetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        showFeedback('success', editingQuestionId ? 'Question updated' : 'Question created');
        setQuestionModalOpen(false);
        refreshAllData();
      } else {
        showFeedback('error', data.message || data.error || 'Operation failed');
      }
    } catch (err) {
      showFeedback('error', String(err));
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      // Optimistic delete: remove instantly from UI
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      const res = await adminFetch(`/api/questions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showFeedback('success', 'Question deleted successfully');
      } else {
        showFeedback('error', data.message || data.error || 'Operation failed');
      }
      await refreshAllData();
    } catch (err) {
      showFeedback('error', String(err));
      await refreshAllData();
    }
  };

  // ----------------------------------------------------
  // AUTH LOGIN SCREEN
  // ----------------------------------------------------
  if (authLoading) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Verifying administrative session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container-narrow" style={{ padding: '5rem 1.5rem' }}>
        <div
          className="card-3d"
          style={{
            padding: '3rem 2.5rem',
            borderRadius: 'var(--radius-xl)',
            maxWidth: '480px',
            margin: '0 auto',
            textAlign: 'center',
            border: '1px solid var(--border-highlight)',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <Lock size={28} color="#06b6d4" />
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            OmniMed Administration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
            Restricted access. Only authorized medical administrators can add, modify, or delete educational content.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Username or Email (اسم المستخدم أو البريد)</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="e.g. admin or username (اختياري)"
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Administrator Password *</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password (from Supabase admins or master password)"
                className="form-input"
                required
              />
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'left', lineHeight: 1.4 }}>
              💡 يتم التحقق من بيانات الدخول مباشرة عبر جدول <code>admins</code> في <strong>Supabase</strong>.
            </div>

            {authError && (
              <div style={{ color: '#fb7185', fontSize: '0.85rem', textAlign: 'left' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', fontWeight: 700 }}>
              <span>Unlock Admin Portal</span>
              <ShieldAlert size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // ----------------------------------------------------
  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            background: feedbackMsg.type === 'success' ? '#10b981' : '#f43f5e',
            color: '#ffffff',
            fontWeight: 600,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Admin Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <ShieldAlert size={15} />
            <span>Curriculum Content Management System</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Admin Dashboard</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={refreshAllData} className="btn btn-secondary btn-sm" title="Reload from database">
            <RotateCcw size={14} />
            <span>Refresh</span>
          </button>
          <button onClick={handleLogout} className="btn btn-outline btn-sm">
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.5rem',
          marginBottom: '2rem',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'questions', label: `Questions (${questions.length})`, icon: FileQuestion },
          { key: 'exams', label: `Exams (${exams.length})`, icon: FileCheck2 },
          { key: 'bulk-import', label: '📥 Bulk Import (.TXT)', icon: Upload },
          { key: 'admins', label: `Admins (${adminUsers.length})`, icon: Users },
          { key: 'years', label: `Years (${academicYears.length})`, icon: Layers },
          { key: 'modules', label: `Modules (${modules.length})`, icon: Layers },
          { key: 'subjects', label: `Subjects (${subjects.length})`, icon: BookOpen },
          { key: 'chapters', label: `Chapters (${chapters.length})`, icon: BookOpen },
          { key: 'concepts', label: `Concepts (${concepts.length})`, icon: Sparkles },
          { key: 'system', label: 'System & Database', icon: RotateCcw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`tab-3d ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: QUESTIONS MANAGER */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Medical Examination Questions</h2>
            <button onClick={openNewQuestionModal} className="btn btn-primary" style={{ gap: '0.4rem' }}>
              <Plus size={16} />
              <span>Create New Question</span>
            </button>
          </div>

          {/* Question Search Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
              placeholder="Search questions by text, subject, chapter, or concept..."
              className="form-input"
              style={{ maxWidth: '450px', fontSize: '0.88rem' }}
            />
            {questionSearch && (
              <button onClick={() => setQuestionSearch('')} className="btn btn-secondary btn-sm">
                Clear Search
              </button>
            )}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {
                questions.filter((q) => {
                  if (!questionSearch.trim()) return true;
                  const term = questionSearch.toLowerCase();
                  return (
                    q.question_text.toLowerCase().includes(term) ||
                    (q.clinical_vignette && q.clinical_vignette.toLowerCase().includes(term)) ||
                    (q.subject?.name && q.subject.name.toLowerCase().includes(term)) ||
                    (q.concept?.name && q.concept.name.toLowerCase().includes(term)) ||
                    (q.chapter?.name && q.chapter.name.toLowerCase().includes(term))
                  );
                }).length
              } of {questions.length} questions
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {questions
              .filter((q) => {
                if (!questionSearch.trim()) return true;
                const term = questionSearch.toLowerCase();
                return (
                  q.question_text.toLowerCase().includes(term) ||
                  (q.clinical_vignette && q.clinical_vignette.toLowerCase().includes(term)) ||
                  (q.subject?.name && q.subject.name.toLowerCase().includes(term)) ||
                  (q.concept?.name && q.concept.name.toLowerCase().includes(term)) ||
                  (q.chapter?.name && q.chapter.name.toLowerCase().includes(term))
                );
              })
              .map((q, idx) => (
              <div
                key={q.id}
                className="card-3d"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1.25rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <span className="badge badge-teal">Q{idx + 1}</span>
                    {q.subject && <span className="badge badge-blue">{q.subject.name}</span>}
                    {q.concept && <span className="badge badge-purple">{q.concept.name}</span>}
                    <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)' }}>
                      {q.answer_choices.length} Choices
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    {q.question_text}
                  </div>

                  {q.clinical_vignette && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Case: {q.clinical_vignette}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    onClick={() => openEditQuestionModal(q)}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '0.3rem' }}
                  >
                    <Edit size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.4rem 0.6rem' }}
                    title="Delete Question"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: EXAMS MANAGER */}
      {activeTab === 'exams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Previous-Year & Shelf Exams</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                إدارة كافة الامتحانات: تعديل الأسماء، المدة، درجة النجاح، وربط أو فك الأسئلة دفعة واحدة
              </div>
            </div>
            <button
              onClick={() => {
                setEditingExamId(null);
                setExamForm({
                  title: '',
                  academic_year_id: academicYears[0]?.id || '',
                  module_id: modules[0]?.id || '',
                  exam_type: 'end_module',
                  duration_minutes: 60,
                  passing_score: 70,
                  instructions: '',
                });
                setSelectedExamQuestionIds([]);
                setExamQuestionSearch('');
                setExamQuestionFilterModule('all');
                setExamModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ gap: '0.4rem' }}
            >
              <Plus size={16} />
              <span>Create New Exam</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="card-3d"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-teal">{exam.academic_year?.name || 'Academic Year'}</span>
                    <span className="badge badge-blue">{exam.module?.name || 'Module'}</span>
                    <span className="badge badge-purple">
                      {exam.exam_type === 'end_module' ? 'END MODULE' : 'FINAL'}
                    </span>
                    <span className="badge badge-yellow">
                      {exam.question_count || (exam.question_ids?.length || 0)} questions
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.2rem' }}>{exam.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Duration: {exam.duration_minutes} min • Passing Score: {exam.passing_score}% • Type: {exam.exam_type === 'end_module' ? 'End of Module' : 'Comprehensive Final'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      setEditingExamId(exam.id);
                      setExamForm({
                        title: exam.title,
                        academic_year_id: exam.academic_year_id,
                        module_id: exam.module_id,
                        exam_type: (exam.exam_type === 'end_module' || exam.exam_type === 'midterm') ? 'end_module' : 'final',
                        duration_minutes: exam.duration_minutes || 60,
                        passing_score: exam.passing_score || 70,
                        instructions: exam.instructions || '',
                      });
                      const linkedIds = new Set<string>();
                      if (Array.isArray(exam.question_ids)) {
                        exam.question_ids.forEach((qid) => linkedIds.add(qid));
                      }
                      questions.forEach((q) => {
                        if (q.exam_ids?.includes(exam.id)) {
                          linkedIds.add(q.id);
                        }
                      });
                      setSelectedExamQuestionIds(Array.from(linkedIds));
                      setExamQuestionSearch('');
                      setExamQuestionFilterModule(exam.module_id || 'all');
                      setExamModalOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '0.35rem', color: 'var(--color-primary)' }}
                    title="تعديل بيانات الامتحان والأسئلة المرتبطة به"
                  >
                    <Edit size={14} />
                    <span>تعديل الامتحان</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm(`Delete exam "${exam.title}"?`)) return;
                      // Optimistic delete: remove instantly from UI
                      setExams((prev) => prev.filter((e) => e.id !== exam.id));
                      try {
                        const res = await adminFetch(`/api/exams?id=${exam.id}`, { method: 'DELETE' });
                        const data = await res.json();
                        if (data.success) {
                          showFeedback('success', `Exam "${exam.title}" deleted successfully`);
                        } else {
                          showFeedback('error', data.message || 'Failed to delete exam');
                        }
                      } catch (err) {
                        showFeedback('error', String(err));
                      }
                      await refreshAllData();
                    }}
                    className="btn btn-danger btn-sm"
                    title="حذف الامتحان"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3-7: HIERARCHY CRUD (Academic Years, Modules, Subjects, Chapters, Concepts) */}
      {activeTab === 'years' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Academic Years</h2>
            <button
              onClick={async () => {
                const name = prompt('Academic Year Name (e.g. Year 4: Speciality Clerkships):');
                const code = prompt('Code (e.g. MED-Y4):');
                if (!name || !code) return;
                await adminFetch('/api/academic-years', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, code, order_index: academicYears.length + 1, is_active: true }),
                });
                refreshAllData();
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Add Academic Year</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {academicYears.map((year) => (
              <div
                key={year.id}
                className="card-3d"
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{year.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Code: {year.code}</div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${year.name}?`)) return;
                    setAcademicYears((prev) => prev.filter((y) => y.id !== year.id));
                    try {
                      const res = await adminFetch(`/api/academic-years?id=${year.id}`, { method: 'DELETE' });
                      const data = await res.json();
                      if (data.success) {
                        showFeedback('success', `Year "${year.name}" deleted successfully`);
                      } else {
                        showFeedback('error', data.message || 'Failed to delete year');
                      }
                    } catch (err) {
                      showFeedback('error', String(err));
                    }
                    await refreshAllData();
                  }}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'modules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Modules</h2>
            <button
              onClick={async () => {
                const name = prompt('Module Name (e.g. Gastrointestinal System):');
                const code = prompt('Code (e.g. GIT-201):');
                if (!name || !code) return;
                const yearId = academicYears[0]?.id;
                await adminFetch('/api/modules', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, code, academic_year_id: yearId, order_index: modules.length + 1 }),
                });
                refreshAllData();
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Add Module</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="card-3d"
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{mod.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Code: {mod.code} • Year: {mod.academic_year?.name || mod.academic_year_id}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${mod.name}?`)) return;
                    setModules((prev) => prev.filter((m) => m.id !== mod.id));
                    try {
                      const res = await adminFetch(`/api/modules?id=${mod.id}`, { method: 'DELETE' });
                      const data = await res.json();
                      if (data.success) {
                        showFeedback('success', `Module "${mod.name}" deleted successfully`);
                      } else {
                        showFeedback('error', data.message || 'Failed to delete module');
                      }
                    } catch (err) {
                      showFeedback('error', String(err));
                    }
                    await refreshAllData();
                  }}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Subjects</h2>
            <button
              onClick={async () => {
                const name = prompt('Subject Name (e.g. Clinical Pharmacology):');
                const code = prompt('Code (e.g. C-PHA):');
                if (!name || !code) return;
                const modId = modules[0]?.id;
                await adminFetch('/api/subjects', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, code, module_id: modId, order_index: subjects.length + 1 }),
                });
                refreshAllData();
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Add Subject</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className="card-3d"
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{sub.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Code: {sub.code} • Module: {sub.module?.name || sub.module_id}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${sub.name}?`)) return;
                    setSubjects((prev) => prev.filter((s) => s.id !== sub.id));
                    try {
                      const res = await adminFetch(`/api/subjects?id=${sub.id}`, { method: 'DELETE' });
                      const data = await res.json();
                      if (data.success) {
                        showFeedback('success', `Subject "${sub.name}" deleted successfully`);
                      } else {
                        showFeedback('error', data.message || 'Failed to delete subject');
                      }
                    } catch (err) {
                      showFeedback('error', String(err));
                    }
                    await refreshAllData();
                  }}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'chapters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Chapters</h2>
            <button
              onClick={async () => {
                const name = prompt('Chapter Title:');
                if (!name) return;
                const subId = subjects[0]?.id;
                await adminFetch('/api/chapters', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, subject_id: subId, order_index: chapters.length + 1 }),
                });
                refreshAllData();
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Add Chapter</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {chapters.map((chap) => (
              <div
                key={chap.id}
                className="card-3d"
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{chap.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Subject: {chap.subject?.name || chap.subject_id}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${chap.name}?`)) return;
                    setChapters((prev) => prev.filter((c) => c.id !== chap.id));
                    try {
                      const res = await adminFetch(`/api/chapters?id=${chap.id}`, { method: 'DELETE' });
                      const data = await res.json();
                      if (data.success) {
                        showFeedback('success', `Chapter "${chap.name}" deleted successfully`);
                      } else {
                        showFeedback('error', data.message || 'Failed to delete chapter');
                      }
                    } catch (err) {
                      showFeedback('error', String(err));
                    }
                    await refreshAllData();
                  }}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'concepts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Medical Concepts</h2>
            <button
              onClick={async () => {
                const name = prompt('Concept Name (e.g. Frank-Starling Mechanism):');
                if (!name) return;
                const chapId = chapters[0]?.id;
                await adminFetch('/api/concepts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, chapter_id: chapId, order_index: concepts.length + 1 }),
                });
                refreshAllData();
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Add Concept</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {concepts.map((con) => (
              <div
                key={con.id}
                className="card-3d"
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{con.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Chapter: {con.chapter?.name || con.chapter_id}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${con.name}?`)) return;
                    setConcepts((prev) => prev.filter((c) => c.id !== con.id));
                    try {
                      const res = await adminFetch(`/api/concepts?id=${con.id}`, { method: 'DELETE' });
                      const data = await res.json();
                      if (data.success) {
                        showFeedback('success', `Concept "${con.name}" deleted successfully`);
                      } else {
                        showFeedback('error', data.message || 'Failed to delete concept');
                      }
                    } catch (err) {
                      showFeedback('error', String(err));
                    }
                    await refreshAllData();
                  }}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: SYSTEM & DATABASE */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card-3d" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Database Engine & Offline Resilience
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              OmniMed supports a dual-layer data architecture: Cloud Supabase PostgreSQL for remote persistence and syncing, and an ultra-fast Local JSON Database (`data/db.json`) for zero-latency offline operation or whenever connection is weak or unavailable.
            </p>

            {/* Storage Mode Switcher Panel */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Active Storage Mode
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>
                    {storageStatus?.mode === 'local_only' ? 'Local JSON Database (Offline Fast Mode)' : 'Auto Cloud Mode (Supabase with Local Fallback)'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={async () => {
                      const res = await adminFetch('/api/system/storage-mode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: 'local_only' }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setStorageStatus(d.data);
                        showFeedback('success', 'Switched to Local Database Mode (100% Offline)');
                      }
                    }}
                    className={`btn btn-sm ${storageStatus?.mode === 'local_only' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Force Local DB
                  </button>
                  <button
                    onClick={async () => {
                      const res = await adminFetch('/api/system/storage-mode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: 'auto' }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setStorageStatus(d.data);
                        showFeedback('success', 'Switched to Auto Cloud Mode with Fallback');
                      }
                    }}
                    className={`btn btn-sm ${storageStatus?.mode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Auto (Cloud + Fallback)
                  </button>
                </div>
              </div>

              {/* Engine Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Engine In Use</span>
                  <strong style={{ color: storageStatus?.activeSource === 'local' ? '#10b981' : '#06b6d4' }}>
                    {storageStatus?.activeSource === 'local' ? 'Local File Store' : 'Supabase Cloud'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Supabase Config</span>
                  <span>{storageStatus?.isSupabaseConfigured ? 'Credentials Found' : 'Local Fallback Only'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Cloud Latency</span>
                  <span>{storageStatus?.isSupabaseReachable ? `${storageStatus.latencyMs}ms` : 'Offline / Standby'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>Cached Questions</span>
                  <span>{questions.length} Questions</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  if (!confirm('تحذير: سيتم مسح وتفريغ كافة الامتحانات والأسئلة والمناهج والنتائج لتصبح قاعدة البيانات السحابية والمحلية خالية تماماً (Clean Slate) مع الاحتفاظ بحسابات الأدمن. هل تريد المتابعة؟')) return;
                  try {
                    const res = await adminFetch('/api/admin/reset', { method: 'POST' });
                    const d = await res.json();
                    if (d.success) {
                      try {
                        Object.keys(localStorage).forEach((k) => {
                          if (k.startsWith('omnimed_')) {
                            localStorage.removeItem(k);
                          }
                        });
                      } catch {}
                      showFeedback('success', 'تم تفريغ ومسح قاعدة البيانات السحابية والمحلية بالكامل والبدء على بياض بنجاح!');
                      await refreshAllData();
                    } else {
                      showFeedback('error', d.message || d.error || 'فشلت عملية مسح البيانات');
                    }
                  } catch (err) {
                    showFeedback('error', 'تعذر الاتصال بالخادم لمسح قاعدة البيانات: ' + String(err));
                  }
                }}
                className="btn btn-danger"
                style={{ gap: '0.4rem' }}
              >
                <RotateCcw size={15} />
                <span>مسح وتفريغ قاعدة البيانات بالكامل (Clean Slate Wipe)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: BULK IMPORT (.TXT / JSON) */}
      {activeTab === 'bulk-import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              <Upload size={15} />
              <span>Bulk Exam & Questions Ingestion Engine</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              الاستيراد الجماعي للامتحانات والأسئلة (Bulk Import via .TXT)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '850px', lineHeight: 1.6 }}>
              ارفع ملف نصي <strong>.txt</strong> أو الصق نص الامتحان كاملاً دفعة واحدة. سيقوم المحلل الذكي باستخراج اسم الامتحان، وبيانات العام الأكاديمي والموديول والمادة، وتجهيز كافة الأسئلة مع خياراتها وتفسيراتها ومراجعها الطبية بدقة في ثوانٍ.
            </p>
          </div>

          {/* Success Banner if import completed */}
          {importSuccessResult && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                padding: '1.75rem',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <Check size={26} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399', marginBottom: '0.2rem' }}>
                    تم استيراد الامتحان بنجاح إلى قاعدة البيانات!
                  </h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    الامتحان: <strong>{importSuccessResult.exam_title}</strong> — تم إدراج <strong>{importSuccessResult.questions_count}</strong> سؤالاً وتصنيفها تلقائياً.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setImportSuccessResult(null);
                    setBulkText('');
                    setParsedExam(null);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  استيراد امتحان آخر
                </button>
                <Link
                  href={`/practice/complete_exam/${importSuccessResult.exam_id}`}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '0.4rem' }}
                >
                  <span>بدء حل الامتحان الآن</span>
                  <FileCheck2 size={15} />
                </Link>
              </div>
            </div>
          )}

          {/* File Upload Zone & Quick Action Buttons */}
          <div
            className="card-3d"
            style={{
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {/* Drag & Click Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-highlight)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-surface-elevated)',
                transition: 'all 0.2s ease',
              }}
            >
              <FileUp size={36} color="var(--cyan)" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                اضغط هنا لاختيار ملف .txt أو .json من جهازك
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                يدعم الملفات النصية المنسقة (.txt) أو ملفات (.json) بكل تفاصيل الأسئلة
              </div>
            </div>

            {/* Quick Actions Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setBulkText(SAMPLE_TXT_TEMPLATE);
                    handleParseText(SAMPLE_TXT_TEMPLATE);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.4rem', fontSize: '0.82rem' }}
                >
                  <Copy size={13} />
                  <span>إدراج نموذج نصي جاهز (.TXT Template)</span>
                </button>

                {bulkText && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkText('');
                      setParsedExam(null);
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.82rem' }}
                  >
                    مسح النص
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleParseText(bulkText)}
                className="btn btn-primary btn-sm"
                style={{ gap: '0.4rem' }}
              >
                <Sparkles size={14} />
                <span>تحليل ومعاينة الأسئلة (Parse & Preview)</span>
              </button>
            </div>

            {/* Textarea Editor */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                محتوى الامتحان المكتوب (أو المعروض من الملف):
              </label>
              <textarea
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  handleParseText(e.target.value);
                }}
                placeholder="الصق نص الامتحان هنا مباشرة أو ارفع ملف .txt...
مثال:
الامتحان: Final Cardiovascular Exam 2026
العام: Year 1: Pre-Clinical Sciences
الموديول: Cardiovascular System
المادة: Medical Physiology
الشابتر: Cardiac Electrophysiology & Rhythm
المفهوم: Frank-Starling Mechanism

السؤال 1:
نص السؤال: Which cellular alteration best explains...
A) Choice A
*B) Choice B (الإجابة الصحيحة)
   التفسير: الشرح هنا...
   المرجع: Guyton p. 115
C) Choice C"
                className="form-textarea"
                style={{
                  minHeight: '260px',
                  fontFamily: 'monospace',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  direction: 'ltr',
                }}
              />
            </div>
          </div>

          {/* Parsed Preview Section */}
          {parsedExam && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                padding: '2rem',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-highlight)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.75rem',
              }}
            >
              {/* Preview Header & Execution Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Inspection & Validation
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                    معاينة الامتحان قبل الحفظ ({parsedExam.questions.length} سؤال تم التعرف عليه)
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={bulkLoading || parsedExam.questions.length === 0}
                  className="btn btn-primary btn-lg"
                  style={{ gap: '0.5rem' }}
                >
                  <Save size={18} />
                  <span>
                    {bulkLoading
                      ? 'جاري حفظ الامتحانات والأسئلة...'
                      : parsedExam.all_exams && parsedExam.all_exams.length > 1
                      ? `تأكيد وحفظ (${parsedExam.all_exams.length}) امتحانات (${parsedExam.questions.length} سؤال) دفعة واحدة`
                      : `تأكيد وحفظ الامتحان (${parsedExam.questions.length} سؤال)`}
                  </span>
                </button>
              </div>

              {/* Multi-Exam Notice Banner if file contains multiple exams */}
              {parsedExam.all_exams && parsedExam.all_exams.length > 1 && (
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1.5px solid rgba(168, 85, 247, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc', fontWeight: 700 }}>
                    <Sparkles size={18} />
                    <span>تم تحليل الملف بنجاح وتوزيعه تلقائياً إلى ({parsedExam.all_exams.length}) امتحانات منفصلة:</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {parsedExam.all_exams.map((subExam, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          padding: '0.85rem 1.1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span className="badge badge-teal">امتحان {sIdx + 1}</span>
                          <span className="badge badge-purple">{subExam.exam_type === 'end_module' ? 'END MODULE' : 'FINAL'}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{subExam.exam_title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                          {subExam.questions.length} سؤال • {subExam.module_name || parsedExam.module_name || 'Module'} • {subExam.duration_minutes || 60} دقيقة
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Metadata Summary Pills */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                    اسم الامتحان (Exam Title)
                  </span>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    {parsedExam.exam_title}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                    العام الأكاديمي (Academic Year)
                  </span>
                  <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>
                    {parsedExam.academic_year_name || 'تلقائي (السنة الأولى)'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                    الموديول (Module)
                  </span>
                  <strong style={{ color: '#2dd4bf', fontSize: '0.95rem' }}>
                    {parsedExam.module_name || 'تلقائي (أول موديول)'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                    نوع الامتحان (Exam Type)
                  </span>
                  <strong style={{ color: '#a855f7', fontSize: '0.95rem' }}>
                    {parsedExam.exam_type === 'end_module' ? 'END MODULE' : 'FINAL'}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>
                    المادة الافتراضية (Subject)
                  </span>
                  <strong style={{ color: '#c084fc', fontSize: '0.95rem' }}>
                    {parsedExam.default_subject_name || 'Medical Sciences'}
                  </strong>
                </div>
              </div>

              {/* Parsed Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  الأسئلة المستخرجة ({parsedExam.questions.length}):
                </h4>

                {parsedExam.questions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    {/* Question Header & Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-teal">السؤال {q.question_number || idx + 1}</span>
                        {q.subject_name && <span className="badge badge-blue">{q.subject_name}</span>}
                        {q.chapter_name && <span className="badge badge-purple">{q.chapter_name}</span>}
                        {q.concept_name && <span className="badge badge-warning">{q.concept_name}</span>}
                      </div>
                    </div>

                    {/* Vignette if present */}
                    {q.clinical_vignette && (
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          background: 'rgba(6, 182, 212, 0.05)',
                          borderLeft: '3px solid var(--cyan)',
                          borderRadius: '0 8px 8px 0',
                          fontSize: '0.9rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {q.clinical_vignette}
                      </div>
                    )}

                    {/* Question Text */}
                    <div style={{ fontSize: '1.02rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.5 }}>
                      {q.question_text}
                    </div>

                    {/* Choices Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
                      {q.choices.map((c) => (
                        <div
                          key={c.letter}
                          style={{
                            padding: '0.65rem 0.95rem',
                            borderRadius: 'var(--radius-sm)',
                            border: c.is_correct ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                            background: c.is_correct ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <strong style={{ color: c.is_correct ? '#10b981' : 'var(--text-dim)', minWidth: '22px' }}>
                              {c.letter})
                            </strong>
                            <span style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              {c.text}
                            </span>
                            {c.is_correct && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: '#10b981',
                                  background: 'rgba(16, 185, 129, 0.18)',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                }}
                              >
                                ✓ الإجابة الصحيحة
                              </span>
                            )}
                          </div>

                          {/* Explanation and reference */}
                          {(c.explanation || c.source_document) && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.8rem', paddingTop: '0.2rem', borderTop: '1px dashed var(--border-subtle)' }}>
                              {c.explanation && <div><strong>التفسير:</strong> {c.explanation}</div>}
                              {c.source_document && (
                                <div style={{ color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                                  <strong>المرجع:</strong> {c.source_document} {c.source_page ? `— ص: ${c.source_page}` : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Confirm Button */}
              <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={bulkLoading || parsedExam.questions.length === 0}
                  className="btn btn-primary btn-lg"
                  style={{ gap: '0.5rem' }}
                >
                  <Save size={18} />
                  <span>
                    {bulkLoading
                      ? 'جاري حفظ الامتحانات والأسئلة...'
                      : parsedExam.all_exams && parsedExam.all_exams.length > 1
                      ? `تأكيد وحفظ (${parsedExam.all_exams.length}) امتحانات (${parsedExam.questions.length} سؤال) دفعة واحدة`
                      : `تأكيد وحفظ الامتحان (${parsedExam.questions.length} سؤال)`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: ADMINS MANAGEMENT (SUPABASE) */}
      {activeTab === 'admins' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                <Users size={15} />
                <span>Supabase Admin Access Control</span>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                إدارة حسابات المشرفين (Admin Accounts)
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '750px' }}>
                يتم حفظ المشرفين وصلاحيات الدخول مباشرة في سحابة <strong>Supabase</strong> في جدول <code>admins</code>.
              </p>
            </div>

            <button
              onClick={() => setNewAdminModalOpen(true)}
              className="btn btn-primary"
              style={{ gap: '0.5rem' }}
            >
              <Plus size={16} />
              <span>إضافة مشرف جديد (New Admin)</span>
            </button>
          </div>

          {/* Supabase Notice Banner */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1.5px solid rgba(6, 182, 212, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <KeyRound size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  قاعدة البيانات السحابية: جدول <code>admins</code> في Supabase
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  يمكنك أيضاً إضافة المشرفين وتعديل كلمات المرور مباشرة من Supabase Dashboard عبر <strong>Table Editor ⬅️ admins</strong>.
                </div>
              </div>
            </div>
            <span className="badge badge-teal">Cloud Sync Active</span>
          </div>

          {/* Admins List Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {adminUsers.length === 0 ? (
              <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', gridColumn: '1 / -1', color: 'var(--text-muted)' }}>
                لم يتم إضافة مشرفين في جدول Supabase بعد. يمكنك الضغط على "إضافة مشرف جديد" لإنشاء أول حساب، أو استخدام كلمة المرور الاحتياطية.
              </div>
            ) : (
              adminUsers.map((adm) => (
                <div
                  key={adm.id}
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', fontWeight: 700, fontSize: '1rem' }}>
                        {adm.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-main)' }}>
                          {adm.full_name || adm.username}
                        </strong>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          @{adm.username}
                        </span>
                      </div>
                    </div>
                    <span className="badge badge-purple">{adm.is_active ? 'نشط (Active)' : 'معطل'}</span>
                  </div>

                  {adm.email && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      📧 {adm.email}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      ID: {adm.id}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`هل أنت متأكد من حذف المشرف "${adm.username}"؟`)) return;
                        try {
                          const res = await adminFetch(`/api/admin/users?id=${adm.id}`, { method: 'DELETE' });
                          const d = await res.json();
                          if (d.success) {
                            showFeedback('success', `تم حذف المشرف ${adm.username} بنجاح`);
                            refreshAllData();
                          } else {
                            showFeedback('error', d.message || d.error || 'فشل حذف المشرف');
                          }
                        } catch (err) {
                          showFeedback('error', String(err));
                        }
                      }}
                      className="btn btn-outline btn-sm"
                      style={{ color: '#fb7185', borderColor: 'rgba(251, 113, 133, 0.3)', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                    >
                      <Trash2 size={13} />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NEW ADMIN CREATION MODAL */}
      {newAdminModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 95,
            background: 'rgba(5, 10, 20, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            overflowY: 'auto',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '2rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-highlight)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>إضافة مشرف جديد (New Admin)</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  سيتم حفظ هذا الحساب في سحابة Supabase في جدول admins
                </div>
              </div>
              <button onClick={() => setNewAdminModalOpen(false)} style={{ color: 'var(--text-dim)', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAdminForm.username.trim() || !newAdminForm.password.trim()) {
                  showFeedback('error', 'اسم المستخدم وكلمة المرور مطلوبان');
                  return;
                }
                try {
                  const res = await adminFetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newAdminForm),
                  });
                  const d = await res.json();
                  if (d.success) {
                    showFeedback('success', `تمت إضافة المشرف "${newAdminForm.username}" بنجاح في Supabase!`);
                    setNewAdminModalOpen(false);
                    setNewAdminForm({ username: '', password: '', full_name: '', email: '' });
                    refreshAllData();
                  } else {
                    showFeedback('error', d.message || d.error || 'فشلت إضافة المشرف');
                  }
                } catch (err) {
                  showFeedback('error', String(err));
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <div className="form-group">
                <label className="form-label">Username (اسم المستخدم للـ Admin) *</label>
                <input
                  type="text"
                  value={newAdminForm.username}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                  placeholder="e.g. dr_sohaib"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password (كلمة المرور) *</label>
                <input
                  type="password"
                  value={newAdminForm.password}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  placeholder="كلمة مرور المشرف"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name (الاسم الكامل)</label>
                <input
                  type="text"
                  value={newAdminForm.full_name}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, full_name: e.target.value })}
                  placeholder="e.g. Dr. Sohaib"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (البريد الإلكتروني - اختياري)</label>
                <input
                  type="email"
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  placeholder="e.g. admin@example.com"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setNewAdminModalOpen(false)} className="btn btn-secondary">
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  حفظ المشرف في Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================== */}
      {/* EXAM CREATION & EDITING MODAL WITH FULL QUESTION MANAGER   */}
      {/* ========================================================== */}
      {examModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(5, 10, 20, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            overflowY: 'auto',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: '820px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '2rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-highlight)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                  {editingExamId ? 'تعديل بيانات الامتحان والأسئلة المرتبطة' : 'إنشاء امتحان جديد'}
                </h3>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {editingExamId
                    ? 'تعديل اسم الامتحان، المدة، درجة النجاح، وتحديد أو فك الأسئلة المرتبطة به دفعة واحدة'
                    : 'قم بضبط إعدادات الامتحان وتحديد تصنيفه وقائمة الأسئلة'}
                </div>
              </div>
              <button onClick={() => setExamModalOpen(false)} style={{ color: 'var(--text-dim)', padding: '0.5rem', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!examForm.title.trim()) {
                  showFeedback('error', 'Exam title is required');
                  return;
                }
                if (!examForm.academic_year_id || !examForm.module_id) {
                  showFeedback('error', 'Academic Year and Module are required');
                  return;
                }
                try {
                  if (editingExamId) {
                    const res = await adminFetch('/api/exams', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: editingExamId,
                        ...examForm,
                        question_ids: selectedExamQuestionIds,
                      }),
                    });
                    const d = await res.json();
                    if (d.success) {
                      showFeedback('success', `تم تحديث الامتحان "${examForm.title}" بنجاح مع ربط ${selectedExamQuestionIds.length} سؤال!`);
                      setExamModalOpen(false);
                      refreshAllData();
                    } else {
                      showFeedback('error', d.message || d.error || 'Failed to update exam');
                    }
                  } else {
                    const res = await adminFetch('/api/exams', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...examForm,
                        question_ids: selectedExamQuestionIds,
                      }),
                    });
                    const d = await res.json();
                    if (d.success) {
                      showFeedback('success', `تم إنشاء الامتحان "${examForm.title}" بنجاح مع ربط ${selectedExamQuestionIds.length} سؤال!`);
                      setExamModalOpen(false);
                      refreshAllData();
                    } else {
                      showFeedback('error', d.message || d.error || 'Failed to create exam');
                    }
                  }
                } catch (err) {
                  showFeedback('error', String(err));
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <div className="form-group">
                <label className="form-label">اسم الامتحان (Exam Title) *</label>
                <input
                  type="text"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  placeholder="e.g. Cardiovascular System End Module Exam 2026"
                  className="form-input"
                  required
                />
              </div>

              {/* Exam Type Selection: END MODULE vs FINAL */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>
                  نوع الامتحان (Exam Classification) *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setExamForm({ ...examForm, exam_type: 'end_module' })}
                    style={{
                      padding: '0.9rem',
                      borderRadius: 'var(--radius-md)',
                      border: examForm.exam_type === 'end_module' ? '2px solid #a855f7' : '1px solid var(--border-subtle)',
                      background: examForm.exam_type === 'end_module' ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-surface-elevated)',
                      color: examForm.exam_type === 'end_module' ? '#c084fc' : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>END MODULE</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8 }}>امتحان نهاية الموديول</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamForm({ ...examForm, exam_type: 'final' })}
                    style={{
                      padding: '0.9rem',
                      borderRadius: 'var(--radius-md)',
                      border: examForm.exam_type === 'final' ? '2px solid #06b6d4' : '1px solid var(--border-subtle)',
                      background: examForm.exam_type === 'final' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-surface-elevated)',
                      color: examForm.exam_type === 'final' ? '#38bdf8' : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>FINAL</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8 }}>الامتحان النهائي الشامل</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">السنة الدراسية (Academic Year) *</label>
                  <select
                    value={examForm.academic_year_id}
                    onChange={(e) => setExamForm({ ...examForm, academic_year_id: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Select Year...</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">الموديول (Module) *</label>
                  <select
                    value={examForm.module_id}
                    onChange={(e) => setExamForm({ ...examForm, module_id: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Select Module...</option>
                    {modules
                      .filter((m) => !examForm.academic_year_id || m.academic_year_id === examForm.academic_year_id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">مدة الامتحان بالدقائق (Duration Minutes)</label>
                  <input
                    type="number"
                    value={examForm.duration_minutes}
                    onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value, 10) || 60 })}
                    className="form-input"
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">درجة النجاح % (Passing Score)</label>
                  <input
                    type="number"
                    value={examForm.passing_score}
                    onChange={(e) => setExamForm({ ...examForm, passing_score: parseInt(e.target.value, 10) || 70 })}
                    className="form-input"
                    min="1"
                    max="100"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">تعليمات الامتحان (Instructions)</label>
                <textarea
                  value={examForm.instructions}
                  onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                  placeholder="Instructions for students taking this exam..."
                  className="form-textarea"
                  style={{ minHeight: '60px' }}
                />
              </div>

              {/* ========================================================== */}
              {/* BULK QUESTION SELECTOR / ASSIGNMENT SECTION                */}
              {/* ========================================================== */}
              <div
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>إدارة وربط أسئلة الامتحان دفعة واحدة</span>
                      <span className="badge badge-teal">{selectedExamQuestionIds.length} سؤال محدد</span>
                    </label>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      حدد أو ألغِ تحديد الأسئلة التي يجب أن يتضمنها هذا الامتحان
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = questions.filter((q) => {
                          if (examQuestionFilterModule !== 'all' && q.module_id !== examQuestionFilterModule) return false;
                          if (examQuestionSearch.trim()) {
                            const term = examQuestionSearch.trim().toLowerCase();
                            return (
                              q.question_text?.toLowerCase().includes(term) ||
                              q.subject?.name?.toLowerCase().includes(term) ||
                              q.chapter?.name?.toLowerCase().includes(term) ||
                              q.concept?.name?.toLowerCase().includes(term)
                            );
                          }
                          return true;
                        });
                        const newSet = new Set(selectedExamQuestionIds);
                        filtered.forEach((q) => newSet.add(q.id));
                        setSelectedExamQuestionIds(Array.from(newSet));
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                    >
                      تحديد كل المصفى
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedExamQuestionIds([])}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#f87171' }}
                    >
                      إلغاء تحديد الكل
                    </button>
                  </div>
                </div>

                {/* Filter and search bar inside question selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                      type="text"
                      value={examQuestionSearch}
                      onChange={(e) => setExamQuestionSearch(e.target.value)}
                      placeholder="ابحث في الأسئلة بنص السؤال أو المادة أو المفهوم..."
                      className="form-input"
                      style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <select
                    value={examQuestionFilterModule}
                    onChange={(e) => setExamQuestionFilterModule(e.target.value)}
                    className="form-select"
                    style={{ fontSize: '0.85rem', minWidth: '170px' }}
                  >
                    <option value="all">كل الموديولات</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Question List Box */}
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {questions
                    .filter((q) => {
                      if (examQuestionFilterModule !== 'all' && q.module_id !== examQuestionFilterModule) return false;
                      if (examQuestionSearch.trim()) {
                        const term = examQuestionSearch.trim().toLowerCase();
                        return (
                          q.question_text?.toLowerCase().includes(term) ||
                          q.subject?.name?.toLowerCase().includes(term) ||
                          q.chapter?.name?.toLowerCase().includes(term) ||
                          q.concept?.name?.toLowerCase().includes(term)
                        );
                      }
                      return true;
                    })
                    .map((q, idx) => {
                      const isSelected = selectedExamQuestionIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedExamQuestionIds(selectedExamQuestionIds.filter((id) => id !== q.id));
                            } else {
                              setSelectedExamQuestionIds([...selectedExamQuestionIds, q.id]);
                            }
                          }}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by container onClick
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', minWidth: '30px' }}>
                            #{idx + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                              {q.subject?.name && (
                                <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                                  {q.subject.name}
                                </span>
                              )}
                              {q.concept?.name && (
                                <span className="badge badge-teal" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>
                                  {q.concept.name}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '0.83rem',
                                color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {q.question_text}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {questions.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      لا توجد أسئلة مسجلة في قاعدة البيانات حالياً
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setExamModalOpen(false)} className="btn btn-secondary">
                  إلغاء (Cancel)
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <Save size={16} />
                  <span>
                    {editingExamId
                      ? `حفظ تعديلات الامتحان (${selectedExamQuestionIds.length} سؤال)`
                      : `إنشاء الامتحان (${selectedExamQuestionIds.length} سؤال)`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL QUESTION CREATION & EDITING MODAL (SECTIONS 16 & 17)  */}
      {/* ========================================================== */}
      {questionModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(5, 10, 20, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            overflowY: 'auto',
          }}
        >
          <div
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-highlight)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                  {editingQuestionId ? 'Edit Medical Question' : 'Create New Medical Question'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Assign to curriculum hierarchy, define per-choice explanations, and cite exact textbook literature.
                </div>
              </div>
              <button onClick={() => setQuestionModalOpen(false)} style={{ color: 'var(--text-dim)', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Hierarchy Dropdowns: Year, Module, Subject, Chapter, Concept */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select
                    value={qForm.academic_year_id}
                    onChange={(e) => setQForm({ ...qForm, academic_year_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Year...</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Module</label>
                  <select
                    value={qForm.module_id}
                    onChange={(e) => setQForm({ ...qForm, module_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Module...</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select
                    value={qForm.subject_id}
                    onChange={(e) => setQForm({ ...qForm, subject_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Chapter</label>
                  <select
                    value={qForm.chapter_id}
                    onChange={(e) => setQForm({ ...qForm, chapter_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Chapter...</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Concept</label>
                  <select
                    value={qForm.concept_id}
                    onChange={(e) => setQForm({ ...qForm, concept_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Concept...</option>
                    {concepts.map((con) => (
                      <option key={con.id} value={con.id}>{con.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clinical Vignette (Optional) */}
              <div className="form-group">
                <label className="form-label">Clinical Case Vignette (Optional)</label>
                <textarea
                  value={qForm.clinical_vignette}
                  onChange={(e) => setQForm({ ...qForm, clinical_vignette: e.target.value })}
                  placeholder="e.g. A 64-year-old female presents with acute shortness of breath..."
                  className="form-textarea"
                  style={{ minHeight: '65px' }}
                />
              </div>

              {/* Main Question Text */}
              <div className="form-group">
                <label className="form-label">Question Text *</label>
                <textarea
                  value={qForm.question_text}
                  onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })}
                  placeholder="Which of the following is the most likely diagnosis?"
                  className="form-textarea"
                  required
                />
              </div>

              {/* Answer Choices & Explanations */}
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#38bdf8' }}>
                  Answer Choices & Per-Choice Explanations
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {qForm.answer_choices.map((choice, idx) => {
                    const expl = qForm.explanations[idx] || {
                      explanation_text: '',
                      source_document: '',
                      source_page: '',
                      source_reference: '',
                    };

                    return (
                      <div
                        key={choice.choice_letter}
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          padding: '1.25rem',
                          borderRadius: 'var(--radius-md)',
                          border: choice.is_correct ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <span
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              background: choice.is_correct ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                              color: '#ffffff',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {choice.choice_letter}
                          </span>

                          <input
                            type="text"
                            value={choice.choice_text}
                            onChange={(e) => {
                              const copy = [...qForm.answer_choices];
                              copy[idx].choice_text = e.target.value;
                              setQForm({ ...qForm, answer_choices: copy });
                            }}
                            placeholder={`Choice ${choice.choice_letter} text...`}
                            className="form-input"
                            style={{ flex: 1 }}
                            required
                          />

                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input
                              type="radio"
                              name="correctChoiceRadio"
                              checked={choice.is_correct}
                              onChange={() => {
                                const newChoices = qForm.answer_choices.map((c, i) => ({
                                  ...c,
                                  is_correct: i === idx,
                                }));
                                const newExpls = qForm.explanations.map((e, i) => ({
                                  ...e,
                                  is_why_correct: i === idx,
                                  is_why_incorrect: i !== idx,
                                }));
                                setQForm({ ...qForm, answer_choices: newChoices, explanations: newExpls });
                              }}
                            />
                            <span style={{ color: choice.is_correct ? '#34d399' : 'var(--text-muted)', fontWeight: 600 }}>
                              Correct Answer
                            </span>
                          </label>
                        </div>

                        {/* Per-choice explanation text */}
                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                          <label className="form-label">
                            {choice.is_correct ? 'Why This Choice is Correct' : 'Why This Choice is Incorrect'}
                          </label>
                          <textarea
                            value={expl.explanation_text}
                            onChange={(e) => {
                              const copy = [...qForm.explanations];
                              copy[idx].explanation_text = e.target.value;
                              setQForm({ ...qForm, explanations: copy });
                            }}
                            placeholder={`Explain why Choice ${choice.choice_letter} is ${choice.is_correct ? 'correct' : 'incorrect'}...`}
                            className="form-textarea"
                            style={{ minHeight: '55px', fontSize: '0.88rem' }}
                          />
                        </div>

                        {/* Literature citation */}
                        {choice.is_correct && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Source Document / Textbook</label>
                              <input
                                type="text"
                                value={expl.source_document}
                                onChange={(e) => {
                                  const copy = [...qForm.explanations];
                                  copy[idx].source_document = e.target.value;
                                  setQForm({ ...qForm, explanations: copy });
                                }}
                                placeholder="e.g. Guyton and Hall Physiology 14th Ed"
                                className="form-input"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">Exact Page Reference</label>
                              <input
                                type="text"
                                value={expl.source_page}
                                onChange={(e) => {
                                  const copy = [...qForm.explanations];
                                  copy[idx].source_page = e.target.value;
                                  setQForm({ ...qForm, explanations: copy });
                                }}
                                placeholder="e.g. p. 412"
                                className="form-input"
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setQuestionModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <Save size={16} />
                  <span>{editingQuestionId ? 'Update Question' : 'Save Question to Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
