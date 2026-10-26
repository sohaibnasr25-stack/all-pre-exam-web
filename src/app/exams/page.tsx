'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  Calendar,
  Layers,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { Exam, AcademicYear, Module } from '@/lib/types';

export default function CompleteExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const loadData = async () => {
    try {
      const [examsRes, yearsRes, modulesRes] = await Promise.all([
        fetch('/api/exams'),
        fetch('/api/academic-years'),
        fetch('/api/modules'),
      ]);

      const examsData = await examsRes.json();
      const yearsData = await yearsRes.json();
      const modulesData = await modulesRes.json();

      if (examsData.success) setExams(examsData.data);
      if (yearsData.success) setAcademicYears(yearsData.data);
      if (modulesData.success) setModules(modulesData.data);
    } catch (err) {
      console.error('Error loading complete exams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetProgress = async () => {
    const confirmed = window.confirm(
      'هل أنت متأكد من مسح كافة نتائجك ومحاولاتك السابقة في الامتحانات؟\nسيتم تصفير جميع درجاتك السابقة لتبدأ من جديد.'
    );
    if (!confirmed) return;

    setResetting(true);
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
        alert('تم مسح كافة النتائج والحلول السابقة بنجاح.');
        await loadData();
      } else {
        alert(data.message || 'حدث خطأ أثناء مسح النتائج');
      }
    } catch {
      alert('تعذر الاتصال بالخادم لمسح النتائج');
    } finally {
      setResetting(false);
    }
  };

  // Filter modules based on selected Academic Year
  const visibleModules = selectedYearId === 'all'
    ? modules
    : modules.filter((m) => m.academic_year_id === selectedYearId);

  // Filter exams based on year, module, and exam type
  const filteredExams = exams.filter((e) => {
    if (selectedYearId !== 'all' && e.academic_year_id !== selectedYearId) return false;
    if (selectedModuleId !== 'all' && e.module_id !== selectedModuleId) return false;
    if (selectedType !== 'all') {
      const normalized = e.exam_type === 'end_module' ? 'end_module' : 'final';
      if (normalized !== selectedType) return false;
    }
    return true;
  });

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            <FileCheck2 size={16} />
            <span>Previous-Year Board Examinations</span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Complete Exams Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '750px', lineHeight: 1.6 }}>
            Solve complete authentic exams structured strictly by <strong>Academic Year → Module → Exam</strong>.
            Every exam runs in simulated testing conditions with full performance analytics upon submission.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetProgress}
          disabled={resetting}
          className="btn btn-outline btn-sm"
          style={{
            color: '#fb7185',
            borderColor: 'rgba(244, 63, 94, 0.4)',
            background: 'rgba(244, 63, 94, 0.08)',
            gap: '0.45rem',
            padding: '0.55rem 0.95rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
          }}
          title="مسح وتصفير كافة نتائج وحلول الطالب السابقة للامتحانات"
        >
          <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
          <span>{resetting ? 'جاري المسح...' : 'مسح كافة النتائج والحلول (Reset)'}</span>
        </button>
      </div>

      {/* Hierarchy Filter Bar with 3D Floating Effect */}
      <div
        className="card-3d"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
          <Filter size={16} color="#06b6d4" />
          <span>Hierarchy Filters:</span>
        </div>

        {/* Academic Year Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Academic Year:</span>
          <select
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              setSelectedModuleId('all'); // Reset module on year change
            }}
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.88rem' }}
          >
            <option value="all">All Academic Years</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name} ({year.code})
              </option>
            ))}
          </select>
        </div>

        {/* Module Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Module:</span>
          <select
            value={selectedModuleId}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.88rem' }}
          >
            <option value="all">All Modules</option>
            {visibleModules.map((mod) => (
              <option key={mod.id} value={mod.id}>
                {mod.name} ({mod.code})
              </option>
            ))}
          </select>
        </div>

        {/* Exam Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.88rem' }}
          >
            <option value="all">All Types</option>
            <option value="end_module">END MODULE</option>
            <option value="final">FINAL</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredExams.length}</strong> exam{filteredExams.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Loading examination catalog...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredExams.length === 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <AlertCircle size={40} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            No exams match the selected filters
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Try resetting your filters or create a new examination in the Admin Dashboard.
          </p>
          <button
            onClick={() => {
              setSelectedYearId('all');
              setSelectedModuleId('all');
            }}
            className="btn btn-secondary"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Exam Grid */}
      <div className="grid-cols-auto">
        {filteredExams.map((exam) => {
          const isCompleted = exam.completion_status === 'completed';
          return (
            <div
              key={exam.id}
              className="card-3d"
              style={{
                padding: '1.75rem',
                borderRadius: 'var(--radius-xl)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                position: 'relative',
              }}
            >
              <div>
                {/* Academic Year & Module Badges */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <span className="badge badge-teal">
                    {exam.academic_year?.code || 'Y1'}
                  </span>
                  <span className="badge badge-blue">
                    {exam.module?.name || 'Integrated'}
                  </span>
                  <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>
                    {exam.exam_type === 'end_module' ? 'END MODULE' : 'FINAL'}
                  </span>
                </div>

                {/* Exam Title */}
                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    lineHeight: 1.4,
                    color: 'var(--text-main)',
                    marginBottom: '0.75rem',
                  }}
                >
                  {exam.title}
                </h3>

                {/* Instructions / Description snippet */}
                {exam.instructions && (
                  <p
                    style={{
                      fontSize: '0.88rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                      marginBottom: '1rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {exam.instructions}
                  </p>
                )}

                {/* Exam Details Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-dim)',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileCheck2 size={15} color="#06b6d4" />
                    <span>{exam.question_count ?? 0} Questions</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={15} color="#f59e0b" />
                    <span>{exam.duration_minutes} Mins</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Status & Start Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                {/* Completion Status */}
                {isCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
                      Score: {exam.previous_score ?? 0}%
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Not Yet Attempted
                  </span>
                )}

                {/* Start Exam CTA */}
                <Link
                  href={`/practice/complete_exam/${exam.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '0.4rem' }}
                >
                  <span>{isCompleted ? 'Retake Exam' : 'Start Exam'}</span>
                  <Play size={14} fill="#ffffff" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State when no exams exist */}
      {!loading && filteredExams.length === 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <FileCheck2 size={46} color="var(--text-dim)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            لا توجد امتحانات مضافة حالياً
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
            الموقع خالي وجاهز بالكامل. يمكنك رفع أول امتحان عبر لوحة الإدارة من خلال استيراد ملف نصي أو إضافته يدوياً.
          </p>
          <Link href="/admin" className="btn btn-primary">
            الانتقال للوحة الإدارة لإضافة امتحانات
          </Link>
        </div>
      )}
    </div>
  );
}
