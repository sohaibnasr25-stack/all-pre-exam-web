'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  BookOpen,
  FileCheck2,
  Play,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Filter,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { RepeatedConceptStat, AcademicYear, Module, Subject } from '@/lib/types';

export default function RepeatedConceptsPage() {
  const [concepts, setConcepts] = useState<RepeatedConceptStat[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Hierarchy filter state: Year -> Module -> Subject
  const [selectedYearId, setSelectedYearId] = useState<string>('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [expandedConceptId, setExpandedConceptId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [repRes, yearsRes, modRes, subRes] = await Promise.all([
          fetch('/api/repeated-concepts'),
          fetch('/api/academic-years'),
          fetch('/api/modules'),
          fetch('/api/subjects'),
        ]);

        const [repData, yearsData, modData, subData] = await Promise.all([
          repRes.json(),
          yearsRes.json(),
          modRes.json(),
          subRes.json(),
        ]);

        if (repData.success) {
          setConcepts(repData.data);
          if (repData.data.length > 0) {
            setExpandedConceptId(repData.data[0].concept_id);
          }
        }
        if (yearsData.success) setAcademicYears(yearsData.data);
        if (modData.success) setModules(modData.data);
        if (subData.success) setSubjects(subData.data);
      } catch (err) {
        console.error('Failed to load repeated concepts data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Cascading filters
  // 1. Modules filtered by Year
  const visibleModules = selectedYearId === 'all'
    ? modules
    : modules.filter((m) => m.academic_year_id === selectedYearId);

  // 2. Subjects filtered by Module (or Year if module is 'all')
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

  // Filter repeated concepts by Year, Module, and Subject
  const filteredConcepts = concepts.filter((item) => {
    // Academic Year filter
    if (selectedYearId !== 'all') {
      const directYearMatch = item.academic_year_id === selectedYearId;
      const examYearMatch = item.exams?.some((e) => {
        const y = academicYears.find((ay) => ay.id === selectedYearId);
        return y && e.year_name === y.name;
      });
      if (!directYearMatch && !examYearMatch) return false;
    }

    // Module filter
    if (selectedModuleId !== 'all') {
      if (item.module_id && item.module_id !== selectedModuleId) return false;
    }

    // Subject filter
    if (selectedSubjectId !== 'all') {
      if (item.subject_id && item.subject_id !== selectedSubjectId) return false;
    }

    return true;
  });

  const hasActiveFilters = selectedYearId !== 'all' || selectedModuleId !== 'all' || selectedSubjectId !== 'all';

  const handleResetFilters = () => {
    setSelectedYearId('all');
    setSelectedModuleId('all');
    setSelectedSubjectId('all');
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          <Sparkles size={16} />
          <span>High-Yield Cross-Exam Analysis</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Repeated Concepts Directory
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '750px', lineHeight: 1.6 }}>
          Medical concepts frequently tested across different academic years, modules, and subjects.
          Filter by Academic Year → Module → Subject to target high-yield biological mechanisms.
        </p>
      </div>

      {/* Hierarchy Filter Bar: Academic Year -> Module -> Subject */}
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
          <Filter size={16} color="#c084fc" />
          <span>Hierarchy Filters:</span>
        </div>

        {/* Academic Year Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Academic Year:</span>
          <select
            value={selectedYearId}
            onChange={(e) => {
              setSelectedYearId(e.target.value);
              setSelectedModuleId('all');
              setSelectedSubjectId('all');
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
            onChange={(e) => {
              setSelectedModuleId(e.target.value);
              setSelectedSubjectId('all');
            }}
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

        {/* Subject Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Subject:</span>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="form-select"
            style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.88rem' }}
          >
            <option value="all">All Subjects</option>
            {visibleSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="btn btn-secondary btn-sm"
            style={{ gap: '0.35rem', fontSize: '0.8rem' }}
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredConcepts.length}</strong> concept{filteredConcepts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Analyzing concept frequencies across curriculum databases...
        </div>
      )}

      {!loading && filteredConcepts.length === 0 && (
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
            No repeated concepts match the selected filters
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
            Try selecting a different academic year, module, or subject, or reset your filters to see all available high-yield concepts.
          </p>
          {hasActiveFilters && (
            <button onClick={handleResetFilters} className="btn btn-primary btn-sm">
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Concepts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {filteredConcepts.map((item) => {
          const isExpanded = expandedConceptId === item.concept_id;
          const isHighFrequency = item.appearance_count > 1;

          return (
            <div
              key={item.concept_id}
              className="card-3d"
              style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                borderColor: isHighFrequency ? 'rgba(168, 85, 247, 0.45)' : undefined,
              }}
            >
              {/* Summary Card Header */}
              <div
                style={{
                  padding: '1.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  cursor: 'pointer',
                  background: isExpanded ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                }}
                onClick={() => setExpandedConceptId(isExpanded ? null : item.concept_id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: '280px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: isHighFrequency ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-surface-elevated)',
                      border: `1px solid ${isHighFrequency ? '#a855f7' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isHighFrequency ? '#c084fc' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {isHighFrequency ? <Flame size={22} color="#c084fc" /> : <Sparkles size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                      {item.academic_year_name && (
                        <span className="badge badge-blue">{item.academic_year_name}</span>
                      )}
                      {item.module_name && (
                        <span className="badge badge-teal">{item.module_name}</span>
                      )}
                      <span className="badge badge-purple">{item.subject_name}</span>
                      <span className="badge badge-blue">{item.chapter_name}</span>
                      {isHighFrequency && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          Repeated in {item.appearance_count} Questions
                        </span>
                      )}
                    </div>

                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35, color: 'var(--text-main)' }}>
                      {item.concept_name}
                    </h2>
                  </div>
                </div>

                {/* Actions & Expand Chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <Link
                    href={`/practice/repeated_concept/${item.concept_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn btn-primary btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #9333ea 0%, #0284c7 100%)',
                      boxShadow: '0 4px 12px rgba(147, 51, 234, 0.35)',
                      gap: '0.35rem',
                    }}
                  >
                    <Play size={13} fill="#ffffff" />
                    <span>Practice Concept ({item.questions.length})</span>
                  </Link>

                  <button
                    style={{
                      padding: '0.45rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Expanded Details: Exams appeared in & Question list */}
              {isExpanded && (
                <div
                  className="animate-fade-in"
                  style={{
                    padding: '1.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-elevated)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                  }}
                >
                  {/* Exams where it appeared */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileCheck2 size={14} color="#06b6d4" />
                      <span>Appeared in the Following Examinations ({item.exams.length})</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                      {item.exams.map((ex) => (
                        <Link
                          key={ex.id}
                          href={`/practice/complete_exam/${ex.id}`}
                          className="badge badge-teal"
                          style={{
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <FileCheck2 size={13} />
                          <span>{ex.title}</span>
                          {ex.year_name && <span style={{ opacity: 0.7 }}>({ex.year_name})</span>}
                        </Link>
                      ))}
                      {item.exams.length === 0 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                          Assigned directly to chapter question pool
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Associated Questions Preview */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <HelpCircle size={14} color="#fbbf24" />
                      <span>Associated Questions ({item.questions.length})</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {item.questions.map((q, qIdx) => (
                        <div
                          key={q.id}
                          style={{
                            padding: '1rem',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                              <span style={{ color: '#c084fc', marginRight: '0.4rem' }}>#{qIdx + 1}</span>
                              {q.question_text}
                            </div>
                            {q.clinical_vignette && (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Case: {q.clinical_vignette}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
