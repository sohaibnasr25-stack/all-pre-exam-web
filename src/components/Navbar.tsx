'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Stethoscope,
  BookOpen,
  FileCheck2,
  Sparkles,
  Bookmark,
  TrendingDown,
  Search,
  ShieldAlert,
  Menu,
  X,
} from 'lucide-react';
import SearchModal from './SearchModal';
import ThemeToggle from './ThemeToggle';
import StorageModeBadge from './StorageModeBadge';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navLinks = [
    { label: 'Dashboard', href: '/', icon: Stethoscope },
    { label: 'Complete Exams', href: '/exams', icon: FileCheck2 },
    { label: 'Study by Subject', href: '/study', icon: BookOpen },
    { label: 'Repeated Concepts', href: '/repeated-concepts', icon: Sparkles },
    { label: 'Question Bank', href: '/bookmarks', icon: Bookmark },
    { label: 'Weakness Analysis', href: '/weakness-analysis', icon: TrendingDown },
  ];

  const isPractice = pathname.startsWith('/practice/');

  return (
    <>
      <header
        className={`site-header ${isPractice ? 'in-practice-session' : ''}`}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          transition: 'background-color 0.25s ease, border-color 0.25s ease',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '68px',
          }}
        >
          {/* Brand Logo */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.4)',
              }}
            >
              <Stethoscope size={22} />
            </div>
            <span>
              Omni<span style={{ color: 'var(--cyan)' }}>Med</span>
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            className="desktop-nav"
          >
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    color: isActive ? 'var(--cyan)' : 'var(--text-muted)',
                    background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Action Controls: Storage Status, Search, Theme Toggle & Admin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Storage Mode Status & Switcher */}
            <StorageModeBadge />

            {/* Global Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 0.85rem',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Search everything (Ctrl+K)"
            >
              <Search size={15} />
              <span className="search-text">Search...</span>
              <kbd
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 5px',
                  background: 'rgba(148, 163, 184, 0.15)',
                  borderRadius: '4px',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Dark / Light Theme Toggle */}
            <ThemeToggle />

            {/* Admin Portal Link */}
            <Link
              href="/admin"
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                border: pathname.startsWith('/admin') ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-subtle)',
                background: pathname.startsWith('/admin') ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-surface-elevated)',
                color: pathname.startsWith('/admin') ? '#ef4444' : 'var(--text-main)',
              }}
              title="Admin & Content Management Portal"
            >
              <ShieldAlert size={14} color="#ef4444" />
              <span className="admin-text">Admin</span>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-toggle"
              style={{
                display: 'none',
                padding: '0.5rem',
                color: 'var(--text-main)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
              }}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '1rem 1.5rem 1.5rem',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--cyan)' : 'var(--text-main)',
                    background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Global Search Dialog Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <style jsx>{`
        @media (max-width: 990px) {
          :global(.desktop-nav) {
            display: none !important;
          }
          :global(.mobile-toggle) {
            display: flex !important;
          }
          :global(.search-text) {
            display: none !important;
          }
          :global(.admin-text) {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          :global(.in-practice-session) {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
