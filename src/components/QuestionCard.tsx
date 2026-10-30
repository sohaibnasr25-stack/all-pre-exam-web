'use client';

import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Star,
  Flag,
  AlertCircle,
  Lock,
  Edit3,
  X,
} from 'lucide-react';
import { Question, BookmarkCategory } from '@/lib/types';

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedChoiceId: string | null;
  isFlagged: boolean;
  activeBookmarkCategory?: BookmarkCategory | null;
  activeBookmarkNote?: string;
  mode: 'complete_exam' | 'subject_practice' | 'chapter_practice' | 'concept_practice' | 'retry_mode' | 'bookmarks_practice' | 'repeated_concept';
  feedbackMode?: 'instant' | 'exam_end';
  isSubmitted: boolean;
  onSelectChoice: (choiceId: string) => void;
  onClearChoice: () => void;
  onToggleFlag: () => void;
  onBookmark: (category: BookmarkCategory, notes?: string, action?: 'toggle' | 'save' | 'remove') => void;
}

function cleanExplanationText(raw?: string): { labelType: 'correct' | 'incorrect' | 'neutral'; text: string } {
  if (!raw) return { labelType: 'neutral', text: '' };
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:(?:Explanation(?:\s*\([A-Ea-e]\))?|Why Correct|Why Incorrect|التفسير|تفسير|الشرح|شرح)\s*[:—–\-]*\s*(Incorrect|Correct|صحيح|غير صحيح|خطأ)?\s*[:—–\-]*\s*)/i);
  if (match) {
    const rawStatus = (match[1] || '').toLowerCase();
    const isInc = rawStatus === 'incorrect' || rawStatus === 'غير صحيح' || rawStatus === 'خطأ' || /incorrect/i.test(match[0]);
    const isCor = rawStatus === 'correct' || rawStatus === 'صحيح' || /why correct/i.test(match[0]);
    const remaining = trimmed.substring(match[0].length).trim();
    return {
      labelType: isInc ? 'incorrect' : isCor ? 'correct' : 'neutral',
      text: remaining || trimmed,
    };
  }
  return { labelType: 'neutral', text: trimmed };
}

export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedChoiceId,
  isFlagged,
  activeBookmarkCategory,
  activeBookmarkNote = '',
  mode,
  feedbackMode,
  isSubmitted,
  onSelectChoice,
  onClearChoice,
  onToggleFlag,
  onBookmark,
}: QuestionCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [readMoreExpanded, setReadMoreExpanded] = useState(false);
  const [bookmarkMenuOpen, setBookmarkMenuOpen] = useState(false);
  const [bookmarkCategory, setBookmarkCategory] = useState<BookmarkCategory>(
    activeBookmarkCategory || 'important'
  );
  const [bookmarkNote, setBookmarkNote] = useState<string>(activeBookmarkNote || '');

  useEffect(() => {
    if (activeBookmarkCategory) {
      setBookmarkCategory(activeBookmarkCategory);
    }
    setBookmarkNote(activeBookmarkNote || '');
  }, [activeBookmarkCategory, activeBookmarkNote]);

  // Determine if instant feedback is active
  // If feedbackMode is explicitly provided, respect it; otherwise default based on mode
  const isInstantFeedback = feedbackMode ? feedbackMode === 'instant' : mode !== 'complete_exam';
  const isPracticeMode = isInstantFeedback;
  const shouldRevealExplanations = isSubmitted || (isInstantFeedback && selectedChoiceId !== null) || showExplanation;

  // Once an answer's correctness is revealed (or exam is submitted), choices are permanently locked
  const isAnswerLocked = isSubmitted || shouldRevealExplanations;

  // Keyboard shortcut listener to select options rapidly (1-5 or A-E)
  useEffect(() => {
    if (isAnswerLocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswerLocked) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toUpperCase();
      const indexMap: Record<string, number> = {
        'A': 0, '1': 0,
        'B': 1, '2': 1,
        'C': 2, '3': 2,
        'D': 3, '4': 3,
        'E': 4, '5': 4,
      };
      if (key in indexMap) {
        const targetIdx = indexMap[key];
        if (targetIdx < question.answer_choices.length) {
          onSelectChoice(question.answer_choices[targetIdx].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswerLocked, question.answer_choices, onSelectChoice]);

  // Correct choice
  const correctChoice = question.answer_choices.find((c) => c.is_correct);
  const selectedChoice = question.answer_choices.find((c) => c.id === selectedChoiceId);
  const isUserCorrect = selectedChoice?.is_correct ?? false;

  // Main correct explanation (fallback to first available explanation)
  const mainExplanation =
    question.explanations.find((e) => e.is_why_correct || (e.choice_id && e.choice_id === correctChoice?.id)) ||
    question.explanations[0];

  return (
    <div
      className="glass-panel animate-question-slide question-card-container"
      style={{
        padding: '2rem',
        borderRadius: 'var(--radius-xl)',
        position: 'relative',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Question Header: Number, Metadata Badges, Flags & Bookmarks */}
      <div
        className="question-card-inner-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: '1.15rem',
              color: '#38bdf8',
            }}
          >
            Question {questionIndex + 1}
            <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 500 }}> of {totalQuestions}</span>
          </span>

          {question.subject && (
            <span className="badge badge-teal">{question.subject.name}</span>
          )}
          {question.concept && (
            <span className="badge badge-blue">{question.concept.name}</span>
          )}
        </div>

        {/* Action Controls: Flag for review & Bookmark menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Flag Button */}
          <button
            onClick={onToggleFlag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: isFlagged ? '#f59e0b' : 'var(--text-muted)',
              background: isFlagged ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface-elevated)',
              border: isFlagged ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
            }}
            title="Mark for later review"
          >
            <Flag size={14} fill={isFlagged ? '#f59e0b' : 'none'} />
            <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
          </button>

          {/* Bookmark Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setBookmarkMenuOpen(!bookmarkMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: activeBookmarkCategory ? '#2dd4bf' : 'var(--text-muted)',
                background: activeBookmarkCategory ? 'rgba(13, 148, 136, 0.15)' : 'var(--bg-surface-elevated)',
                border: activeBookmarkCategory ? '1px solid rgba(13, 148, 136, 0.3)' : '1px solid var(--border-subtle)',
              }}
            >
              <Bookmark size={14} fill={activeBookmarkCategory ? '#2dd4bf' : 'none'} />
              <span>
                {activeBookmarkCategory === 'important'
                  ? '⭐ Important'
                  : activeBookmarkCategory === 'review_later'
                  ? '🚩 Review'
                  : activeBookmarkCategory === 'not_understood'
                  ? '❓ Difficult'
                  : 'Bookmark'}
              </span>
              <ChevronDown size={12} />
            </button>

            {bookmarkMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '115%',
                  zIndex: 35,
                  width: 'min(320px, calc(100vw - 2rem))',
                  maxWidth: 'calc(100vw - 2rem)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-highlight)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  animation: 'cardFadeIn 0.15s ease-out',
                  boxSizing: 'border-box',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Bookmark size={14} color="#06b6d4" />
                    <span>المفضلة والملاحظات (Bookmark & Note)</span>
                  </div>
                  <button
                    onClick={() => setBookmarkMenuOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Category Pills */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    التصنيف (Category):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setBookmarkCategory('important')}
                      style={{
                        padding: '0.45rem 0.3rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: bookmarkCategory === 'important' ? '1.5px solid #f59e0b' : '1px solid var(--border-subtle)',
                        background: bookmarkCategory === 'important' ? 'rgba(245, 158, 11, 0.18)' : 'var(--bg-surface-elevated)',
                        color: bookmarkCategory === 'important' ? '#fbbf24' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      ⭐ مهم
                    </button>

                    <button
                      type="button"
                      onClick={() => setBookmarkCategory('review_later')}
                      style={{
                        padding: '0.45rem 0.3rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: bookmarkCategory === 'review_later' ? '1.5px solid #0284c7' : '1px solid var(--border-subtle)',
                        background: bookmarkCategory === 'review_later' ? 'rgba(14, 165, 233, 0.18)' : 'var(--bg-surface-elevated)',
                        color: bookmarkCategory === 'review_later' ? '#38bdf8' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      🚩 مراجعة
                    </button>

                    <button
                      type="button"
                      onClick={() => setBookmarkCategory('not_understood')}
                      style={{
                        padding: '0.45rem 0.3rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: bookmarkCategory === 'not_understood' ? '1.5px solid #ef4444' : '1px solid var(--border-subtle)',
                        background: bookmarkCategory === 'not_understood' ? 'rgba(239, 68, 68, 0.18)' : 'var(--bg-surface-elevated)',
                        color: bookmarkCategory === 'not_understood' ? '#fb7185' : 'var(--text-muted)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      ❓ صعب
                    </button>
                  </div>
                </div>

                {/* Personal Note Textarea */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    الملاحظة الشخصية (Personal Note):
                  </div>
                  <textarea
                    value={bookmarkNote}
                    onChange={(e) => setBookmarkNote(e.target.value)}
                    placeholder="اكتب ملاحظتك الشخصية حول هذا السؤال (مثال: مراجعة خطوات حساب قانون التدرج الرئوي السنخي)..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      lineHeight: 1.45,
                      resize: 'none',
                    }}
                  />
                </div>

                {/* Buttons Row */}
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                  {activeBookmarkCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        onBookmark(bookmarkCategory, undefined, 'remove');
                        setBookmarkMenuOpen(false);
                        setBookmarkNote('');
                      }}
                      className="btn btn-sm btn-danger"
                      style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                    >
                      إزالة
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setBookmarkMenuOpen(false)}
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '0.35rem 0.65rem' }}
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onBookmark(bookmarkCategory, bookmarkNote, 'save');
                      setBookmarkMenuOpen(false);
                    }}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: '0.76rem', padding: '0.35rem 0.85rem' }}
                  >
                    حفظ الملاحظة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Vignette (Case Scenario) */}
      {question.clinical_vignette && (
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--vignette-bg)',
            borderLeft: '4px solid var(--cyan)',
            borderRadius: '0 var(--radius-md) var(--radius-md) 0',
            marginBottom: '1.5rem',
            fontSize: '0.98rem',
            lineHeight: 1.6,
            color: 'var(--vignette-text)',
            border: '1px solid var(--border-subtle)',
            borderLeftWidth: '4px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FileText size={13} />
            <span>Clinical Case Presentation</span>
          </div>
          {question.clinical_vignette}
        </div>
      )}

      {/* Attached Personal Note Display Banner */}
      {activeBookmarkNote && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 0.95rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#fbbf24',
            fontSize: '0.86rem',
            fontStyle: 'italic',
            marginBottom: '1.25rem',
          }}
        >
          <span style={{ fontStyle: 'normal' }}>📝</span>
          <span>
            <strong>Personal note:</strong> &quot;{activeBookmarkNote}&quot;
          </span>
          <button
            onClick={() => setBookmarkMenuOpen(true)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              textDecoration: 'underline',
              fontStyle: 'normal',
            }}
          >
            تعديل الملاحظة
          </button>
        </div>
      )}

      {/* Main Question Text */}
      <h2
        className="question-stem-text"
        style={{
          fontSize: '1.18rem',
          fontWeight: 600,
          lineHeight: 1.55,
          color: 'var(--text-main)',
          marginBottom: '1.75rem',
        }}
      >
        {question.question_text}
      </h2>

      {/* Answer Choices Container with Enhanced Interactive Transitions */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          marginBottom: '1.5rem',
        }}
      >
        {question.answer_choices.map((choice) => {
          const isSelected = selectedChoiceId === choice.id;
          const isCorrect = choice.is_correct;

          let choiceClasses = 'option-choice-item';
          if (isAnswerLocked) choiceClasses += ' option-disabled';
          if (isSelected) choiceClasses += ' option-selected';

          let icon = null;
          if (shouldRevealExplanations) {
            if (isCorrect) {
              choiceClasses += ' option-correct';
              icon = <CheckCircle2 size={18} color="#10b981" />;
            } else if (isSelected && !isCorrect) {
              choiceClasses += ' option-incorrect';
              icon = <XCircle size={18} color="#f43f5e" />;
            }
          }

          // Individual choice explanation if available
          const choiceExplanation = question.explanations.find(
            (e) => e.choice_id === choice.id || e.choice_letter === choice.choice_letter
          );

          return (
            <div key={choice.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                onClick={() => {
                  if (!isAnswerLocked) {
                    onSelectChoice(choice.id);
                  }
                }}
                className={choiceClasses}
                role={isAnswerLocked ? 'article' : 'button'}
                tabIndex={isAnswerLocked ? -1 : 0}
                aria-pressed={isSelected}
                aria-disabled={isAnswerLocked}
                style={{
                  cursor: isAnswerLocked ? 'default' : 'pointer',
                  userSelect: isAnswerLocked ? 'text' : 'none',
                }}
              >
                {/* Choice Letter Bubble (A, B, C, D...) */}
                <div className="option-choice-letter">
                  {choice.choice_letter}
                </div>

                {/* Choice Text */}
                <div className="option-choice-text">
                  {choice.choice_text}
                </div>

                {/* Keyboard Shortcut Hint (Desktop visual cue) */}
                {!isAnswerLocked && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-dim)',
                      opacity: isSelected ? 0.9 : 0.6,
                      transition: 'opacity 0.15s ease',
                    }}
                    title={`Press key '${choice.choice_letter}' on keyboard to select`}
                  >
                    {choice.choice_letter}
                  </span>
                )}

                {/* Status Indicator Icon */}
                {icon && <div style={{ flexShrink: 0 }}>{icon}</div>}
              </div>

              {/* Individual Per-Choice Explanation (shown when revealed with smooth accordion) */}
              {shouldRevealExplanations && (
                (() => {
                  if (choiceExplanation && choiceExplanation.explanation_text?.trim()) {
                    const parsed = cleanExplanationText(choiceExplanation.explanation_text);
                    const isWhyCorrect = choice.is_correct || parsed.labelType === 'correct';

                    return (
                      <div
                        className="animate-explanation-reveal"
                        style={{
                          margin: '0.4rem 0 0.5rem 3.5rem',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.86rem',
                          lineHeight: 1.5,
                          background: isWhyCorrect ? 'var(--success-bg)' : isSelected ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface-elevated)',
                          borderLeft: `3px solid ${isWhyCorrect ? 'var(--success)' : 'var(--error)'}`,
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          borderLeftWidth: '3px',
                        }}
                      >
                        <strong style={{ color: isWhyCorrect ? 'var(--success)' : 'var(--error)', marginRight: '0.35rem' }}>
                          {isWhyCorrect ? 'Why Correct:' : 'Why Incorrect:'}
                        </strong>
                        <span>{parsed.text}</span>
                        {choiceExplanation.source_document && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            <span>Source: {choiceExplanation.source_document}</span>
                            {choiceExplanation.source_page && <span> (p. {choiceExplanation.source_page})</span>}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // If choice lacks a dedicated explanation row, display an informative explanation
                  const correctChoiceObj = question.answer_choices.find((c) => c.is_correct);

                  if (choice.is_correct) {
                    return (
                      <div
                        className="animate-explanation-reveal"
                        style={{
                          margin: '0.4rem 0 0.5rem 3.5rem',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.86rem',
                          lineHeight: 1.5,
                          background: 'var(--success-bg)',
                          borderLeft: '3px solid var(--success)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          borderLeftWidth: '3px',
                        }}
                      >
                        <strong style={{ color: 'var(--success)', marginRight: '0.35rem' }}>
                          Why Correct:
                        </strong>
                        <span>
                          {mainExplanation?.explanation_text
                            ? cleanExplanationText(mainExplanation.explanation_text).text
                            : `Choice ${choice.choice_letter} (${choice.choice_text}) is the verified correct answer.`}
                        </span>
                      </div>
                    );
                  }

                  // Incorrect Choice without dedicated row
                  return (
                    <div
                      className="animate-explanation-reveal"
                      style={{
                        margin: '0.4rem 0 0.5rem 3.5rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.86rem',
                        lineHeight: 1.5,
                        background: isSelected ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderLeft: '3px solid var(--error)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <strong style={{ color: 'var(--error)', marginRight: '0.35rem' }}>
                        Why Incorrect:
                      </strong>
                      <span>
                        Choice {choice.choice_letter} ({choice.choice_text}) is incorrect. The verified correct answer is Choice {correctChoiceObj?.choice_letter || ''} {correctChoiceObj?.choice_text ? `(${correctChoiceObj.choice_text})` : ''}.
                      </span>
                      {mainExplanation?.explanation_text && (
                        <div style={{ marginTop: '0.45rem', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                          <strong style={{ color: 'var(--text-main)' }}>Clinical Rationale: </strong>
                          {cleanExplanationText(mainExplanation.explanation_text).text}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          );
        })}
      </div>

      {/* Choice Toolbar: Clear selection & Toggle practice explanation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: shouldRevealExplanations ? '1.5rem' : '0',
        }}
      >
        {selectedChoiceId && !isAnswerLocked && (
          <button
            onClick={onClearChoice}
            style={{
              color: 'var(--text-dim)',
              fontSize: '0.82rem',
              padding: '0.3rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            Clear selection
          </button>
        )}

        {isPracticeMode && !shouldRevealExplanations && (
          <button
            onClick={() => setShowExplanation(true)}
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 'auto', gap: '0.4rem' }}
          >
            <BookOpen size={14} color="#06b6d4" />
            <span>Show Explanation</span>
          </button>
        )}
      </div>

      {/* Comprehensive Detailed Explanation & Source Citation Section */}
      {shouldRevealExplanations && (
        <div
          className="animate-fade-in"
          style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            background: isUserCorrect ? 'var(--success-bg)' : 'var(--bg-surface-elevated)',
            border: `1px solid ${isUserCorrect ? 'var(--success-border)' : 'var(--border-subtle)'}`,
          }}
        >
          {/* Answer Outcome Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {isUserCorrect ? (
                <>
                  <CheckCircle2 size={20} color="#10b981" />
                  <span style={{ fontWeight: 700, color: '#34d399', fontSize: '1.05rem' }}>
                    Correct Answer! Choice {correctChoice?.choice_letter}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={20} color="#fb7185" />
                  <span style={{ fontWeight: 700, color: '#fb7185', fontSize: '1.05rem' }}>
                    {selectedChoiceId ? 'Incorrect.' : 'Unanswered.'} Correct Answer: Choice {correctChoice?.choice_letter}
                  </span>
                </>
              )}

              {/* Locked Answer Indicator Badge */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="تم تثبيت الإجابة ولا يمكن تعديلها بعد إظهار التقييم"
              >
                <Lock size={11} />
                <span>الإجابة مثبتة</span>
              </span>
            </div>

            {/* Read More / Read Less Toggle */}
            <button
              onClick={() => setReadMoreExpanded(!readMoreExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#38bdf8',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
              }}
            >
              <span>{readMoreExpanded ? 'Collapse Details' : 'Read More & References'}</span>
              {readMoreExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>

          {/* Primary High-Yield Explanation */}
          <div
            style={{
              fontSize: '0.96rem',
              lineHeight: 1.6,
              color: 'var(--text-main)',
              marginBottom: readMoreExpanded ? '1.25rem' : '0.5rem',
            }}
          >
            {(() => {
              const validExpls = question.explanations.filter((e) => e.explanation_text?.trim());
              if (validExpls.length > 1) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {validExpls.map((e) => {
                      const parsed = cleanExplanationText(e.explanation_text);
                      const isCorrectChoice = question.answer_choices.find((c) => c.choice_letter === e.choice_letter)?.is_correct;
                      return (
                        <div key={e.id || e.choice_letter} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: isCorrectChoice ? 'var(--success-bg)' : 'rgba(255, 255, 255, 0.08)',
                              color: isCorrectChoice ? 'var(--success)' : 'var(--text-muted)',
                              border: `1px solid ${isCorrectChoice ? 'var(--success)' : 'var(--border-subtle)'}`,
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            Choice {e.choice_letter}
                          </span>
                          <span style={{ color: 'var(--text-main)' }}>{parsed.text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              if (mainExplanation?.explanation_text) {
                const parsed = cleanExplanationText(mainExplanation.explanation_text);
                return <div>{parsed.text}</div>;
              }

              return (
                <span style={{ color: 'var(--text-muted)' }}>
                  The explanation is not available in the provided source files.
                </span>
              );
            })()}
          </div>

          {/* Expandable Deep Rationale and Academic Sources */}
          {readMoreExpanded && (
            <div
              style={{
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Concept & Chapter Association */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.86rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Subject & Chapter
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {question.subject?.name || 'General'} → {question.chapter?.name || 'Overview'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Target Concept
                  </span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                    {question.concept?.name || 'Integrated Clinical Mechanism'}
                  </span>
                </div>
              </div>

              {/* Exact Source Citations (Section 7 & 8) */}
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(13, 148, 136, 0.08)',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}
              >
                <BookOpen size={18} color="#2dd4bf" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: '#2dd4bf', marginBottom: '0.2rem' }}>
                    Source Literature & Exact Page Reference
                  </div>
                  {mainExplanation?.source_document ? (
                    <div>
                      <div>
                        <strong>Document / Textbook:</strong> {mainExplanation.source_document}
                      </div>
                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                        <span>
                          <strong>Exact Page:</strong> {mainExplanation.source_page || 'N/A'}
                        </span>
                        <span>
                          <strong>Section:</strong> {mainExplanation.source_reference || 'Core Curriculum'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      The explanation is not available in the provided source files.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          :global(.question-card-container) {
            padding: 0.85rem 0.75rem !important;
            border-radius: var(--radius-md) !important;
          }
          :global(.question-card-inner-header) {
            gap: 0.5rem !important;
            margin-bottom: 0.75rem !important;
            padding-bottom: 0.6rem !important;
          }
          :global(.question-stem-text) {
            font-size: 0.98rem !important;
            line-height: 1.5 !important;
            margin-bottom: 0.9rem !important;
          }
        }

        /* Extra compact for very small screens (iPhone SE etc.) */
        @media (max-width: 390px) {
          :global(.question-card-container) {
            padding: 0.75rem 0.6rem !important;
          }
          :global(.question-stem-text) {
            font-size: 0.92rem !important;
            margin-bottom: 0.75rem !important;
          }
        }
      `}</style>
    </div>
  );
}
