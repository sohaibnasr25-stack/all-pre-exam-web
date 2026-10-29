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
  Home,
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

  // Condensed bottom nav for mobile (5 items max)
  const bottomNavLinks = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Exams', href: '/exams', icon: FileCheck2 },
    { label: 'Study', href: '/study', icon: BookOpen },
    { label: 'Concepts', href: '/repeated-concepts', icon: Sparkles },
    { label: 'Weakness', href: '/weakness-analysis', icon: TrendingDown },
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
            height: '60px',
          }}
        >
          {/* Brand Logo */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontWeight: 800,
              fontSize: '1.2rem',
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.4)',
              }}
            >
              <Stethoscope size={20} />
            </div>
            <span>
              Omni<span style={{ color: 'var(--cyan)' }}>Med</span>
            </span>
          </Link>

          {/* Desktop Nav Items with 3D Floating Effect */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginLeft: '1.25rem',
              flex: 1,
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
                  className={`nav-item-3d ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Action Controls: Storage Status, Search, Theme Toggle & Admin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Storage Mode Status & Switcher */}
            <StorageModeBadge />

            {/* Global Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.75rem',
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
              className={`nav-item-3d ${pathname.startsWith('/admin') ? 'active' : ''}`}
              style={{
                borderColor: pathname.startsWith('/admin') ? 'rgba(239, 68, 68, 0.6)' : undefined,
                color: pathname.startsWith('/admin') ? '#fb7185' : undefined,
              }}
              title="Admin &amp; Content Management Portal"
            >
              <ShieldAlert size={14} color="#ef4444" />
              <span className="admin-text">Admin</span>
            </Link>

            {/* Mobile Hamburger Toggle — only shown in tablet range before bottom nav kicks in */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-toggle"
              style={{
                display: 'none',
                padding: '0.45rem',
                color: 'var(--text-main)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
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
              padding: '0.85rem 1rem 1rem',
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
                  className={`nav-item-3d ${isActive ? 'active' : ''}`}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '0.7rem 1rem',
                    fontSize: '0.92rem',
                  }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`nav-item-3d ${pathname.startsWith('/admin') ? 'active' : ''}`}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                padding: '0.7rem 1rem',
                fontSize: '0.92rem',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#fb7185',
              }}
            >
              <ShieldAlert size={17} color="#ef4444" />
              <span>Admin Panel</span>
            </Link>
          </div>
        )}
      </header>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
      {!isPractice && (
        <nav className="mobile-bottom-nav" aria-label="Mobile bottom navigation">
          <div className="mobile-bottom-nav-inner">
            {bottomNavLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="mobile-nav-icon">
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {/* Search button in bottom nav */}
            <button
              className="mobile-nav-item"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <span className="mobile-nav-icon">
                <Search size={22} strokeWidth={1.8} />
              </span>
              <span>Search</span>
            </button>
          </div>
        </nav>
      )}

      {/* Global Search Dialog Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <style jsx>{`
        @media (max-width: 990px) {
          :global(.desktop-nav) {
            display: none !important;
          }
          :global(.mobile-toggle) {
            display: none !important;
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
