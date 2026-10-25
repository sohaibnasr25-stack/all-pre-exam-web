'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, CheckCircle2, Trophy, ArrowRight, Flame } from 'lucide-react';
import { Question } from '@/lib/types';
import QuestionCard from './QuestionCard';

interface RetrySessionProps {
  incorrectQuestions: Question[];
  onFinishedAllRetries: () => void;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function RetrySession({ incorrectQuestions, onFinishedAllRetries }: RetrySessionProps) {
  // Current active queue of questions to conquer
  const [queue, setQueue] = useState<Question[]>(() => shuffleArray(incorrectQuestions));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [conqueredIds, setConqueredIds] = useState<string[]>([]);
  const [retryRound, setRetryRound] = useState(1);
  const [pendingNextRound, setPendingNextRound] = useState<Question[]>([]);
  const [allMastered, setAllMastered] = useState(false);

  const currentQ = queue[currentIdx];
  const totalOriginal = incorrectQuestions.length;

  const handleSelectChoice = (choiceId: string) => {
    setSelectedChoiceId(choiceId);
  };

  const handleConfirmAnswer = () => {
    if (!currentQ || !selectedChoiceId) return;

    const choice = currentQ.answer_choices.find((c) => c.id === selectedChoiceId);
    const isCorrect = choice?.is_correct ?? false;

    if (isCorrect) {
      // Mark as conquered
      if (!conqueredIds.includes(currentQ.id)) {
        setConqueredIds((prev) => [...prev, currentQ.id]);
      }
    } else {
      // Add to next round queue
      setPendingNextRound((prev) => (prev.some((q) => q.id === currentQ.id) ? prev : [...prev, currentQ]));
    }

    // Advance to next question or evaluate round completion
    setTimeout(() => {
      if (currentIdx + 1 < queue.length) {
        setCurrentIdx((prev) => prev + 1);
        setSelectedChoiceId(null);
      } else {
        // Round concluded! Check remaining failures
        const remainingToConquer = pendingNextRound.concat(
          !isCorrect && !pendingNextRound.some((q) => q.id === currentQ.id) ? [currentQ] : []
        );

        if (remainingToConquer.length === 0) {
          // All mastered!
          setAllMastered(true);
          try {
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
          } catch {
            // Optional
          }
        } else {
          // Setup next round with remaining questions randomized
          setQueue(shuffleArray(remainingToConquer));
          setPendingNextRound([]);
          setCurrentIdx(0);
          setSelectedChoiceId(null);
          setRetryRound((r) => r + 1);
        }
      }
    }, 1200);
  };

  if (allMastered) {
    return (
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-xl)',
          background: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.22) 0%, var(--bg-surface) 75%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}
        >
          <Trophy size={32} color="#34d399" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', color: '#34d399' }}>
          All {totalOriginal} Incorrect Questions Mastered!
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
          You persevered and successfully answered every single missed question correctly. Your original exam score remains preserved separately.
        </p>
        <button onClick={onFinishedAllRetries} className="btn btn-primary btn-lg">
          Back to Exam Summary
        </button>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Retry Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCcw size={18} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fbbf24' }}>
              Incorrect Retry Mode — Round {retryRound}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mastering {queue.length} remaining question{queue.length > 1 ? 's' : ''} (Randomized order)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', display: 'block' }}>
              Mastery Progress
            </span>
            <span style={{ fontWeight: 800, color: '#34d399', fontSize: '1.1rem' }}>
              {conqueredIds.length} / {totalOriginal} Mastered
            </span>
          </div>

          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <Flame size={20} color="#10b981" />
          </div>
        </div>
      </div>

      {/* Active Retry Question */}
      <QuestionCard
        question={currentQ}
        questionIndex={currentIdx}
        totalQuestions={queue.length}
        selectedChoiceId={selectedChoiceId}
        isFlagged={false}
        mode="retry_mode"
        isSubmitted={false}
        onSelectChoice={handleSelectChoice}
        onClearChoice={() => setSelectedChoiceId(null)}
        onToggleFlag={() => {}}
        onBookmark={() => {}}
      />

      {/* Confirm Button */}
      {selectedChoiceId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleConfirmAnswer}
            className="btn btn-primary btn-lg"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
            }}
          >
            <span>Confirm & Next</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
