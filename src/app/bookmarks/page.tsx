'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Star,
  Flag,
  HelpCircle,
  Play,
  Trash2,
  AlertCircle,
  BookOpen,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { Bookmark as BookmarkItem, BookmarkCategory } from '@/lib/types';

export default function QuestionBankPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bookmarks');
      const data = await res.json();
      if (data.success) {
        setBookmarks(data.data);
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/bookmarks?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error('Error removing bookmark:', err);
    }
  };

  const handleSaveNote = async (item: BookmarkItem) => {
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: item.question_id,
          category: item.category,
          notes: editingNoteText,
          action: 'save',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks((prev) =>
          prev.map((b) => (b.id === item.id ? { ...b, notes: editingNoteText } : b))
        );
        setEditingBookmarkId(null);
      }
    } catch (err) {
      console.error('Error saving bookmark note:', err);
    }
  };

  const filteredBookmarks = bookmarks.filter((b) => {
    if (selectedCategory === 'all') return true;
    return b.category === selectedCategory;
  });

  const importantCount = bookmarks.filter((b) => b.category === 'important').length;
  const reviewCount = bookmarks.filter((b) => b.category === 'review_later').length;
  const notUnderstoodCount = bookmarks.filter((b) => b.category === 'not_understood').length;

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          marginBottom: '2.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            <Bookmark size={16} />
            <span>Personalized Question Bank</span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            My Question Bank
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
            Curate and practice questions you saved across exams. Categorized into High-Yield Important, Review Later, and Difficult Concepts.
          </p>
        </div>

        {/* Practice All Bookmarks Button */}
        {bookmarks.length > 0 && (
          <Link
            href="/practice/bookmarks_practice/all"
            className="btn btn-primary btn-lg"
            style={{ gap: '0.5rem' }}
          >
            <Play size={16} fill="#ffffff" />
            <span>Practice All Bookmarks ({bookmarks.length})</span>
          </Link>
        )}
      </div>

      {/* Category Filter Pills with 3D Floating Effect */}
      <div
        style={{
          display: 'flex',
          gap: '0.85rem',
          flexWrap: 'wrap',
          marginBottom: '2rem',
        }}
      >
        <button
          onClick={() => setSelectedCategory('all')}
          className={`pill-3d pill-3d-cyan ${selectedCategory === 'all' ? 'active' : ''}`}
        >
          <span>All Saved ({bookmarks.length})</span>
        </button>

        <button
          onClick={() => setSelectedCategory('important')}
          className={`pill-3d pill-3d-amber ${selectedCategory === 'important' ? 'active' : ''}`}
        >
          <Star size={14} fill="#f59e0b" color="#f59e0b" />
          <span>⭐ Important ({importantCount})</span>
        </button>

        <button
          onClick={() => setSelectedCategory('review_later')}
          className={`pill-3d pill-3d-blue ${selectedCategory === 'review_later' ? 'active' : ''}`}
        >
          <Flag size={14} fill="#0284c7" color="#0284c7" />
          <span>🚩 Review Later ({reviewCount})</span>
        </button>

        <button
          onClick={() => setSelectedCategory('not_understood')}
          className={`pill-3d pill-3d-rose ${selectedCategory === 'not_understood' ? 'active' : ''}`}
        >
          <HelpCircle size={14} color="#f43f5e" />
          <span>❓ Not Understood ({notUnderstoodCount})</span>
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Loading your personal question bank...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBookmarks.length === 0 && (
        <div
          className="card-3d"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <Bookmark size={42} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            No Bookmarked Questions Found
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
            While solving questions in exams or subject practice, click the bookmark icon to categorize them for rapid targeted revision.
          </p>
          <Link href="/exams" className="btn btn-primary">
            Explore Exams
          </Link>
        </div>
      )}

      {/* Bookmarked Questions List with 3D Floating Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredBookmarks.map((item, idx) => {
          const q = item.question;
          if (!q) return null;

          return (
            <div
              key={item.id}
              className="card-3d"
              style={{
                padding: '1.75rem',
                borderRadius: 'var(--radius-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Card Header: Category & Tags */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      background:
                        item.category === 'important'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : item.category === 'review_later'
                          ? 'rgba(14, 165, 233, 0.2)'
                          : 'rgba(244, 63, 94, 0.2)',
                      color:
                        item.category === 'important'
                          ? '#fbbf24'
                          : item.category === 'review_later'
                          ? '#38bdf8'
                          : '#fb7185',
                      border: `1px solid ${
                        item.category === 'important'
                          ? 'rgba(245, 158, 11, 0.4)'
                          : item.category === 'review_later'
                          ? 'rgba(14, 165, 233, 0.4)'
                          : 'rgba(244, 63, 94, 0.4)'
                      }`,
                    }}
                  >
                    {item.category === 'important'
                      ? '⭐ Important'
                      : item.category === 'review_later'
                      ? '🚩 Review Later'
                      : '❓ Not Understood'}
                  </span>

                  {q.subject && <span className="badge badge-teal">{q.subject.name}</span>}
                  {q.concept && <span className="badge badge-purple">{q.concept.name}</span>}
                </div>

                <button
                  onClick={() => handleRemove(item.id)}
                  style={{
                    color: 'var(--text-dim)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.8rem',
                  }}
                  title="Remove from Question Bank"
                >
                  <Trash2 size={15} />
                  <span>Remove</span>
                </button>
              </div>

              {/* Question Text */}
              <div style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--text-main)' }}>
                {q.question_text}
              </div>

              {/* Case vignette if present */}
              {q.clinical_vignette && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderLeft: '3px solid #06b6d4',
                    borderRadius: '0 8px 8px 0',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {q.clinical_vignette}
                </div>
              )}

              {/* Note attached to bookmark or Edit/Add UI */}
              {editingBookmarkId === item.id ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-highlight)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                  }}
                >
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    الملاحظة الشخصية (Personal Note):
                  </label>
                  <textarea
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    placeholder="اكتب ملاحظتك الشخصية حول هذا السؤال..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '0.86rem',
                      lineHeight: 1.45,
                      resize: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setEditingBookmarkId(null)}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.76rem', gap: '0.3rem' }}
                    >
                      <X size={13} />
                      <span>إلغاء</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveNote(item)}
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: '0.76rem', gap: '0.3rem' }}
                    >
                      <Check size={13} />
                      <span>حفظ الملاحظة</span>
                    </button>
                  </div>
                </div>
              ) : item.notes ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    fontSize: '0.86rem',
                    color: '#fbbf24',
                    fontStyle: 'italic',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    padding: '0.65rem 0.95rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span>
                    Personal note: &quot;{item.notes}&quot;
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBookmarkId(item.id);
                      setEditingNoteText(item.notes || '');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontStyle: 'normal',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                    title="تعديل الملاحظة"
                  >
                    <Edit3 size={13} />
                    <span>تعديل</span>
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBookmarkId(item.id);
                      setEditingNoteText('');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px dashed var(--border-subtle)',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Edit3 size={13} />
                    <span>+ إضافة ملاحظة شخصية (Add Note)</span>
                  </button>
                </div>
              )}

              {/* Footer CTA */}
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
                <span>Saved on {new Date(item.created_at).toLocaleDateString()}</span>

                {q.concept_id && (
                  <Link
                    href={`/practice/concept_practice/${q.concept_id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '0.35rem' }}
                  >
                    <span>Practice Topic</span>
                    <Play size={12} fill="currentColor" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
