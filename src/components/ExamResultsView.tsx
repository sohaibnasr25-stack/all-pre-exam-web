'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Clock,
  Flame,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Question, StudentAttempt } from '@/lib/types';
import QuestionCard from './QuestionCard';
import RetrySession from './RetrySession';

interface ExamResultsViewProps {
  title: string;
  questions: Question[];
  userAnswers: Record<string, string | null>;
  timeSpentSeconds: number;
  examId?: string;
  mode?: string;
  pastAttempts?: StudentAttempt[];
  onRetryIncorrect?: () => void;
  onRetakeExam?: () => void;
  onBackToDashboard: () => void;
}

export default function ExamResultsView({
  title,
  questions,
  userAnswers,
  timeSpentSeconds,
  examId,
  mode,
  pastAttempts = [],
  onRetryIncorrect,
  onRetakeExam,
  onBackToDashboard,
}: ExamResultsViewProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'review' | 'retry' | 'progress'>('summary');
  const [selectedReviewFilter, setSelectedReviewFilter] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [historyAttempts, setHistoryAttempts] = useState<StudentAttempt[]>(pastAttempts);

  // Compute stats for the current attempt
  const total = questions.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const incorrectQuestions: Question[] = [];

  questions.forEach((q) => {
    const selectedChoiceId = userAnswers[q.id];
    if (!selectedChoiceId) {
      unansweredCount += 1;
      incorrectQuestions.push(q);
    } else {
      const choice = q.answer_choices.find((c) => c.id === selectedChoiceId);
      if (choice?.is_correct) {
        correctCount += 1;
      } else {
        incorrectCount += 1;
        incorrectQuestions.push(q);
      }
    }
  });

  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const isPassed = percentage >= 70;

  // Fetch updated attempts if examId is provided
  useEffect(() => {
    if (examId) {
      fetch(`/api/attempts?entity_id=${examId}&include_answers=true`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setHistoryAttempts(data.data);
          }
        })
        .catch(() => {});
    }
  }, [examId]);

  // Trigger celebration confetti if passed
  useEffect(() => {
    if (isPassed) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Confetti optional
      }
    }
  }, [isPassed]);

  // Attempt comparisons & improvement calculations
  const isLatestAttemptCurrent =
    historyAttempts.length > 0 &&
    historyAttempts[0].score_percentage === percentage &&
    Math.abs(historyAttempts[0].time_spent_seconds - timeSpentSeconds) <= 10;

  const previousAttempt = isLatestAttemptCurrent
    ? historyAttempts[1] || null
    : historyAttempts[0] || null;

  const totalAttemptsCount = isLatestAttemptCurrent
    ? historyAttempts.length
    : historyAttempts.length > 0
    ? historyAttempts.length + 1
    : 1;

  const scoreDiff = previousAttempt ? percentage - previousAttempt.score_percentage : 0;
  const timeDiffSecs = previousAttempt ? previousAttempt.time_spent_seconds - timeSpentSeconds : 0;

  // 1. Remedied Weaknesses: questions incorrect in previous attempt, but now correct in current attempt
  const remediedQuestions = questions.filter((q) => {
    if (!previousAttempt || !previousAttempt.answers) return false;
    const prevAns = previousAttempt.answers.find((a) => a.question_id === q.id);
    const currChoiceId = userAnswers[q.id];
    const isCurrCorrect = q.answer_choices.find((c) => c.id === currChoiceId)?.is_correct ?? false;
    return prevAns && !prevAns.is_correct && isCurrCorrect;
  });

  // 2. Persistent Weaknesses: questions incorrect in previous attempt and still incorrect in current attempt
  const persistentWeakQuestions = questions.filter((q) => {
    if (!previousAttempt || !previousAttempt.answers) return false;
    const prevAns = previousAttempt.answers.find((a) => a.question_id === q.id);
    const currChoiceId = userAnswers[q.id];
    const isCurrCorrect = q.answer_choices.find((c) => c.id === currChoiceId)?.is_correct ?? false;
    return prevAns && !prevAns.is_correct && !isCurrCorrect;
  });

  // Breakdown by subject
  const subjectBreakdown = new Map<string, { total: number; correct: number }>();
  // Breakdown by chapter
  const chapterBreakdown = new Map<string, { total: number; correct: number }>();
  // Breakdown by concept
  const conceptBreakdown = new Map<string, { total: number; correct: number }>();

  questions.forEach((q) => {
    const isCorrect = userAnswers[q.id] && q.answer_choices.find((c) => c.id === userAnswers[q.id])?.is_correct;

    if (q.subject?.name) {
      const curr = subjectBreakdown.get(q.subject.name) || { total: 0, correct: 0 };
      curr.total += 1;
      if (isCorrect) curr.correct += 1;
      subjectBreakdown.set(q.subject.name, curr);
    }

    if (q.chapter?.name) {
      const curr = chapterBreakdown.get(q.chapter.name) || { total: 0, correct: 0 };
      curr.total += 1;
      if (isCorrect) curr.correct += 1;
      chapterBreakdown.set(q.chapter.name, curr);
    }

    if (q.concept?.name) {
      const curr = conceptBreakdown.get(q.concept.name) || { total: 0, correct: 0 };
      curr.total += 1;
      if (isCorrect) curr.correct += 1;
      conceptBreakdown.set(q.concept.name, curr);
    }
  });

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const filteredQuestions = questions.filter((q) => {
    const selectedChoiceId = userAnswers[q.id];
    const isCorrect = selectedChoiceId && q.answer_choices.find((c) => c.id === selectedChoiceId)?.is_correct;

    if (selectedReviewFilter === 'incorrect') return !isCorrect;
    if (selectedReviewFilter === 'correct') return isCorrect;
    return true;
  });

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem', maxWidth: '1050px' }}>
      {/* Top Results Card */}
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '2.5rem 2rem',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
          marginBottom: '2rem',
          background: isPassed
            ? 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, var(--bg-surface) 75%)'
            : 'radial-gradient(circle at 50% 0%, rgba(244, 63, 94, 0.15) 0%, var(--bg-surface) 75%)',
          border: isPassed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)',
        }}
      >
        {/* Trophy / Status Icon */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            border: `2px solid ${isPassed ? '#10b981' : '#f43f5e'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}
        >
          {isPassed ? <Trophy size={34} color="#34d399" /> : <AlertCircle size={34} color="#fb7185" />}
        </div>

        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
          {isPassed ? 'Examination Completed!' : 'Attempt Completed — Needs Review'}
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem' }}>
          {title}
        </div>

        {/* Score & Key Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
            maxWidth: '650px',
            margin: '0 auto 1.5rem',
          }}
        >
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: isPassed ? '#34d399' : '#fb7185' }}>
              {percentage}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Final Score
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#34d399' }}>
              {correctCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Correct
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fb7185' }}>
              {incorrectCount + unansweredCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Incorrect
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8' }}>
              {formatTime(timeSpentSeconds)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Time Spent
            </div>
          </div>
        </div>

        {/* Progress Comparison Alert Banner (when student has prior attempts) */}
        {previousAttempt && (
          <div
            style={{
              maxWidth: '650px',
              margin: '0 auto 1.5rem',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              background: scoreDiff >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${scoreDiff >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: scoreDiff >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: scoreDiff >= 0 ? '#34d399' : '#f59e0b',
                  flexShrink: 0,
                }}
              >
                <TrendingUp size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                  {scoreDiff >= 0
                    ? `تطور ملحوظ! تحسنت درجاتك بنسبة +${scoreDiff}% مقارنة بالمحاولة السابقة`
                    : `محاولة جيدة! فارق النتيجة (${scoreDiff}%) مقارنة بالمحاولة السابقة`}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  النتيجة السابقة: {previousAttempt.score_percentage}% ➔ الحالية: {percentage}%
                  {remediedQuestions.length > 0 && ` | تم علاج ${remediedQuestions.length} مواضع ضعف بنجاح 🎉`}
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('progress')}
              className="btn btn-sm btn-outline"
              style={{
                gap: '0.4rem',
                borderColor: scoreDiff >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)',
                color: scoreDiff >= 0 ? '#34d399' : '#f59e0b',
                fontSize: '0.82rem',
              }}
            >
              <span>تفاصيل التطور وعلاج الضعف</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {onRetakeExam && (
            <button
              onClick={onRetakeExam}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                boxShadow: '0 4px 16px rgba(14, 165, 233, 0.35)',
                gap: '0.5rem',
              }}
            >
              <RotateCcw size={16} />
              <span>إعادة حل الامتحان كاملاً (محاولة جديدة)</span>
            </button>
          )}

          {incorrectQuestions.length > 0 && (
            <button
              onClick={() => setActiveTab('retry')}
              className="btn btn-secondary"
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
                color: '#fbbf24',
                gap: '0.5rem',
              }}
            >
              <RotateCcw size={16} />
              <span>تدريب سريع على الأسئلة الخاطئة ({incorrectQuestions.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('review')}
            className="btn btn-secondary"
            style={{ gap: '0.5rem' }}
          >
            <BookOpen size={16} />
            <span>مراجعة كافة التفسيرات</span>
          </button>

          <button
            onClick={onBackToDashboard}
            className="btn btn-outline"
          >
            الرئيسية
          </button>
        </div>
      </div>

      {/* Mode Tabs: Summary Breakdown vs Question Review vs Retry vs Progress */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          paddingBottom: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveTab('summary')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.92rem',
            color: activeTab === 'summary' ? '#38bdf8' : 'var(--text-muted)',
            background: activeTab === 'summary' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
            border: activeTab === 'summary' ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid transparent',
          }}
        >
          Performance Breakdown
        </button>

        <button
          onClick={() => setActiveTab('review')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.92rem',
            color: activeTab === 'review' ? '#38bdf8' : 'var(--text-muted)',
            background: activeTab === 'review' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
            border: activeTab === 'review' ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid transparent',
          }}
        >
          Detailed Question Review ({questions.length})
        </button>

        {incorrectQuestions.length > 0 && (
          <button
            onClick={() => setActiveTab('retry')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.92rem',
              color: activeTab === 'retry' ? '#fbbf24' : 'var(--text-muted)',
              background: activeTab === 'retry' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
              border: activeTab === 'retry' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
            }}
          >
            Retry Mode ({incorrectQuestions.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('progress')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.92rem',
            color: activeTab === 'progress' ? '#38bdf8' : 'var(--text-muted)',
            background: activeTab === 'progress' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
            border: activeTab === 'progress' ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <TrendingUp size={15} color="#06b6d4" />
          <span>تتبع التطور وعلاج الضعف ({totalAttemptsCount} محاولات)</span>
          {remediedQuestions.length > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '9999px',
                background: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              +{remediedQuestions.length} معالج
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SUMMARY BREAKDOWN BY SUBJECT, CHAPTER, CONCEPT */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Performance by Subject */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="#06b6d4" />
              <span>Performance by Subject</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Array.from(subjectBreakdown.entries()).map(([subName, stat]) => {
                const acc = Math.round((stat.correct / stat.total) * 100);
                return (
                  <div key={subName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600 }}>{subName}</span>
                      <span style={{ color: acc >= 70 ? '#34d399' : '#fb7185', fontWeight: 700 }}>
                        {stat.correct}/{stat.total} ({acc}%)
                      </span>
                    </div>
                    <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${acc}%`,
                          background: acc >= 70 ? '#10b981' : '#f43f5e',
                          borderRadius: '9999px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance by Chapter */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={18} color="#10b981" />
              <span>Performance by Chapter</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Array.from(chapterBreakdown.entries()).map(([chapName, stat]) => {
                const acc = Math.round((stat.correct / stat.total) * 100);
                return (
                  <div key={chapName}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600 }}>{chapName}</span>
                      <span style={{ color: acc >= 70 ? '#34d399' : '#fb7185', fontWeight: 700 }}>
                        {stat.correct}/{stat.total} ({acc}%)
                      </span>
                    </div>
                    <div style={{ height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${acc}%`,
                          background: acc >= 70 ? '#10b981' : '#f43f5e',
                          borderRadius: '9999px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance by Concept */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} color="#a855f7" />
              <span>Performance by Concept</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Array.from(conceptBreakdown.entries()).map(([conName, stat]) => {
                const acc = Math.round((stat.correct / stat.total) * 100);
                return (
                  <div
                    key={conName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{conName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        Tested in this exam
                      </div>
                    </div>
                    <span className={`badge ${acc >= 70 ? 'badge-success' : 'badge-error'}`}>
                      {stat.correct}/{stat.total} ({acc}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED QUESTION REVIEW */}
      {activeTab === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              onClick={() => setSelectedReviewFilter('all')}
              className={`btn btn-sm ${selectedReviewFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              All Questions ({questions.length})
            </button>
            <button
              onClick={() => setSelectedReviewFilter('incorrect')}
              className={`btn btn-sm ${selectedReviewFilter === 'incorrect' ? 'btn-danger' : 'btn-secondary'}`}
            >
              Incorrect Only ({incorrectQuestions.length})
            </button>
            <button
              onClick={() => setSelectedReviewFilter('correct')}
              className={`btn btn-sm ${selectedReviewFilter === 'correct' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ background: selectedReviewFilter === 'correct' ? '#10b981' : undefined }}
            >
              Correct Only ({correctCount})
            </button>
          </div>

          {filteredQuestions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              questionIndex={idx}
              totalQuestions={filteredQuestions.length}
              selectedChoiceId={userAnswers[q.id] || null}
              isFlagged={false}
              mode="complete_exam"
              isSubmitted={true}
              onSelectChoice={() => { }}
              onClearChoice={() => { }}
              onToggleFlag={() => { }}
              onBookmark={() => { }}
            />
          ))}
        </div>
      )}

      {/* TAB 3: RETRY MODE */}
      {activeTab === 'retry' && incorrectQuestions.length > 0 && (
        <RetrySession
          incorrectQuestions={incorrectQuestions}
          onFinishedAllRetries={() => {
            setActiveTab('summary');
          }}
        />
      )}

      {/* TAB 4: ATTEMPT PROGRESS & REMEDIED WEAKNESSES */}
      {activeTab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header comparison overview */}
          <div
            className="glass-panel"
            style={{
              padding: '1.75rem',
              borderRadius: 'var(--radius-xl)',
              background: 'radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15) 0%, var(--bg-surface) 80%)',
              border: '1px solid var(--border-highlight)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              <TrendingUp size={16} />
              <span>مقارنة المحاولات وقياس التطور السريري</span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              {previousAttempt
                ? scoreDiff >= 0
                  ? `أحسنت! حققت قفزة نوعية بزيادة +${scoreDiff}% عن محاولتك السابقة`
                  : `محاولة جيدة! فارق الأداء (${scoreDiff}%) مقارنة بمحاولتك السابقة`
                : 'محاولتك الأولى لهذا الامتحان'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '650px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {previousAttempt
                ? `توضح هذه اللوحة التحسن الحقيقي في درجاتك، ومواضع الضعف والمفاهيم السريرية التي نجحت في تداركها وإتقانها بين المحاولات.`
                : 'تم تسجيل هذه المحاولة كأول نقطة انطلاق لك. عند إعادة حل هذا الامتحان مرة أخرى ستظهر لك مقارنة تفصيلية تكشف نقاط الضعف التي تم علاجها بدقة.'}
            </p>

            {/* Quick Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
              }}
            >
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                  تطور النتيجة
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: scoreDiff >= 0 ? '#34d399' : '#fb7185' }}>
                  {previousAttempt ? `${previousAttempt.score_percentage}% ➔ ${percentage}%` : `${percentage}%`}
                </div>
                {previousAttempt && (
                  <div style={{ fontSize: '0.75rem', color: scoreDiff >= 0 ? '#34d399' : '#fb7185', fontWeight: 700, marginTop: '0.2rem' }}>
                    {scoreDiff >= 0 ? `+${scoreDiff}% تحسن` : `${scoreDiff}%`}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                  مواضع ضعف تم علاجها
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>
                  {remediedQuestions.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  مفاهيم تم تصحيحها
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                  نقاط تحتاج لمراجعة
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: persistentWeakQuestions.length > 0 ? '#fb7185' : '#34d399' }}>
                  {persistentWeakQuestions.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  {persistentWeakQuestions.length === 0 ? 'لا توجد أخطاء متكررة' : 'بحاجة لمزيد من التركيز'}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.35rem' }}>
                  الوقت وسرعة الحل
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
                  {previousAttempt ? `${formatTime(previousAttempt.time_spent_seconds)} ➔ ${formatTime(timeSpentSeconds)}` : formatTime(timeSpentSeconds)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  {timeDiffSecs > 0 ? `أسرع بـ ${formatTime(timeDiffSecs)}` : 'وقت الاستجابة'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Remedied Weaknesses */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckCircle2 size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  مواضع الضعف التي تم علاجها وتصحيحها بنجاح ({remediedQuestions.length})
                </h3>
              </div>
              <span className="badge badge-teal">تدارك ممتاز للمفاهيم</span>
            </div>

            {remediedQuestions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {remediedQuestions.map((q) => {
                  const correctChoice = q.answer_choices.find((c) => c.is_correct);
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderLeft: '4px solid #10b981',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {q.subject && <span className="badge badge-teal">{q.subject.name}</span>}
                        {q.concept && <span className="badge badge-blue">{q.concept.name}</span>}
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          المحاولة السابقة: ❌ خاطئة ➔ المحاولة الحالية: ✅ صحيحة
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.94rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                        {q.question_text}
                      </div>

                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        <strong style={{ color: '#34d399' }}>الإجابة الصحيحة المتقنة: </strong>
                        ({correctChoice?.choice_letter}) {correctChoice?.choice_text}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                {previousAttempt
                  ? 'لم تكن هناك إجابات خاطئة في المحاولة السابقة تم تصحيحها في هذه المحاولة (إما حافظت على نفس الإجابات أو لا توجد أخطاء سابقة).'
                  : 'ستظهر هنا جميع المفاهيم والأسئلة التي كانت خاطئة في محاولتك السابقة ونجحت في إتقانها وتصحيحها في المحاولة القادمة.'}
              </div>
            )}
          </div>

          {/* Section 2: Persistent Weaknesses */}
          {persistentWeakQuestions.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <AlertCircle size={20} color="#fb7185" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    مواضع ضعف لا تزال بحاجة لمزيد من المراجعة ({persistentWeakQuestions.length})
                  </h3>
                </div>
                <span className="badge badge-error">نقاط تركيز قادمة</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {persistentWeakQuestions.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(244, 63, 94, 0.04)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderLeft: '4px solid #f43f5e',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {q.subject && <span className="badge badge-teal">{q.subject.name}</span>}
                      {q.concept && <span className="badge badge-blue">{q.concept.name}</span>}
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#fb7185',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                        }}
                      >
                        غير صحيحة في المحاولتين السابقتين
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.94rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                      {q.question_text}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setSelectedReviewFilter('incorrect');
                          setActiveTab('review');
                        }}
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: '0.8rem', gap: '0.35rem' }}
                      >
                        <BookOpen size={13} />
                        <span>مراجعة التفسير والشرح</span>
                      </button>

                      {q.concept_id && (
                        <Link
                          href={`/practice/concept_practice/${q.concept_id}`}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.8rem', gap: '0.35rem' }}
                        >
                          <Flame size={13} color="#f59e0b" />
                          <span>تدريب مكثف على هذا المفهوم</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Attempt Timeline History */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Calendar size={18} color="#06b6d4" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                السجل الزمني لكافة المحاولات لهذا الامتحان
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {historyAttempts.map((att, idx) => {
                const isPassedAtt = att.score_percentage >= 70;
                const attemptNum = historyAttempts.length - idx;
                const isCurrent = idx === 0 && isLatestAttemptCurrent;
                return (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: isCurrent ? 'rgba(6, 182, 212, 0.08)' : 'var(--bg-surface-elevated)',
                      border: isCurrent ? '1.5px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: isPassedAtt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isPassedAtt ? '#34d399' : '#fb7185',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                        }}
                      >
                        #{attemptNum}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>المحاولة رقم {attemptNum}</span>
                          {isCurrent && <span className="badge badge-teal">المحاولة الحالية</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {new Date(att.completed_at || att.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                          {' • '}
                          الوقت: {formatTime(att.time_spent_seconds)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: isPassedAtt ? '#34d399' : '#fb7185' }}>
                          {att.score_percentage}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          {att.correct_count} من {att.total_questions} صحيح
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retake Call to Action Card */}
          {onRetakeExam && (
            <div
              style={{
                padding: '2rem',
                borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(6, 182, 212, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cyan)',
                }}
              >
                <RotateCcw size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                تريد إعادة حل الامتحان مرة أخرى وتأكيد علاج مواضع الضعف؟
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '520px', margin: 0 }}>
                يمكنك إعادة حل الامتحان كاملاً كمحاولة جديدة تماماً، وسيقوم النظام تلقائياً بتحديث سجل تطورك ومقارنة النتائج.
              </p>
              <button
                onClick={onRetakeExam}
                className="btn btn-primary btn-lg"
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  boxShadow: '0 4px 18px rgba(14, 165, 233, 0.4)',
                  gap: '0.5rem',
                  fontSize: '1rem',
                }}
              >
                <RotateCcw size={17} />
                <span>إعادة حل الامتحان كاملاً (بدء المحاولة #{totalAttemptsCount + 1})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
