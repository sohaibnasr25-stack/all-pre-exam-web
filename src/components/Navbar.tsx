'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { getOrCreateStudentId } from '@/lib/studentClient';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isWide, setIsWide] = useState(true);

  const headerRef = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const navListRef = useRef<HTMLUListElement | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const lastCollapsedWidthRef = useRef<number>(0);

  const navLinks = [
    { label: 'Dashboard', href: '/', icon: Stethoscope },
    { label: 'Complete Exams', href: '/exams', icon: FileCheck2 },
    { label: 'Study by Subject', href: '/study', icon: BookOpen },
    { label: 'Repeated Concepts', href: '/repeated-concepts', icon: Sparkles },
    { label: 'Question Bank', href: '/bookmarks', icon: Bookmark },
    { label: 'Weakness Analysis', href: '/weakness-analysis', icon: TrendingDown },
  ];

  // Condensed bottom nav for mobile (5 items + search)
  const bottomNavLinks = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Exams', href: '/exams', icon: FileCheck2 },
    { label: 'Study', href: '/study', icon: BookOpen },
    { label: 'Concepts', href: '/repeated-concepts', icon: Sparkles },
    { label: 'Weakness', href: '/weakness-analysis', icon: TrendingDown },
  ];

  // Dynamically measure whether the inline navigation row fits without horizontal overflow.
  // Follows modern-web-guidance: measure with is-measuring (transition: none) & ResizeObserver.
  const checkNavFit = useCallback((forceMeasure = false) => {
    const header = headerRef.current;
    const inner = innerRef.current;
    if (!header || !inner) return;

    // Below 990px, mobile bottom nav handles primary links
    if (window.innerWidth <= 990) {
      setIsWide(false);
      setMobileMenuOpen(false);
      return;
    }

    const currentWidth = header.clientWidth;
    // While collapsed, only remeasure when the header grows (prevents layout thrashing on shrink)
    if (!forceMeasure && !header.classList.contains('is-wide') && currentWidth <= lastCollapsedWidthRef.current) {
      return;
    }

    header.classList.add('is-measuring');
    header.classList.add('is-wide');

    // Compare scrollWidth against clientWidth AND verify physical clearance between nav & actions
    let fits = inner.scrollWidth <= inner.clientWidth + 1;
    if (fits && navRef.current && actionsRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const actionsRect = actionsRef.current.getBoundingClientRect();
      if (navRect.width > 0 && actionsRect.width > 0 && navRect.right > actionsRect.left - 2) {
        fits = false;
      }
    }

    if (!fits) {
      header.classList.remove('is-wide');
      lastCollapsedWidthRef.current = currentWidth;
    } else {
      lastCollapsedWidthRef.current = 0;
    }

    setIsWide(fits);
    if (fits) setMobileMenuOpen(false);

    requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
    });
  }, []);

  useEffect(() => {
    getOrCreateStudentId();
    checkNavFit(true);

    const header = headerRef.current;
    const inner = innerRef.current;
    const navList = navListRef.current;
    const actions = actionsRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      checkNavFit(false);
    });
    ro.observe(header);
    if (inner) ro.observe(inner);
    if (navList) ro.observe(navList);
    if (actions) ro.observe(actions);

    const handleResize = () => checkNavFit(true);
    window.addEventListener('resize', handleResize);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => checkNavFit(true)).catch(() => {});
    }

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [checkNavFit]);

  // Close collapsed dropdown on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const isPractice = pathname.startsWith('/practice/');

  return (
    <>
      <header
        ref={headerRef}
        className={`site-header ${isWide ? 'is-wide' : ''} ${isPractice ? 'in-practice-session' : ''}`}
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
        <div ref={innerRef} className="navbar-inner">
          {/* Brand Logo */}
          <Link
            href="/"
            className="navbar-brand"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <div
              className="navbar-brand-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
                flexShrink: 0,
              }}
            >
              <Stethoscope size={18} aria-hidden="true" />
            </div>
            <span className="navbar-brand-text">
              Omni<span style={{ color: 'var(--cyan)' }}>Med</span>
            </span>
          </Link>

          {/* Primary Navigation (single semantic <nav> landmark) */}
          <nav ref={navRef} className="desktop-nav" aria-label="Primary">
            <ul ref={navListRef} className="desktop-nav-list">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`nav-item-3d ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Action Controls: Storage Status, Search, Theme Toggle, Admin & Overflow Menu Trigger */}
          <div ref={actionsRef} className="navbar-actions">
            {/* Storage Mode Status & Switcher */}
            <StorageModeBadge />

            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="navbar-search-btn"
              aria-label="Search questions and concepts"
              title="Search everything (Ctrl+K)"
            >
              <Search size={14} aria-hidden="true" />
              <span className="search-text">Search...</span>
              <kbd className="search-kbd">⌘K</kbd>
            </button>

            {/* Dark / Light Theme Toggle */}
            <ThemeToggle />

            {/* Admin Portal Link */}
            <Link
              href="/admin"
              aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
              aria-label="Admin & Content Management Portal"
              className={`nav-item-3d navbar-admin-btn ${pathname.startsWith('/admin') ? 'active' : ''}`}
              style={{
                borderColor: pathname.startsWith('/admin') ? 'rgba(239, 68, 68, 0.6)' : undefined,
                color: pathname.startsWith('/admin') ? '#fb7185' : undefined,
              }}
              title="Admin & Content Management Portal"
            >
              <ShieldAlert size={14} color="#ef4444" aria-hidden="true" />
              <span className="admin-text">Admin</span>
            </Link>

            {/* Overflow Menu Toggle — automatically appears when inline desktop nav can't fit */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="navbar-overflow-toggle"
              aria-expanded={mobileMenuOpen}
              aria-controls="site-overflow-menu"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
              <span className="overflow-toggle-label">Menu</span>
            </button>
          </div>
        </div>

        {/* Overflow Dropdown Menu (only when desktop inline row collapses due to narrow width/zoom) */}
        {mobileMenuOpen && (
          <div
            id="site-overflow-menu"
            className="navbar-overflow-dropdown"
            role="region"
            aria-label="Navigation menu"
          >
            <div className="navbar-overflow-dropdown-grid">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-item-3d ${isActive ? 'active' : ''}`}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
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
                  aria-current={isActive ? 'page' : undefined}
                  className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="mobile-nav-icon">
                    <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {/* Search button in bottom nav */}
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <span className="mobile-nav-icon">
                <Search size={21} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span>Search</span>
            </button>
          </div>
        </nav>
      )}

      {/* Global Search Dialog Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
