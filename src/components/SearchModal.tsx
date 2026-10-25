'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, FileText, Layers, BookOpen, Sparkles, HelpCircle } from 'lucide-react';

interface SearchResultPayload {
  exams: { id: string; title: string; exam_type: string }[];
  modules: { id: string; name: string; code: string }[];
  subjects: { id: string; name: string; code: string }[];
  chapters: { id: string; name: string }[];
  concepts: { id: string; name: string; code?: string }[];
  questions: { id: string; question_text: string }[];
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultPayload | null>(null);

  // Synchronize modal open state using HTML5 dialog API
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Fallback for light-dismiss on browsers that don't yet support closedby attribute
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
        onClose();
      }
    };

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', handleBackdropClick);
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('click', handleBackdropClick);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          const dialog = dialogRef.current;
          if (dialog && !dialog.open) {
            dialog.showModal();
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Perform search query
  const executeSearch = useCallback(async (text: string) => {
    if (!text.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(text.trim())}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  const hasAnyResults = results && (
    results.exams.length > 0 ||
    results.modules.length > 0 ||
    results.subjects.length > 0 ||
    results.chapters.length > 0 ||
    results.concepts.length > 0 ||
    results.questions.length > 0
  );

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="searchDialogTitle"
      style={{
        maxWidth: '680px',
        width: '92%',
        padding: 0,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-highlight)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
      }}
    >
      {/* Header with Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)',
        }}
      >
        <Search size={20} color="#06b6d4" />
        <input
          ref={inputRef}
          id="searchDialogTitle"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exams, subjects, chapters, concepts, or questions..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main)',
            fontSize: '1.05rem',
            fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ color: 'var(--text-dim)', padding: '0.2rem' }}
          >
            <X size={18} />
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '0.35rem 0.65rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          ESC
        </button>
      </div>

      {/* Results Container */}
      <div
        style={{
          maxHeight: '440px',
          overflowY: 'auto',
          padding: '1rem 1.25rem',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Searching medical curriculum...
          </div>
        )}

        {!loading && query && !hasAnyResults && (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            No results found for &quot;<strong>{query}</strong>&quot;.
            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-dim)' }}>
              Try searching for &quot;Cardiovascular&quot;, &quot;Physiology&quot;, or &quot;Pacemaker&quot;.
            </div>
          </div>
        )}

        {!loading && !query && (
          <div style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Quick Navigation
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                onClick={() => handleSelect('/exams')}
                className="btn btn-secondary btn-sm"
              >
                Browse All Exams
              </button>
              <button
                onClick={() => handleSelect('/study')}
                className="btn btn-secondary btn-sm"
              >
                Browse by Subject
              </button>
              <button
                onClick={() => handleSelect('/repeated-concepts')}
                className="btn btn-secondary btn-sm"
              >
                Repeated Concepts
              </button>
              <button
                onClick={() => handleSelect('/bookmarks')}
                className="btn btn-secondary btn-sm"
              >
                My Question Bank
              </button>
            </div>
          </div>
        )}

        {/* Search Results Display */}
        {!loading && results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Exams Section */}
            {results.exams.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Complete Exams ({results.exams.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {results.exams.map((exam) => (
                    <div
                      key={exam.id}
                      onClick={() => handleSelect(`/practice/complete_exam/${exam.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileText size={16} color="#06b6d4" />
                        <span style={{ fontWeight: 500, fontSize: '0.92rem' }}>{exam.title}</span>
                      </div>
                      <span className="badge badge-teal">
                        {exam.exam_type === 'end_module' ? 'END MODULE' : 'FINAL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concepts Section */}
            {results.concepts.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Medical Concepts ({results.concepts.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {results.concepts.map((con) => (
                    <div
                      key={con.id}
                      onClick={() => handleSelect(`/practice/concept_practice/${con.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Sparkles size={16} color="#a855f7" />
                        <span style={{ fontWeight: 500, fontSize: '0.92rem' }}>{con.name}</span>
                      </div>
                      <span className="badge badge-purple">Practice Concept</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subjects & Modules */}
            {(results.subjects.length > 0 || results.modules.length > 0) && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Subjects & Modules
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {results.subjects.map((sub) => (
                    <div
                      key={sub.id}
                      onClick={() => handleSelect(`/practice/subject_practice/${sub.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <BookOpen size={16} color="#10b981" />
                        <span>{sub.name}</span>
                      </div>
                      <span className="badge badge-success">{sub.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions Section */}
            {results.questions.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Questions ({results.questions.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {results.questions.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => handleSelect(`/study?question_id=${q.id}`)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <HelpCircle size={15} color="#fbbf24" style={{ marginTop: '3px', flexShrink: 0 }} />
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {q.question_text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
