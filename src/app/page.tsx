'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  BookOpen,
  Sparkles,
  Bookmark,
  TrendingDown,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  GraduationCap,
  RotateCcw,
} from 'lucide-react';

interface PlatformStats {
  total_years: number;
  total_modules: number;
  total_subjects: number;
  total_chapters: number;
  total_concepts: number;
  total_exams: number;
  total_questions: number;
  completed_exams: number;
  total_attempts: number;
  questions_answered: number;
  overall_accuracy: number;
  bookmarks_count: number;
  recent_attempts: {
    id: string;
    title: string;
    mode: string;
    score_percentage: number;
    total_questions: number;
    correct_count: number;
    created_at: string;
  }[];
}

interface ExamItem {
  id: string;
  title: string;
  exam_type: string;
  academic_year?: { name: string };
  module?: { name: string };
  question_count?: number;
  previous_score?: number;
}

export default function StudentDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentExams, setRecentExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, examsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/exams'),
      ]);

      const statsData = await statsRes.json();
      const examsData = await examsRes.json();

      if (statsData.success) setStats(statsData.data);
      if (examsData.success) setRecentExams(examsData.data.slice(0, 3));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleResetProgress = async () => {
    const confirmed = window.confirm(
      'هل أنت متأكد من رغبتك في مسح كافة نتائجك وحلولك السابقة؟\nسيتم تصفير جميع محاولاتك وإحصائياتك لتبدأ من جديد بشكل كامل.'
    );
    if (!confirmed) return;

    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch('/api/attempts?student_id=default_student', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith('omnimed_active_')) {
              localStorage.removeItem(k);
            }
          });
        } catch {}

        setResetMessage({ type: 'success', text: 'تم مسح كافة النتائج والحلول السابقة بنجاح! تم تصفير سجل درجاتك ومحاولاتك.' });
        await fetchDashboardData();
      } else {
        setResetMessage({ type: 'error', text: data.message || 'حدث خطأ أثناء مسح النتائج' });
      }
    } catch (err) {
      setResetMessage({ type: 'error', text: 'تعذر الاتصال بالخادم لمسح النتائج' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Welcome Banner */}
      <div
        className="glass-panel hero-welcome-banner"
        style={{
          padding: '2.5rem',
          borderRadius: 'var(--radius-xl)',
          marginBottom: '2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              background: 'var(--hero-pill-badge-bg)',
              border: '1px solid var(--hero-pill-badge-border)',
              color: 'var(--hero-pill-badge-text)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <GraduationCap size={15} />
            <span>MEDICAL BOARD & CLINICAL CLERKSHIP PLATFORM</span>
          </div>

          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
            Ready to master your medical exams?
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.02rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            Systematic exam preparation organized strictly by Academic Year → Module → Subject → Chapter → Concept.
            Practice complete past papers or drill targeted high-yield concepts with per-choice source citations.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Link href="/exams" className="btn btn-primary btn-lg">
              <span>Start Complete Exam</span>
              <Play size={16} fill="#ffffff" />
            </Link>
            <Link href="/study" className="btn btn-secondary btn-lg">
              <BookOpen size={16} />
              <span>Browse by Subject</span>
            </Link>
          </div>
        </div>

        {/* Quick Curriculum Count Pill */}
        <div
          className="hero-curriculum-card"
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            minWidth: '240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Curriculum Hierarchy
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Academic Years:</span>
            <strong style={{ color: 'var(--blue)' }}>{stats?.total_years ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>System Modules:</span>
            <strong style={{ color: 'var(--primary)' }}>{stats?.total_modules ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Core Subjects:</span>
            <strong style={{ color: 'var(--indigo)' }}>{stats?.total_subjects ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Medical Concepts:</span>
            <strong style={{ color: 'var(--warning)' }}>{stats?.total_concepts ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Student Progress Header & Reset Button Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} color="#06b6d4" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            سجل تقدم ونتائج الطالب (Student Performance)
          </h2>
        </div>

        <button
          type="button"
          onClick={handleResetProgress}
          disabled={resetting}
          className="btn btn-sm"
          style={{
            gap: '0.45rem',
            color: '#fb7185',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            background: 'rgba(244, 63, 94, 0.08)',
            cursor: resetting ? 'not-allowed' : 'pointer',
            padding: '0.5rem 0.9rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.85rem',
            transition: 'all 0.2s ease',
          }}
          title="مسح كافة النتائج والحلول السابقة وتصفير سجل الطالب"
        >
          <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
          <span>{resetting ? 'جاري المسح...' : 'مسح النتائج والحلول السابقة (Reset)'}</span>
        </button>
      </div>

      {/* Reset Confirmation Banner */}
      {resetMessage && (
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            background: resetMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${resetMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
            color: resetMessage.type === 'success' ? '#34d399' : '#fb7185',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.92rem',
            fontWeight: 600,
          }}
        >
          <span>{resetMessage.text}</span>
          <button
            onClick={() => setResetMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Primary Performance Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        {/* Exams Completed */}
        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600 }}>Exams Completed</span>
            <div style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
              <FileCheck2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8' }}>
            {stats?.completed_exams ?? 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Of {stats?.total_exams ?? 0} available complete exams
          </div>
        </div>

        {/* Questions Solved */}
        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600 }}>Questions Answered</span>
            <div style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
            {stats?.questions_answered ?? 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Across all practice sessions & exams
          </div>
        </div>

        {/* Overall Accuracy */}
        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600 }}>Overall Accuracy</span>
            <div style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fbbf24' }}>
            {stats?.overall_accuracy ?? 0}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Passing threshold: 70%
          </div>
        </div>

        {/* Question Bank Bookmarks */}
        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 600 }}>Question Bank</span>
            <div style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>
              <Bookmark size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#c084fc' }}>
            {stats?.bookmarks_count ?? 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Flagged & categorized questions
          </div>
        </div>
      </div>

      {/* Main Grid: Fast Entry Points & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Quick Entry Portals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={20} color="#06b6d4" />
            <span>Study Modes & Exploration</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Complete Exams Portal */}
            <Link
              href="/exams"
              className="card-3d"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                  }}
                >
                  <FileCheck2 size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Complete Previous-Year Exams
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Solve original examinations under timed conditions
                  </div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-dim)" />
            </Link>

            {/* Subject Hierarchy Practice */}
            <Link
              href="/study"
              className="card-3d"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(13, 148, 136, 0.15)',
                    border: '1px solid rgba(13, 148, 136, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2dd4bf',
                  }}
                >
                  <BookOpen size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Subject, Chapter & Concept Practice
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Drill questions by topic independent of exams
                  </div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-dim)" />
            </Link>

            {/* Repeated Concepts Section */}
            <Link
              href="/repeated-concepts"
              className="card-3d"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(147, 51, 234, 0.15)',
                    border: '1px solid rgba(147, 51, 234, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c084fc',
                  }}
                >
                  <Sparkles size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    High-Frequency Repeated Concepts
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Identified by underlying mechanisms across multiple papers
                  </div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-dim)" />
            </Link>

            {/* Weakness Analysis Portal */}
            <Link
              href="/weakness-analysis"
              className="card-3d"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fb7185',
                  }}
                >
                  <TrendingDown size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Weakness Analysis Engine
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Detect concepts with &lt;70% accuracy and launch targeted drills
                  </div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-dim)" />
            </Link>
          </div>
        </div>

        {/* Right Column: Continue Studying & Recent Completed Exams */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              Available Exams
            </h2>
            <Link href="/exams" style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
              View all ({stats?.total_exams ?? 0})
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentExams.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border-subtle)',
                }}
              >
                <FileCheck2 size={40} color="var(--text-dim)" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.35rem' }}>
                  لا توجد امتحانات مضافة حالياً
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                  الموقع خالي وجاهز تماماً. أول امتحان ستضيفه من لوحة الإدارة سيظهر هنا للطلاب فوراً.
                </div>
                <Link href="/admin" className="btn btn-primary btn-sm">
                  الانتقال للوحة الإدارة لإضافة امتحان
                </Link>
              </div>
            ) : (
              recentExams.map((exam) => (
                <div
                  key={exam.id}
                  className="card-3d"
                  style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-teal">{exam.academic_year?.name || 'Academic Year'}</span>
                      <span className="badge badge-blue">{exam.module?.name || 'Module'}</span>
                    </div>
                    <span className="badge badge-purple">
                      {exam.exam_type === 'end_module' ? 'END MODULE' : 'FINAL'}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.4 }}>
                    {exam.title}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {exam.question_count ?? 0} Questions • 60 Mins
                    </span>

                    <Link
                      href={`/practice/complete_exam/${exam.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ gap: '0.35rem' }}
                    >
                      <span>Solve Exam</span>
                      <Play size={13} fill="#ffffff" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Attempt History */}
          {stats?.recent_attempts && stats.recent_attempts.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Recent Exam Attempts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stats.recent_attempts.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{att.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {new Date(att.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`badge ${att.score_percentage >= 70 ? 'badge-success' : 'badge-error'}`}>
                      {att.score_percentage}% ({att.correct_count}/{att.total_questions})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
