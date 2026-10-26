'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Flag,
  CheckCircle,
} from 'lucide-react';

interface QuestionNavigationProps {
  currentIndex: number;
  totalQuestions: number;
  answers: Record<string, string | null>;
  flags: Record<string, boolean>;
  questionIds: string[];
  durationMinutes?: number;
  secondsRemaining?: number;
  isExamMode: boolean;
  isSubmitted: boolean;
  onSelectIndex: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export default function QuestionNavigation({
  currentIndex,
  totalQuestions,
  answers,
  flags,
  questionIds,
  durationMinutes = 60,
  secondsRemaining: externalSeconds,
  isExamMode,
  isSubmitted,
  onSelectIndex,
  onPrevious,
  onNext,
  onSubmit,
}: QuestionNavigationProps) {
  // Timer state (use external if provided, else internal)
  const [internalSeconds, setInternalSeconds] = useState(durationMinutes * 60);
  const secondsRemaining = externalSeconds !== undefined ? externalSeconds : internalSeconds;

  useEffect(() => {
    if (externalSeconds !== undefined || !isExamMode || isSubmitted) return;

    const timer = setInterval(() => {
      setInternalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [externalSeconds, isExamMode, isSubmitted, onSubmit]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Answered count calculation
  const answeredCount = questionIds.filter((qid) => answers[qid] !== undefined && answers[qid] !== null).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Top Status Bar: Progress, Timer & Quick Submit */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        {/* Progress Bar & Answered Counter */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Progress</span>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>
              {answeredCount} / {totalQuestions} answered ({progressPercent}%)
            </span>
          </div>
          <div
            style={{
              height: '8px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, #0d9488, #06b6d4)',
                borderRadius: '9999px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Timer Display (if in exam mode) */}
        {isExamMode && !isSubmitted && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: secondsRemaining < 300 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface-elevated)',
              border: `1px solid ${secondsRemaining < 300 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}`,
              color: secondsRemaining < 300 ? '#f87171' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '1.05rem',
            }}
          >
            <Clock size={18} color={secondsRemaining < 300 ? '#f87171' : '#06b6d4'} />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
        )}

        {/* Prominent Submit Exam Button */}
        {!isSubmitted && (
          <button
            onClick={onSubmit}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.4rem',
              background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(13, 148, 136, 0.4)',
            }}
          >
            <span>{isExamMode ? 'Submit Exam' : 'Finish Practice'}</span>
            <Send size={15} />
          </button>
        )}
      </div>

      {/* Navigation Controls: Previous / Next & Question Grid Palette */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onPrevious}
            disabled={currentIndex === 0}
            className="btn btn-secondary btn-sm"
            style={{ opacity: currentIndex === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Question Palette
          </span>

          <button
            onClick={onNext}
            disabled={currentIndex === totalQuestions - 1}
            className="btn btn-secondary btn-sm"
            style={{ opacity: currentIndex === totalQuestions - 1 ? 0.4 : 1 }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Question Palette Matrix */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.45rem',
            justifyContent: 'center',
            maxHeight: '160px',
            overflowY: 'auto',
            padding: '0.25rem',
          }}
        >
          {questionIds.map((qid, idx) => {
            const isCurrent = idx === currentIndex;
            const isAnswered = answers[qid] !== undefined && answers[qid] !== null;
            const isFlagged = !!flags[qid];

            let bgColor = 'var(--bg-surface-elevated)';
            let borderColor = 'var(--border-subtle)';
            let textColor = 'var(--text-muted)';

            if (isAnswered) {
              bgColor = 'rgba(13, 148, 136, 0.2)';
              borderColor = 'rgba(13, 148, 136, 0.5)';
              textColor = '#2dd4bf';
            }

            if (isFlagged) {
              borderColor = '#f59e0b';
            }

            if (isCurrent) {
              borderColor = '#06b6d4';
              bgColor = '#06b6d4';
              textColor = '#ffffff';
            }

            return (
              <button
                key={qid}
                onClick={() => onSelectIndex(idx)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: bgColor,
                  border: `1.5px solid ${borderColor}`,
                  color: textColor,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{idx + 1}</span>
                {isFlagged && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#f59e0b',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            flexWrap: 'wrap',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#06b6d4' }} />
            <span>Current</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(13, 148, 136, 0.3)', border: '1px solid #0d9488' }} />
            <span>Answered</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }} />
            <span>Unanswered</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            <span>Flagged</span>
          </div>
        </div>
      </div>
    </div>
  );
}
