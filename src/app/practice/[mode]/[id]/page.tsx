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
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);

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
      <div className="container" style={{ padding: '3rem 1.5rem 5rem', maxWidth: '780px' }}>
        <div
          className="glass-panel animate-fade-in"
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
      </div>
    );
  }

  const unansweredIndices = questions
    .map((q, idx) => (!answers[q.id] ? idx : -1))
    .filter((idx) => idx !== -1);

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 4rem' }}>
      {/* Session Title & Breadcrumbs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '2rem',
          alignItems: 'start',
        }}
        className="practice-layout"
      >
        {/* Left: Active Question Card */}
        <div>
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

        {/* Right: Question Navigation Matrix & Timer */}
        <div>
          <QuestionNavigation
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            answers={answers}
            flags={flags}
            questionIds={questionIds}
            durationMinutes={durationMinutes}
            isExamMode={mode === 'complete_exam'}
            isSubmitted={false}
            onSelectIndex={(idx) => setCurrentIndex(idx)}
            onPrevious={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
            onNext={() => setCurrentIndex((idx) => Math.min(questions.length - 1, idx + 1))}
            onSubmit={handleInitiateSubmit}
          />
        </div>
      </div>

      {/* Unanswered Questions Warning Modal (Requirement #15) */}
      <UnansweredWarningDialog
        isOpen={warningModalOpen}
        unansweredCount={unansweredIndices.length}
        totalQuestions={questions.length}
        unansweredIndices={unansweredIndices}
        onCancel={() => setWarningModalOpen(false)}
        onConfirmSubmit={handleFinalSubmit}
        onJumpToQuestion={(idx) => setCurrentIndex(idx)}
      />

      <style jsx>{`
        @media (max-width: 960px) {
          :global(.practice-layout) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function UniversalPracticePage(props: PracticePageProps) {
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
