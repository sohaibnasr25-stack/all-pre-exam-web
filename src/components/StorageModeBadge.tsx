'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Database, Cloud, CheckCircle2, AlertTriangle, RefreshCw, HardDrive, Zap, ShieldCheck, DownloadCloud } from 'lucide-react';

interface StorageStatus {
  mode: 'auto' | 'local_only';
  auto_sync_enabled?: boolean;
  last_synced_at?: string;
  isSupabaseConfigured: boolean;
  isSupabaseReachable: boolean;
  activeSource: 'local' | 'supabase';
  latencyMs: number;
  stats: {
    questions: number;
    exams: number;
    academic_years: number;
    modules: number;
    subjects: number;
    chapters: number;
    concepts: number;
    attempts: number;
    bookmarks: number;
  };
}

export default function StorageModeBadge() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/system/storage-mode');
      const data = await res.json();
      if (data.success && data.data) {
        setStatus(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch storage status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleMode = async (newMode: 'auto' | 'local_only') => {
    setSwitchLoading(true);
    try {
      const res = await fetch('/api/system/storage-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to change storage mode:', err);
    } finally {
      setSwitchLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/system/sync', { method: 'POST' });
      const data = await res.json();
      if (data.message) {
        setSyncMessage(data.message);
      }
      if (data.status) {
        setStatus(data.status);
      }
    } catch {
      setSyncMessage('تعذرت المزامنة، يرجى التحقق من الاتصال بالإنترنت.');
    } finally {
      setSyncLoading(false);
    }
  };

  const isLocal = status?.mode === 'local_only' || status?.activeSource === 'local';

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        title={isLocal ? 'Local Database Active (Offline Safe & Fast)' : 'Cloud Storage Active (Resilient Fallback Enabled)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          background: isLocal ? 'rgba(16, 185, 129, 0.12)' : 'rgba(6, 182, 212, 0.12)',
          border: isLocal ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)',
          color: isLocal ? 'var(--success)' : 'var(--cyan)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        }}
      >
        {isLocal ? (
          <HardDrive size={14} className="text-emerald-500" />
        ) : (
          <Cloud size={14} className="text-cyan-400" />
        )}
        <span className="badge-text" style={{ whiteSpace: 'nowrap' }}>
          {status?.mode === 'local_only' ? 'Local DB' : 'Auto Cloud'}
        </span>
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isLocal ? '#10b981' : '#06b6d4',
            boxShadow: isLocal ? '0 0 6px #10b981' : '0 0 6px #06b6d4',
          }}
        />
      </button>

      {/* Popover Dropdown */}
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '335px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-highlight)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.2rem',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            animation: 'cardFadeIn 0.18s ease-out',
            color: 'var(--text-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.92rem' }}>
              <Database size={16} color="var(--primary)" />
              <span>Storage & Data Engine</span>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchStatus().finally(() => setLoading(false));
              }}
              title="Refresh connection status"
              style={{ color: 'var(--text-muted)', padding: '2px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1rem' }}>
            OmniMed operates with dual-layer storage: local JSON database provides zero-latency offline resilience, while Supabase provides cloud sync.
          </p>

          {/* Mode Selector */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            {/* Auto Mode Option */}
            <div
              onClick={() => handleToggleMode('auto')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: status?.mode === 'auto' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-surface-elevated)',
                border: status?.mode === 'auto' ? '1.5px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                cursor: switchLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Cloud size={16} color="#06b6d4" />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>Auto (Cloud + Fallback)</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Tries Supabase; fails over to Local DB if weak</div>
                </div>
              </div>
              {status?.mode === 'auto' && <CheckCircle2 size={16} color="#06b6d4" />}
            </div>

            {/* Local Only Option */}
            <div
              onClick={() => handleToggleMode('local_only')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: status?.mode === 'local_only' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-elevated)',
                border: status?.mode === 'local_only' ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                cursor: switchLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <HardDrive size={16} color="#10b981" />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>Local Database Only</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>100% offline, zero network latency</div>
                </div>
              </div>
              {status?.mode === 'local_only' && <CheckCircle2 size={16} color="#10b981" />}
            </div>
          </div>

          {/* Cloud Sync to Local Action Card */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                <DownloadCloud size={15} color="var(--cyan)" />
                <span>مزامنة التحديثات السحابية</span>
              </div>
              {status?.last_synced_at && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }} title={status.last_synced_at}>
                  آخر مزامنة: {new Date(status.last_synced_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              يقوم بتنزيل أي امتحانات أو أسئلة جديدة أُضيفت إلى السحابة وتخزينها في نسختك المحلية لتظل معك أوفلاين.
            </p>

            <button
              onClick={handleManualSync}
              disabled={syncLoading}
              className="btn btn-sm"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: 'rgba(6, 182, 212, 0.18)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                color: 'var(--cyan)',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '0.45rem 0.75rem',
                gap: '0.4rem',
              }}
            >
              <RefreshCw size={13} className={syncLoading ? 'animate-spin' : ''} />
              <span>{syncLoading ? 'جارٍ مزامنة وتنزيل البيانات...' : 'مزامنة وتنزيل أحدث الامتحانات الآن'}</span>
            </button>

            {syncMessage && (
              <div
                style={{
                  fontSize: '0.74rem',
                  color: syncMessage.includes('تعذرت') ? '#fb7185' : '#34d399',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  background: syncMessage.includes('تعذرت') ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                }}
              >
                {syncMessage}
              </div>
            )}
          </div>

          {/* Offline Advice for Local Mode */}
          {status?.mode === 'local_only' && (
            <div
              style={{
                fontSize: '0.74rem',
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.08)',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                lineHeight: 1.4,
                marginBottom: '1rem',
              }}
            >
              💡 <strong>أنت تعمل محلياً (أوفلاين):</strong> لضمان وصول الامتحانات المضافة حديثاً، اضغط على زر <strong>«مزامنة وتنزيل أحدث الامتحانات»</strong> أعلاه في أي وقت يتوفر فيه اتصال بالإنترنت.
            </div>
          )}

          {/* Current Diagnostic Status */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              fontSize: '0.78rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Data Engine:</span>
              <strong style={{ color: status?.activeSource === 'local' ? '#10b981' : '#06b6d4' }}>
                {status?.activeSource === 'local' ? 'Local JSON Storage' : 'Supabase Cloud'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Supabase Status:</span>
              <span>
                {status?.isSupabaseConfigured ? (
                  status.isSupabaseReachable ? (
                    <span style={{ color: '#10b981' }}>Connected ({status.latencyMs}ms)</span>
                  ) : (
                    <span style={{ color: '#f59e0b' }}>Unreachable (Failover active)</span>
                  )
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>Not configured (Local active)</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cached Dataset:</span>
              <span>{status?.stats ? `${status.stats.questions} questions, ${status.stats.exams} exams` : 'Loaded'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
