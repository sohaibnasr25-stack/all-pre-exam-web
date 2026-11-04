'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

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
      className="unanswered-warning-dialog"
      closedby="any"
      aria-labelledby="unansweredWarningTitle"
    >
      <style>{`
        .unanswered-warning-dialog {
          max-width: 500px;
          width: 92%;
          padding: 1.75rem 2rem;
          background: var(--bg-surface);
          border: 1px solid var(--warning-border);
          border-radius: var(--radius-xl);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.15);
          box-sizing: border-box;
          margin: auto;
        }

        .unanswered-dialog-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          box-sizing: border-box;
        }

        .unanswered-dialog-btn {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.65rem 0.85rem;
          font-size: 0.88rem;
          font-weight: 600;
          border-radius: var(--radius-md);
          white-space: nowrap;
          box-sizing: border-box;
        }

        @media (max-width: 480px) {
          .unanswered-warning-dialog {
            width: 94% !important;
            padding: 1.35rem 1rem !important;
            border-radius: var(--radius-lg) !important;
          }

          .unanswered-dialog-actions {
            gap: 0.5rem !important;
          }

          .unanswered-dialog-btn {
            padding: 0.62rem 0.45rem !important;
            font-size: 0.82rem !important;
            gap: 0.35rem !important;
          }
        }

        @media (max-width: 330px) {
          .unanswered-dialog-actions {
            flex-direction: column-reverse !important;
            gap: 0.5rem !important;
          }
          .unanswered-dialog-btn {
            width: 100% !important;
          }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.85rem',
          }}
        >
          <AlertTriangle size={26} color="#f59e0b" />
        </div>
        <h3 id="unansweredWarningTitle" style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
          Unanswered Questions Remaining
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          You have answered <strong>{totalQuestions - unansweredCount}</strong> of <strong>{totalQuestions}</strong> questions.
          There {unansweredCount === 1 ? 'is' : 'are'} still <strong>{unansweredCount}</strong> unanswered {unansweredCount === 1 ? 'question' : 'questions'}.
        </p>
      </div>

      {unansweredIndices.length > 0 && (
        <div style={{ marginBottom: '1.25rem', background: 'var(--bg-surface-elevated)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Jump to unanswered:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '110px', overflowY: 'auto' }}>
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
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {qIdx + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="unanswered-dialog-actions">
        <button
          onClick={onCancel}
          className="btn btn-secondary unanswered-dialog-btn"
        >
          Return to Exam
        </button>
        <button
          onClick={onConfirmSubmit}
          className="btn btn-primary unanswered-dialog-btn"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
            color: '#ffffff',
          }}
        >
          <span>Submit Anyway</span>
          <ArrowRight size={15} style={{ flexShrink: 0 }} />
        </button>
      </div>
    </dialog>
  );
}
