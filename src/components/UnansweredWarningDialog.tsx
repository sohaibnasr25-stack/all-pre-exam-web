'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface UnansweredWarningDialogProps {
  isOpen: boolean;
  unansweredCount: number;
  totalQuestions: number;
  unansweredIndices: number[];
  onCancel: () => void;
  onConfirmSubmit: () => void;
  onJumpToQuestion: (index: number) => void;
}

export default function UnansweredWarningDialog({
  isOpen,
  unansweredCount,
  totalQuestions,
  unansweredIndices,
  onCancel,
  onConfirmSubmit,
  onJumpToQuestion,
}: UnansweredWarningDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Fallback for light-dismiss on browsers that don't support closedby
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isContent) {
        onCancel();
      }
    };

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', handleBackdropClick);
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('click', handleBackdropClick);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="unansweredWarningTitle"
      style={{
        maxWidth: '520px',
        width: '90%',
        padding: '2rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--warning-border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.15)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}
        >
          <AlertTriangle size={28} color="#f59e0b" />
        </div>
        <h3 id="unansweredWarningTitle" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Unanswered Questions Remaining
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>
          You have answered <strong>{totalQuestions - unansweredCount}</strong> of <strong>{totalQuestions}</strong> questions.
          There {unansweredCount === 1 ? 'is' : 'are'} still <strong>{unansweredCount}</strong> unanswered {unansweredCount === 1 ? 'question' : 'questions'}.
        </p>
      </div>

      {unansweredIndices.length > 0 && (
        <div style={{ marginBottom: '1.5rem', background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Jump to unanswered:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '100px', overflowY: 'auto' }}>
            {unansweredIndices.map((qIdx) => (
              <button
                key={qIdx}
                onClick={() => {
                  onJumpToQuestion(qIdx);
                  onCancel();
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {qIdx + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Return to Exam
        </button>
        <button
          onClick={onConfirmSubmit}
          className="btn btn-primary"
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
          }}
        >
          <span>Submit Anyway</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </dialog>
  );
}
