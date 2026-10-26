'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileCheck2,
  BookOpen,
  Sparkles,
  Bookmark,
  TrendingDown,
  ArrowLeft,
  AlertCircle,
  Clock,
  CheckCircle2,
  Play,
  Zap,
  Trophy,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Send,
  X,
  Flag,
} from 'lucide-react';
import { Question, BookmarkCategory, StudentAttempt } from '@/lib/types';
import QuestionCard from '@/components/QuestionCard';
import QuestionNavigation from '@/components/QuestionNavigation';
import UnansweredWarningDialog from '@/components/UnansweredWarningDialog';
import ExamResultsView from '@/components/ExamResultsView';

interface PracticePageProps {
  params: Promise<{
    mode: string;
    id: string;
  }>;
}

function PracticeInner({ params }: PracticePageProps) {
  const router = useRouter();
  const { mode, id } = use(params);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Practice Session');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active question index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers & flags maps: questionId -> selectedChoiceId
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [bookmarksMap, setBookmarksMap] = useState<Record<string, BookmarkCategory>>({});
  const [bookmarksNotesMap, setBookmarksNotesMap] = useState<Record<string, string>>({});

  // Feedback & Correction Mode:
  // 'instant' = تصحيح فوري سؤال بسؤال (Tutor Mode)
  // 'exam_end' = إظهار الإجابات بعد الانتهاء من الامتحان كاملاً (Exam Mode)
  const [feedbackMode, setFeedbackMode] = useState<'instant' | 'exam_end'>(
    mode === 'complete_exam' ? 'exam_end' : 'instant'
  );
  const [sessionStarted, setSessionStarted] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [pastAttempts, setPastAttempts] = useState<StudentAttempt[]>([]);

  // Exam timing & status
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [secondsRemaining, setSecondsRemaining] = useState(60 * 60);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [paletteDrawerOpen, setPaletteDrawerOpen] = useState(false);

  // Load questions for the selected mode and entity id
  useEffect(() => {
    async function loadQuestions() {
      try {
        setLoading(true);
        let url = '';
        let titleUrl = '';

        if (mode === 'complete_exam') {
          url = `/api/questions?exam_id=${id}`;
          titleUrl = `/api/exams?id=${id}`;
        } else if (mode === 'subject_practice') {
          url = `/api/questions?subject_id=${id}`;
        } else if (mode === 'chapter_practice') {
          url = `/api/questions?chapter_id=${id}`;
        } else if (mode === 'concept_practice' || mode === 'repeated_concept') {
          url = `/api/questions?concept_id=${id}`;
        } else if (mode === 'bookmarks_practice') {
          url = `/api/bookmarks`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) {
          setError(data.message || 'Failed to load questions');
          return;
        }

        let loadedQuestions: Question[] = [];
        if (mode === 'bookmarks_practice') {
          // data.data is Bookmark[]
          loadedQuestions = data.data.map((b: { question: Question }) => b.question).filter(Boolean);
          setSessionTitle('My Question Bank Practice');
        } else {
          loadedQuestions = data.data;
        }

        setQuestions(loadedQuestions);

        // Restore any in-progress answers from local storage
        try {
          const cached = localStorage.getItem(`omnimed_active_${mode}_${id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.answers && Object.keys(parsed.answers).length > 0) {
              setAnswers(parsed.answers);
              setHasSavedProgress(true);
            }
            if (parsed.flags) setFlags(parsed.flags);
          }
        } catch {}

        // Fetch exam title if exam mode
        if (mode === 'complete_exam' && titleUrl) {
          const exRes = await fetch(titleUrl);
          const exData = await exRes.json();
          if (exData.success && exData.data) {
            setSessionTitle(exData.data.title);
            if (exData.data.duration_minutes) {
              setDurationMinutes(exData.data.duration_minutes);
            }
          }
        } else if (loadedQuestions.length > 0) {
          if (mode === 'subject_practice') {
            setSessionTitle(`${loadedQuestions[0].subject?.name || 'Subject'} Practice`);
          } else if (mode === 'chapter_practice') {
            setSessionTitle(`${loadedQuestions[0].chapter?.name || 'Chapter'} Practice`);
          } else if (mode === 'concept_practice' || mode === 'repeated_concept') {
            setSessionTitle(`Concept: ${loadedQuestions[0].concept?.name || 'Targeted Practice'}`);
          }
        }

        // Preload bookmarks & personal notes
        const bRes = await fetch('/api/bookmarks');
        const bData = await bRes.json();
        if (bData.success) {
          const map: Record<string, BookmarkCategory> = {};
          const notesMap: Record<string, string> = {};
          bData.data.forEach((b: { question_id: string; category: BookmarkCategory; notes?: string }) => {
            map[b.question_id] = b.category;
            if (b.notes) notesMap[b.question_id] = b.notes;
          });
          setBookmarksMap(map);
          setBookmarksNotesMap(notesMap);
        }

        // Preload past attempts for this exam
        try {
          const attRes = await fetch(`/api/attempts?entity_id=${id}&include_answers=true`);
          const attData = await attRes.json();
          if (attData.success && Array.isArray(attData.data)) {
            setPastAttempts(attData.data);
          }
        } catch {}
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [mode, id]);

  // Persist answers & flags to localStorage to survive network disconnects or accidental reloads
  useEffect(() => {
    if (Object.keys(answers).length > 0 || Object.keys(flags).length > 0) {
      try {
        localStorage.setItem(`omnimed_active_${mode}_${id}`, JSON.stringify({ answers, flags }));
      } catch {}
    }
  }, [answers, flags, mode, id]);

  // Synchronize timer countdown
  useEffect(() => {
    setSecondsRemaining(durationMinutes * 60);
  }, [durationMinutes]);

  useEffect(() => {
    if (!sessionStarted || mode !== 'complete_exam' || isSubmitted) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStarted, mode, isSubmitted]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJumpToQuestion = (idx: number) => {
    setCurrentIndex(idx);
    setPaletteDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevQuestion = () => {
    setCurrentIndex((idx) => Math.max(0, idx - 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextQuestion = () => {
    setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentQ = questions[currentIndex];
  const questionIds = questions.map((q) => q.id);

  // User Actions
  const handleSelectChoice = (choiceId: string) => {
    if (!currentQ || isSubmitted) return;
    // Prevent changing answer if already answered in instant feedback mode
    if (feedbackMode === 'instant' && answers[currentQ.id]) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: choiceId,
    }));
  };

  const handleClearChoice = () => {
    if (!currentQ || isSubmitted) return;
    // Prevent clearing answer if already answered in instant feedback mode
    if (feedbackMode === 'instant' && answers[currentQ.id]) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const handleToggleFlag = () => {
    if (!currentQ) return;
    setFlags((prev) => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id],
    }));
  };

  const handleBookmark = async (
    category: BookmarkCategory,
    notes?: string,
    action?: 'toggle' | 'save' | 'remove'
  ) => {
    if (!currentQ) return;
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQ.id,
          category,
          notes,
          action,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarksMap((prev) => {
          const copy = { ...prev };
          if (data.bookmarked) {
            copy[currentQ.id] = category;
          } else {
            delete copy[currentQ.id];
          }
          return copy;
        });
        setBookmarksNotesMap((prev) => {
          const copy = { ...prev };
          if (data.bookmarked && notes !== undefined) {
            copy[currentQ.id] = notes;
          } else if (!data.bookmarked) {
            delete copy[currentQ.id];
          }
          return copy;
        });
      }
    } catch (err) {
      console.error('Error updating bookmark:', err);
    }
  };

  // Warning before submit
  const handleInitiateSubmit = () => {
    const unansweredCount = questions.filter((q) => !answers[q.id]).length;
    if (unansweredCount > 0) {
      setWarningModalOpen(true);
    } else {
      handleFinalSubmit();
    }
  };

  // Final submit & calculation
  const handleFinalSubmit = async () => {
    setWarningModalOpen(false);
    const timeSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    setTimeSpentSeconds(timeSpent);
    setIsSubmitted(true);

    // Compute stats
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const studentAnswersPayload = questions.map((q) => {
      const selectedChoiceId = answers[q.id] || null;
      let isCorrect = false;
      if (!selectedChoiceId) {
        unansweredCount += 1;
      } else {
        const choice = q.answer_choices.find((c) => c.id === selectedChoiceId);
        if (choice?.is_correct) {
          isCorrect = true;
          correctCount += 1;
        } else {
          incorrectCount += 1;
        }
      }

      return {
        question_id: q.id,
        selected_choice_id: selectedChoiceId,
        is_correct: isCorrect,
        is_flagged: !!flags[q.id],
      };
    });

    const scorePercentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

    // Send attempt to API
    try {
      const attRes = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: mode as any,
          entity_id: id,
          title: sessionTitle,
          total_questions: questions.length,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          unanswered_count: unansweredCount,
          score_percentage: scorePercentage,
          time_spent_seconds: timeSpent,
          answers: studentAnswersPayload,
        }),
      });
      const attData = await attRes.json();
      if (attData.success && attData.data) {
        setPastAttempts((prev) => [attData.data, ...prev]);
      }
      try {
        localStorage.removeItem(`omnimed_active_${mode}_${id}`);
      } catch {}
    } catch (err) {
      console.error('Failed to record attempt:', err);
    }
  };

  const handleRetakeExam = () => {
    setAnswers({});
    setFlags({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setSessionStarted(false);
    setStartTime(Date.now());
    setTimeSpentSeconds(0);
    try {
      localStorage.removeItem(`omnimed_active_${mode}_${id}`);
    } catch {}
  };

  // Loading / Error states
  if (loading) {
    return (
      <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Initializing distraction-free question engine...
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="container-narrow" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '3rem 2rem', borderRadius: 'var(--radius-xl)' }}>
          <AlertCircle size={40} color="#fb7185" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            No Questions Available
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {error || 'No questions are linked to this examination or topic yet.'}
          </p>
          <button onClick={() => router.back()} className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  // Submitted: Show ExamResultsView
  if (isSubmitted) {
    return (
      <ExamResultsView
        title={sessionTitle}
        questions={questions}
        userAnswers={answers}
        timeSpentSeconds={timeSpentSeconds}
        examId={id}
        mode={mode}
        pastAttempts={pastAttempts}
        onRetryIncorrect={() => {}}
        onRetakeExam={handleRetakeExam}
        onBackToDashboard={() => router.push('/')}
      />
    );
  }

  // Pre-Flight Feedback Mode Selection Screen (اختر نمط التصحيح قبل بدء الامتحان)
  if (!sessionStarted) {
    return (
      <div className="container preflight-container" style={{ padding: '3rem 1.5rem 5rem', maxWidth: '780px' }}>
        <div
          className="glass-panel animate-fade-in preflight-card"
          style={{
            padding: '2.5rem',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-highlight)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--cyan)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.75rem',
              }}
            >
              <FileCheck2 size={14} />
              <span>{mode === 'complete_exam' ? 'إعدادات الاختبار الكامل' : 'إعدادات جلسة التدريب'}</span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              {sessionTitle}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '580px', margin: '0 auto', lineHeight: 1.5 }}>
              يرجى اختيار طريقة تصحيح وعرض الإجابات المفضلة لديك قبل بدء الجلسة.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '1rem',
              padding: '1rem 1.25rem',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '2rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)' }}>
                <FileCheck2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>عدد الأسئلة</div>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{questions.length} سؤال</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>الوقت المخصص</div>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{durationMinutes} دقيقة</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>نظام التصحيح</div>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>معتمد المراجع</strong>
              </div>
            </div>
          </div>

          {/* Past Attempts Summary Banner (if student already took this exam) */}
          {pastAttempts.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.9rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                marginBottom: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Trophy size={19} color="var(--cyan)" />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    لديك {pastAttempts.length} محاولة سابقة لهذا الاختبار
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    أعلى نتيجة: {Math.max(...pastAttempts.map((a) => a.score_percentage))}% | آخر نتيجة: {pastAttempts[0]?.score_percentage}%
                  </div>
                </div>
              </div>
              <span className="badge badge-teal" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                المحاولة القادمة #{pastAttempts.length + 1}
              </span>
            </div>
          )}

          {/* Feedback Mode Selection Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              طريقة مراجعة وتصحيح الإجابات:
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              اختر النمط المناسب لهدفك اليوم (المذاكرة الفورية أو المحاكاة الكاملة):
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {/* Option A: Instant Correction (سؤال بسؤال) */}
              <div
                onClick={() => setFeedbackMode('instant')}
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  background: feedbackMode === 'instant' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-surface-elevated)',
                  border: feedbackMode === 'instant' ? '2px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: feedbackMode === 'instant' ? '0 8px 24px var(--card-highlight-glow)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.02rem', color: feedbackMode === 'instant' ? 'var(--cyan)' : 'var(--text-main)' }}>
                    <Sparkles size={18} color="var(--cyan)" />
                    <span>تصحيح فوري (سؤال بسؤال)</span>
                  </div>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: feedbackMode === 'instant' ? '5px solid var(--cyan)' : '2px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'inline-block',
                    alignSelf: 'flex-start',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: 'var(--cyan)',
                  }}
                >
                  ⚡ وضع المذاكرة وتثبيت المعلومات (Tutor Mode)
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  تظهر صحة إجابتك فور اختيارها (صحيحة أو خاطئة) مع التفسير الطبي الشامل ومراجع الكتاب فوراً قبل الانتقال للسؤال التالي.
                </p>
              </div>

              {/* Option B: Exam Mode (بعد انتهاء الامتحان كاملاً) */}
              <div
                onClick={() => setFeedbackMode('exam_end')}
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  background: feedbackMode === 'exam_end' ? 'rgba(13, 148, 136, 0.12)' : 'var(--bg-surface-elevated)',
                  border: feedbackMode === 'exam_end' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: feedbackMode === 'exam_end' ? '0 8px 24px var(--primary-glow)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.02rem', color: feedbackMode === 'exam_end' ? 'var(--primary)' : 'var(--text-main)' }}>
                    <Clock size={18} color="var(--primary)" />
                    <span>بعد الانتهاء من الامتحان كاملاً</span>
                  </div>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: feedbackMode === 'exam_end' ? '5px solid var(--primary)' : '2px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'inline-block',
                    alignSelf: 'flex-start',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(13, 148, 136, 0.15)',
                    color: 'var(--primary)',
                  }}
                >
                  ⏱️ محاكاة واقعية للامتحان الحقيقي (Exam Mode)
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  تبقى الإجابات والتفسيرات مخفية تماماً أثناء الحل، وتظهر فقط بعد إنهاء الامتحان وتسليمه كاملاً مع تقرير النتيجة النهائي.
                </p>
              </div>
            </div>
          </div>

          {/* Saved Session Notice if any */}
          {hasSavedProgress && Object.keys(answers).length > 0 && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.86rem',
              }}
            >
              <span style={{ color: '#fbbf24' }}>
                📌 توجد إجابات سابقة محفوظة لهذا الامتحان ({Object.keys(answers).length} سؤال تم حله).
              </span>
              <button
                onClick={() => {
                  setAnswers({});
                  setFlags({});
                  setHasSavedProgress(false);
                  try {
                    localStorage.removeItem(`omnimed_active_${mode}_${id}`);
                  } catch {}
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', padding: '2px 8px' }}
              >
                البدء من جديد
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => router.back()}
              className="btn btn-secondary"
              style={{ gap: '0.4rem' }}
            >
              <ArrowLeft size={16} />
              <span>الرجوع للخلف</span>
            </button>

            <button
              onClick={() => {
                setStartTime(Date.now());
                setSessionStarted(true);
              }}
              className="btn btn-primary btn-lg"
              style={{
                gap: '0.5rem',
                padding: '0.85rem 2rem',
                fontSize: '1.05rem',
                boxShadow: '0 4px 18px rgba(13, 148, 136, 0.45)',
              }}
            >
              <span>
                {hasSavedProgress
                  ? 'استئناف الامتحان الآن'
                  : pastAttempts.length > 0
                  ? `بدء المحاولة الجديدة #${pastAttempts.length + 1}`
                  : 'ابدأ الامتحان الآن'}
              </span>
              <Play size={16} fill="#ffffff" />
            </button>
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 768px) {
            :global(.preflight-container) {
              padding: 1rem 0.5rem 3rem !important;
            }
            :global(.preflight-card) {
              padding: 1.25rem 0.85rem !important;
              border-radius: var(--radius-md) !important;
            }
          }
        `}</style>
      </div>
    );
  }

  const unansweredIndices = questions
    .map((q, idx) => (!answers[q.id] ? idx : -1))
    .filter((idx) => idx !== -1);

  const answeredCount = questionIds.filter((qid) => answers[qid] !== undefined && answers[qid] !== null).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="practice-page-wrapper">
      {/* 1. Mobile Compact Sticky Header (Visible ONLY on mobile <= 768px) */}
      <header className="mobile-exam-top-bar glass-panel">
        <div className="mobile-bar-content">
          <button
            onClick={() => router.back()}
            className="mobile-header-btn"
            title="خروج من الجلسة"
            aria-label="Exit Session"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="mobile-header-center">
            <span className="mobile-q-badge">
              سؤال <strong>{currentIndex + 1}</strong> <span style={{ opacity: 0.6 }}>/ {questions.length}</span>
            </span>

            {mode === 'complete_exam' && !isSubmitted && (
              <span className={`mobile-timer-pill ${secondsRemaining < 300 ? 'urgent' : ''}`}>
                <Clock size={13} />
                <span>{formatTimer(secondsRemaining)}</span>
              </span>
            )}

            <button
              onClick={() => setFeedbackMode((prev) => (prev === 'instant' ? 'exam_end' : 'instant'))}
              className="mobile-mode-pill"
              title="انقر لتغيير نمط التصحيح"
            >
              {feedbackMode === 'instant' ? '⚡ فوري' : '⏱️ نهائي'}
            </button>
          </div>

          <div className="mobile-header-actions">
            {currentQ && (
              <button
                onClick={handleToggleFlag}
                className={`mobile-flag-btn ${flags[currentQ.id] ? 'is-flagged' : ''}`}
                title={flags[currentQ.id] ? 'إلغاء التمييز' : 'تمييز السؤال للمراجعة'}
                aria-label="Flag question"
              >
                <Flag size={16} fill={flags[currentQ.id] ? '#f59e0b' : 'none'} />
              </button>
            )}
          </div>
        </div>

        {/* Thin progress indicator bar along bottom of mobile header */}
        <div className="mobile-progress-track">
          <div className="mobile-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {/* Main Container */}
      <div className="container practice-main-container">
        {/* Desktop Session Title & Breadcrumbs Bar (Visible ONLY on desktop > 768px) */}
        <div className="desktop-session-header">
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} />
            <span>Exit Session</span>
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
              {mode === 'complete_exam' ? 'AUTHENTIC EXAMINATION MODE' : 'PRACTICE MODE'}
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: '0.1rem 0' }}>
              {sessionTitle}
            </h1>

            {/* In-Exam Mode Toggle Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>نمط التصحيح:</span>
              <button
                onClick={() => setFeedbackMode((prev) => (prev === 'instant' ? 'exam_end' : 'instant'))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: feedbackMode === 'instant' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: feedbackMode === 'instant' ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  color: feedbackMode === 'instant' ? 'var(--cyan)' : '#f59e0b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="انقر هنا لتغيير نمط التصحيح أثناء الامتحان"
              >
                {feedbackMode === 'instant' ? <Sparkles size={12} /> : <Clock size={12} />}
                <span>{feedbackMode === 'instant' ? 'تصحيح فوري (سؤال بسؤال)' : 'تصحيح بعد الانتهاء كاملاً'}</span>
              </button>
            </div>
          </div>

          <div style={{ width: '80px' }} /> {/* Spacer */}
        </div>

        {/* Main Solving Grid: Question Area (left) & Navigation Panel (right) */}
        <div className="practice-layout">
          {/* Active Question Card (Spans full width on mobile, 1fr on desktop) */}
          <div className="practice-question-area">
            {currentQ && (
              <QuestionCard
                key={currentQ.id}
                question={currentQ}
                questionIndex={currentIndex}
                totalQuestions={questions.length}
                selectedChoiceId={answers[currentQ.id] || null}
                isFlagged={!!flags[currentQ.id]}
                activeBookmarkCategory={bookmarksMap[currentQ.id] || null}
                activeBookmarkNote={bookmarksNotesMap[currentQ.id] || ''}
                mode={mode as any}
                feedbackMode={feedbackMode}
                isSubmitted={false}
                onSelectChoice={handleSelectChoice}
                onClearChoice={handleClearChoice}
                onToggleFlag={handleToggleFlag}
                onBookmark={handleBookmark}
              />
            )}
          </div>

          {/* Desktop Question Navigation Matrix & Timer (Hidden on mobile <= 768px) */}
          <div className="desktop-navigation-sidebar">
            <QuestionNavigation
              currentIndex={currentIndex}
              totalQuestions={questions.length}
              answers={answers}
              flags={flags}
              questionIds={questionIds}
              durationMinutes={durationMinutes}
              secondsRemaining={secondsRemaining}
              isExamMode={mode === 'complete_exam'}
              isSubmitted={false}
              onSelectIndex={handleJumpToQuestion}
              onPrevious={handlePrevQuestion}
              onNext={handleNextQuestion}
              onSubmit={handleInitiateSubmit}
            />
          </div>
        </div>
      </div>

      {/* 2. Mobile Sticky Bottom Navigation Bar (Visible ONLY on mobile <= 768px) */}
      <nav className="mobile-bottom-bar glass-panel">
        <button
          onClick={handlePrevQuestion}
          disabled={currentIndex === 0}
          className="mobile-bottom-btn"
          style={{ opacity: currentIndex === 0 ? 0.35 : 1 }}
        >
          <ChevronLeft size={18} />
          <span>السابق</span>
        </button>

        <button
          onClick={() => setPaletteDrawerOpen(true)}
          className="mobile-bottom-btn mobile-bottom-palette-btn"
        >
          <Layers size={17} color="#06b6d4" />
          <span>الأسئلة ({answeredCount}/{questions.length})</span>
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={handleNextQuestion}
            className="mobile-bottom-btn mobile-bottom-next-btn"
          >
            <span>التالي</span>
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleInitiateSubmit}
            className="mobile-bottom-btn mobile-bottom-submit-btn"
          >
            <span>تسليم</span>
            <CheckCircle2 size={18} />
          </button>
        )}
      </nav>

      {/* 3. Mobile Slide-Up Question Palette Bottom Sheet (Drawer) */}
      {paletteDrawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setPaletteDrawerOpen(false)}>
          <div
            className="mobile-drawer-sheet glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-drawer-handle" />

            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
                <Layers size={20} color="#06b6d4" />
                <span>خريطة أسئلة الامتحان</span>
              </div>
              <button
                onClick={() => setPaletteDrawerOpen(false)}
                className="mobile-drawer-close"
                aria-label="Close question drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Legend & Stats */}
            <div className="mobile-drawer-stats">
              <span>تم الإجابة: <strong style={{ color: '#2dd4bf' }}>{answeredCount}</strong></span>
              <span>المتبقي: <strong style={{ color: 'var(--text-muted)' }}>{questions.length - answeredCount}</strong></span>
              <span>مُميز: <strong style={{ color: '#fbbf24' }}>{Object.values(flags).filter(Boolean).length}</strong></span>
            </div>

            <div className="mobile-drawer-legend">
              <span className="legend-item"><span className="legend-dot dot-answered" /> تم الحل</span>
              <span className="legend-item"><span className="legend-dot dot-current" /> الحالي</span>
              <span className="legend-item"><span className="legend-dot dot-flagged" /> مُميز</span>
              <span className="legend-item"><span className="legend-dot dot-unanswered" /> فارغ</span>
            </div>

            {/* Palette Grid */}
            <div className="mobile-drawer-grid">
              {questionIds.map((qid, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[qid] !== undefined && answers[qid] !== null;
                const isFlagged = !!flags[qid];

                let btnClass = 'drawer-grid-btn';
                if (isAnswered) btnClass += ' answered';
                if (isFlagged) btnClass += ' flagged';
                if (isCurrent) btnClass += ' current';

                return (
                  <button
                    key={qid}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={btnClass}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer Actions */}
            <div className="mobile-drawer-footer">
              <button
                onClick={() => {
                  setPaletteDrawerOpen(false);
                  handleInitiateSubmit();
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontWeight: 700 }}
              >
                <span>{mode === 'complete_exam' ? 'تسليم الامتحان النهائي' : 'إنهاء جلسة التدريب'}</span>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unanswered Questions Warning Modal (Requirement #15) */}
      <UnansweredWarningDialog
        isOpen={warningModalOpen}
        unansweredCount={unansweredIndices.length}
        totalQuestions={questions.length}
        unansweredIndices={unansweredIndices}
        onCancel={() => setWarningModalOpen(false)}
        onConfirmSubmit={handleFinalSubmit}
        onJumpToQuestion={handleJumpToQuestion}
      />

      {/* Styles for mobile portrait optimization & responsiveness */}
      <style jsx>{`
        .practice-page-wrapper {
          min-height: 100dvh;
          position: relative;
        }

        .mobile-exam-top-bar {
          display: none;
        }

        .mobile-bottom-bar {
          display: none;
        }

        .desktop-session-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .practice-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 2rem;
          align-items: start;
        }

        /* Responsive layout for <= 768px (Mobile Portrait) */
        @media (max-width: 768px) {
          .desktop-session-header {
            display: none !important;
          }

          .desktop-navigation-sidebar {
            display: none !important;
          }

          .practice-layout {
            display: block !important;
          }

          :global(.practice-main-container) {
            padding: 0.5rem 0.5rem 5.5rem !important;
            max-width: 100% !important;
          }

          /* Sticky Sleek Mobile Top Bar */
          .mobile-exam-top-bar {
            display: block;
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            z-index: 45;
            background: var(--bg-glass);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border-subtle);
            padding: 0.5rem 0.75rem 0.4rem;
            margin-bottom: 0.5rem;
          }

          .mobile-bar-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
          }

          .mobile-header-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: var(--radius-sm);
            background: var(--bg-surface-elevated);
            color: var(--text-muted);
            border: 1px solid var(--border-subtle);
          }

          .mobile-header-center {
            display: flex;
            align-items: center;
            gap: 0.45rem;
            flex-wrap: wrap;
            justify-content: center;
          }

          .mobile-q-badge {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--cyan);
            background: rgba(6, 182, 212, 0.12);
            padding: 2px 8px;
            border-radius: 9999px;
            border: 1px solid rgba(6, 182, 212, 0.25);
          }

          .mobile-timer-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--text-main);
            background: var(--bg-surface-elevated);
            padding: 2px 7px;
            border-radius: 9999px;
            border: 1px solid var(--border-subtle);
          }

          .mobile-timer-pill.urgent {
            color: #f87171;
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.4);
            animation: pulse 1s infinite;
          }

          .mobile-mode-pill {
            font-size: 0.75rem;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 9999px;
            background: var(--bg-surface-elevated);
            border: 1px solid var(--border-subtle);
            color: var(--text-dim);
            cursor: pointer;
          }

          .mobile-flag-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: var(--radius-sm);
            background: var(--bg-surface-elevated);
            border: 1px solid var(--border-subtle);
            color: var(--text-muted);
          }

          .mobile-flag-btn.is-flagged {
            color: #f59e0b;
            background: rgba(245, 158, 11, 0.18);
            border-color: rgba(245, 158, 11, 0.35);
          }

          .mobile-progress-track {
            height: 3px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 9999px;
            margin-top: 0.4rem;
            overflow: hidden;
          }

          .mobile-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #0d9488, #06b6d4);
            transition: width 0.3s ease;
          }

          /* Sticky Mobile Bottom Navigation Bar */
          .mobile-bottom-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 45;
            background: var(--bg-glass);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border-top: 1px solid var(--border-subtle);
            padding: 0.65rem 0.85rem;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.35);
          }

          .mobile-bottom-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.35rem;
            padding: 0.65rem 0.95rem;
            border-radius: var(--radius-md);
            font-size: 0.88rem;
            font-weight: 700;
            background: var(--bg-surface-elevated);
            color: var(--text-main);
            border: 1px solid var(--border-subtle);
            transition: all 0.15s ease;
          }

          .mobile-bottom-palette-btn {
            flex: 1;
            background: rgba(6, 182, 212, 0.1);
            border-color: rgba(6, 182, 212, 0.3);
            color: var(--cyan);
            font-size: 0.82rem;
          }

          .mobile-bottom-next-btn {
            background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%);
            color: #ffffff;
            border: none;
          }

          .mobile-bottom-submit-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #ffffff;
            border: none;
          }

          /* Bottom Sheet Palette Drawer */
          .mobile-drawer-backdrop {
            position: fixed;
            inset: 0;
            z-index: 60;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            display: flex;
            align-items: flex-end;
            animation: fadeIn 0.2s ease-out;
          }

          .mobile-drawer-sheet {
            width: 100%;
            max-height: 85dvh;
            background: var(--bg-surface);
            border-top: 1px solid var(--border-highlight);
            border-radius: var(--radius-xl) var(--radius-xl) 0 0;
            padding: 1rem 1.25rem 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 0.85rem;
            animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            overflow-y: auto;
          }

          .mobile-drawer-handle {
            width: 40px;
            height: 4px;
            border-radius: 9999px;
            background: var(--text-dim);
            opacity: 0.5;
            margin: 0 auto;
          }

          .mobile-drawer-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--border-subtle);
          }

          .mobile-drawer-close {
            color: var(--text-dim);
            padding: 4px;
            cursor: pointer;
          }

          .mobile-drawer-stats {
            display: flex;
            justify-content: space-between;
            font-size: 0.82rem;
            color: var(--text-muted);
            background: var(--bg-surface-elevated);
            padding: 0.5rem 0.85rem;
            border-radius: var(--radius-md);
            border: 1px solid var(--border-subtle);
          }

          .mobile-drawer-legend {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.72rem;
            color: var(--text-dim);
            padding: 0 0.25rem;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 0.3rem;
          }

          .legend-dot {
            width: 10px;
            height: 10px;
            border-radius: 3px;
          }

          .dot-answered { background: #10b981; }
          .dot-current { background: #06b6d4; }
          .dot-flagged { background: #f59e0b; }
          .dot-unanswered { background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); }

          .mobile-drawer-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
            gap: 0.45rem;
            max-height: 240px;
            overflow-y: auto;
            padding: 0.25rem 0;
          }

          .drawer-grid-btn {
            height: 42px;
            border-radius: 8px;
            background: var(--bg-surface-elevated);
            border: 1.5px solid var(--border-subtle);
            color: var(--text-muted);
            font-size: 0.88rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .drawer-grid-btn.answered {
            background: rgba(16, 185, 129, 0.18);
            border-color: rgba(16, 185, 129, 0.45);
            color: #34d399;
          }

          .drawer-grid-btn.flagged {
            border-color: #f59e0b;
          }

          .drawer-grid-btn.current {
            background: #06b6d4;
            border-color: #06b6d4;
            color: #ffffff;
            box-shadow: 0 2px 10px rgba(6, 182, 212, 0.45);
          }

          .mobile-drawer-footer {
            padding-top: 0.5rem;
            border-top: 1px solid var(--border-subtle);
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default function PracticePage(props: PracticePageProps) {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: '5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Initializing examination session...
        </div>
      }
    >
      <PracticeInner {...props} />
    </Suspense>
  );
}
