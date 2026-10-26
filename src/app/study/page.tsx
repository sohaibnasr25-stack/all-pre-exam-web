'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Layers,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Play,
  FileQuestion,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Subject, Chapter, Concept, Question, AcademicYear, Module } from '@/lib/types';

export default function StudyHierarchyPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Filter selections for Year and Module
  const [selectedYearId, setSelectedYearId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');

  // Selected hierarchy node
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedConceptId, setSelectedConceptId] = useState<string>('');

  const [loading, setLoading] = useState(true);

  // Initial load: fetch all academic years, modules, subjects, chapters, concepts, questions
  useEffect(() => {
    async function loadHierarchy() {
      try {
        const [yearsRes, modRes, subRes, chapRes, conRes, qRes] = await Promise.all([
          fetch('/api/academic-years'),
          fetch('/api/modules'),
          fetch('/api/subjects'),
          fetch('/api/chapters'),
          fetch('/api/concepts'),
          fetch('/api/questions'),
        ]);

        const [yearsData, modData, subData, chapData, conData, qData] = await Promise.all([
          yearsRes.json(),
          modRes.json(),
          subRes.json(),
          chapRes.json(),
          conRes.json(),
          qRes.json(),
        ]);

        if (yearsData.success) setAcademicYears(yearsData.data);
        if (modData.success) setModules(modData.data);
        if (subData.success) {
          setSubjects(subData.data);
          if (subData.data.length > 0) {
            setSelectedSubjectId(subData.data[0].id);
          }
        }
        if (chapData.success) setChapters(chapData.data);
        if (conData.success) setConcepts(conData.data);
        if (qData.success) setQuestions(qData.data);
      } catch (err) {
        console.error('Error loading study hierarchy:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHierarchy();
  }, []);

  // Filter modules based on selected Academic Year
  const visibleModules = selectedYearId === 'all'
    ? modules
    : modules.filter((m) => m.academic_year_id === selectedYearId);

  // Filter subjects based on selected Academic Year and Module
  const visibleSubjects = subjects.filter((s) => {
    if (selectedModuleId !== 'all') {
      return s.module_id === selectedModuleId;
    }
    if (selectedYearId !== 'all') {
      const allowedModuleIds = visibleModules.map((m) => m.id);
      return allowedModuleIds.includes(s.module_id);
    }
    return true;
  });

  // Automatically keep selectedSubjectId pointing to an existing visible subject
  useEffect(() => {
    if (visibleSubjects.length > 0) {
      if (!selectedSubjectId || !visibleSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(visibleSubjects[0].id);
        setSelectedChapterId('');
        setSelectedConceptId('');
      }
    } else {
      setSelectedSubjectId('');
      setSelectedChapterId('');
      setSelectedConceptId('');
    }
  }, [visibleSubjects, selectedSubjectId]);

  // Filtered chapters for current subject
  const currentChapters = chapters.filter((c) => c.subject_id === selectedSubjectId);

  // Automatically select first chapter when subject changes if not selected
  useEffect(() => {
    if (currentChapters.length > 0 && (!selectedChapterId || !currentChapters.some((c) => c.id === selectedChapterId))) {
      setSelectedChapterId(currentChapters[0].id);
      setSelectedConceptId('');
    }
  }, [selectedSubjectId, currentChapters, selectedChapterId]);

  // Filtered concepts for current chapter
  const currentConcepts = concepts.filter((c) => c.chapter_id === selectedChapterId);

  // Questions filtered according to selection
  const visibleQuestions = questions.filter((q) => {
    if (selectedConceptId) {
      return q.concept_id === selectedConceptId;
    }
    if (selectedChapterId) {
      return q.chapter_id === selectedChapterId;
    }
    if (selectedSubjectId) {
      return q.subject_id === selectedSubjectId;
    }
    return true;
  });

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);
  const activeChapter = chapters.find((c) => c.id === selectedChapterId);
  const activeConcept = concepts.find((c) => c.id === selectedConceptId);

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          <BookOpen size={16} />
          <span>Curriculum Mastery</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Study by Subject, Chapter & Concept
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '750px', lineHeight: 1.6 }}>
          Explore questions organized strictly by Academic Year → Module → Subject → Chapter → Concept. Drill broad medical disciplines or zoom in to individual pathophysiological mechanisms.
        </p>
      </div>

      {/* Hierarchy Filter Bar: Academic Year & Module */}
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
          <Filter size={16} color="var(--cyan)" />
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

        {(selectedYearId !== 'all' || selectedModuleId !== 'all') && (
          <button
            onClick={() => {
              setSelectedYearId('all');
              setSelectedModuleId('all');
            }}
            className="btn btn-secondary btn-sm"
            style={{ gap: '0.35rem', fontSize: '0.8rem' }}
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{visibleSubjects.length}</strong> subject{visibleSubjects.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Step 1: Horizontal Subject Pills */}
      {visibleSubjects.length > 0 ? (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            overflowX: 'auto',
            paddingBottom: '0.75rem',
            marginBottom: '2rem',
          }}
        >
          {visibleSubjects.map((sub) => {
            const isSelected = sub.id === selectedSubjectId;
            const qCount = questions.filter((q) => q.subject_id === sub.id).length;
            return (
              <button
                key={sub.id}
                onClick={() => {
                  setSelectedSubjectId(sub.id);
                  setSelectedChapterId('');
                  setSelectedConceptId('');
                }}
                className={`pill-3d pill-3d-teal ${isSelected ? 'active' : ''}`}
                style={{
                  gap: '0.65rem',
                  fontSize: '0.95rem',
                }}
              >
                <BookOpen size={16} color={isSelected ? 'var(--cyan)' : 'var(--text-dim)'} />
                <span>{sub.name}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    background: isSelected ? 'var(--cyan)' : 'var(--bg-surface-elevated)',
                    color: isSelected ? '#ffffff' : 'var(--text-dim)',
                    fontWeight: 700,
                  }}
                >
                  {qCount}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
            marginBottom: '2rem',
          }}
        >
          <AlertCircle size={36} color="var(--text-dim)" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            No subjects found for the selected Academic Year and Module
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Try selecting a different module or resetting the filters to view all available medical subjects.
          </p>
          <button
            onClick={() => {
              setSelectedYearId('all');
              setSelectedModuleId('all');
            }}
            className="btn btn-secondary btn-sm"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Step 2: Empty State or Two-Column Hierarchy Layout */}
      {!loading && subjects.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <BookOpen size={46} color="var(--text-dim)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            لا توجد مواد دراسية مضافة حالياً
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
            الموقع خالي وجاهز بالكامل. يمكنك استيراد أو إنشاء المواد والامتحانات مباشرة عبر لوحة الإدارة.
          </p>
          <Link href="/admin" className="btn btn-primary">
            الانتقال للوحة الإدارة
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Left Column: Chapters and Concepts Tree */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Subject Card */}
          {activeSubject && (
            <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="badge badge-teal">{activeSubject.code}</span>
                <Link
                  href={`/practice/subject_practice/${activeSubject.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '0.35rem' }}
                >
                  <Play size={13} fill="#ffffff" />
                  <span>Practice Entire Subject</span>
                </Link>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                {activeSubject.name}
              </h2>
              {activeSubject.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {activeSubject.description}
                </p>
              )}
            </div>
          )}

          {/* Chapters List */}
          <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Chapters in this Subject ({currentChapters.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {currentChapters.map((chap) => {
                const isSelected = chap.id === selectedChapterId;
                const chapQCount = questions.filter((q) => q.chapter_id === chap.id).length;
                return (
                  <div
                    key={chap.id}
                    onClick={() => {
                      setSelectedChapterId(chap.id);
                      setSelectedConceptId('');
                    }}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-surface-elevated)',
                      border: isSelected ? '1px solid #06b6d4' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: isSelected ? '#38bdf8' : 'var(--text-main)' }}>
                        {chap.chapter_number ? `Ch. ${chap.chapter_number}: ` : ''}{chap.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {chapQCount} questions available
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Link
                        href={`/practice/chapter_practice/${chap.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', gap: '0.3rem' }}
                        title="Practice Chapter"
                      >
                        <Play size={10} fill="currentColor" />
                        <span>Practice</span>
                      </Link>
                      <ChevronRight size={16} color={isSelected ? '#06b6d4' : 'var(--text-dim)'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Concepts List for Current Chapter */}
          {selectedChapterId && (
            <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={14} color="#a855f7" />
                <span>Target Concepts ({currentConcepts.length})</span>
              </div>

              {currentConcepts.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
                  No individual concepts cataloged for this chapter yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentConcepts.map((con) => {
                    const isSelected = con.id === selectedConceptId;
                    const conQCount = questions.filter((q) => q.concept_id === con.id).length;
                    return (
                      <div
                        key={con.id}
                        onClick={() => setSelectedConceptId(isSelected ? '' : con.id)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-surface-elevated)',
                          border: isSelected ? '1px solid #a855f7' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: isSelected ? '#c084fc' : 'var(--text-main)' }}>
                            {con.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {conQCount} question{conQCount !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <Link
                          href={`/practice/concept_practice/${con.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', gap: '0.3rem' }}
                        >
                          <Play size={10} fill="currentColor" />
                          <span>Practice</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Questions Feed & Practice Launch Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Hierarchy Breadcrumbs & Practice Mode Button */}
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>
                Active Selection
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {activeSubject?.name || 'Subject'}
                {activeChapter ? ` → ${activeChapter.name}` : ''}
                {activeConcept ? ` → ${activeConcept.name}` : ''}
              </div>
            </div>

            {/* Launch Practice for current view */}
            {visibleQuestions.length > 0 && (
              <Link
                href={
                  activeConcept
                    ? `/practice/concept_practice/${activeConcept.id}`
                    : activeChapter
                    ? `/practice/chapter_practice/${activeChapter.id}`
                    : `/practice/subject_practice/${activeSubject?.id}`
                }
                className="btn btn-primary btn-lg"
                style={{ gap: '0.5rem' }}
              >
                <Play size={16} fill="#ffffff" />
                <span>Practice {visibleQuestions.length} Questions</span>
              </Link>
            )}
          </div>

          {/* Question Previews */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Questions in this topic ({visibleQuestions.length})
              </span>
            </div>

            {visibleQuestions.length === 0 ? (
              <div
                className="glass-panel"
                style={{ padding: '3rem 2rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}
              >
                <FileQuestion size={36} color="var(--text-dim)" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No questions assigned to this level yet</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  You can assign existing questions or add new ones in the Admin Dashboard.
                </div>
              </div>
            ) : (
              visibleQuestions.map((q, idx) => (
                <div
                  key={q.id}
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
                      <span className="badge badge-teal">Q{idx + 1}</span>
                      {q.concept && (
                        <span className="badge badge-purple">{q.concept.name}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.98rem', lineHeight: 1.5, color: 'var(--text-main)' }}>
                    {q.question_text}
                  </div>

                  {q.clinical_vignette && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      Case: {q.clinical_vignette}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <span>{q.answer_choices.length} Answer Choices</span>

                    <Link
                      href={
                        activeConcept
                          ? `/practice/concept_practice/${activeConcept.id}`
                          : activeChapter
                          ? `/practice/chapter_practice/${activeChapter.id}`
                          : `/practice/subject_practice/${activeSubject?.id}`
                      }
                      className="btn btn-outline btn-sm"
                      style={{ gap: '0.35rem' }}
                    >
                      <span>Practice</span>
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
