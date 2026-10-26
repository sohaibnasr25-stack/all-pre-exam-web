'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingDown,
  AlertTriangle,
  Play,
  CheckCircle2,
  BookOpen,
  Filter,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { WeaknessMetric } from '@/lib/types';

export default function WeaknessAnalysisPage() {
  const [metrics, setMetrics] = useState<WeaknessMetric[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'weak' | 'attempted'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('/api/weakness-analysis');
        const data = await res.json();
        if (data.success) {
          setMetrics(data.data);
        }
      } catch (err) {
        console.error('Failed to load weakness analysis:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const weakCount = metrics.filter((m) => m.is_weak).length;
  const attemptedCount = metrics.filter((m) => m.total_attempts > 0).length;

  const filteredMetrics = metrics.filter((m) => {
    if (selectedFilter === 'weak') return m.is_weak;
    if (selectedFilter === 'attempted') return m.total_attempts > 0;
    return true;
  });

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fb7185', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          <TrendingDown size={16} />
          <span>Clinical Knowledge Diagnostics</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Weakness Analysis Engine
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '750px', lineHeight: 1.6 }}>
          Automated performance breakdown structured strictly across <strong>Subject → Chapter → Concept</strong>.
          Identifies knowledge gaps where accuracy is below the 70% passing threshold and provides 1-click targeted drills.
        </p>
      </div>

      {/* Summary KPI Cards with 3D Floating Effect */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderColor: 'rgba(244, 63, 94, 0.35)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Flagged Weak Concepts (&lt;70%)
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fb7185' }}>
            {weakCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Requiring immediate reinforcement
          </div>
        </div>

        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderColor: 'rgba(6, 182, 212, 0.35)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Concepts Tested
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8' }}>
            {attemptedCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Of {metrics.length} total concepts
          </div>
        </div>

        <div className="card-3d" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Curriculum Coverage
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399' }}>
            {metrics.length > 0 ? Math.round((attemptedCount / metrics.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Subject matter surveyed
          </div>
        </div>
      </div>

      {/* Filter Tabs with 3D Floating Effect */}
      <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedFilter('all')}
          className={`pill-3d pill-3d-cyan ${selectedFilter === 'all' ? 'active' : ''}`}
        >
          <span>All Concepts ({metrics.length})</span>
        </button>

        <button
          onClick={() => setSelectedFilter('weak')}
          className={`pill-3d pill-3d-rose ${selectedFilter === 'weak' ? 'active' : ''}`}
        >
          <AlertTriangle size={14} color="#f43f5e" />
          <span>Weak Concepts Needing Review ({weakCount})</span>
        </button>

        <button
          onClick={() => setSelectedFilter('attempted')}
          className={`pill-3d pill-3d-blue ${selectedFilter === 'attempted' ? 'active' : ''}`}
        >
          <span>Attempted Concepts ({attemptedCount})</span>
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Computing accuracy distributions across hierarchy...
        </div>
      )}

      {/* Breakdown Table / Cards with 3D Floating Effect */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredMetrics.map((item) => {
          const hasAttempts = item.total_attempts > 0;
          return (
            <div
              key={item.concept_id}
              className="card-3d"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
                borderColor: item.is_weak ? 'rgba(244, 63, 94, 0.45)' : undefined,
              }}
            >
              {/* Hierarchy Path & Concept Title */}
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#2dd4bf', fontWeight: 600 }}>{item.subject_name}</span>
                  <span>→</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{item.chapter_name}</span>
                </div>

                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {item.is_weak && <AlertTriangle size={17} color="#f43f5e" />}
                  <span>{item.concept_name}</span>
                </div>
              </div>

              {/* Progress & Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ minWidth: '120px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Accuracy</span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: !hasAttempts ? 'var(--text-dim)' : item.is_weak ? '#fb7185' : '#34d399',
                      }}
                    >
                      {hasAttempts ? `${item.accuracy_percentage}%` : 'Not Tested'}
                    </span>
                  </div>

                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: hasAttempts ? `${item.accuracy_percentage}%` : '0%',
                        background: item.is_weak ? '#f43f5e' : '#10b981',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>

                  {hasAttempts && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                      {item.correct_count} correct / {item.total_attempts} total
                    </div>
                  )}
                </div>

                {/* Targeted Practice CTA */}
                <Link
                  href={`/practice/concept_practice/${item.concept_id}`}
                  className="btn btn-primary btn-sm"
                  style={{
                    background: item.is_weak
                      ? 'linear-gradient(135deg, #f43f5e 0%, #ea580c 100%)'
                      : 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                    boxShadow: item.is_weak ? '0 4px 12px rgba(244, 63, 94, 0.35)' : undefined,
                    gap: '0.35rem',
                  }}
                >
                  <Play size={12} fill="#ffffff" />
                  <span>{item.is_weak ? 'Reinforce Weakness' : 'Practice Concept'}</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
