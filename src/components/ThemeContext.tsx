'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setCurrentTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('omnimed_theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        setCurrentTheme(stored);
        applyTheme(stored);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme: Theme = prefersDark ? 'dark' : 'light';
        setCurrentTheme(initialTheme);
        applyTheme(initialTheme);
      }
    } catch {
      // Fallback
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'omnimed_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setCurrentTheme(e.newValue);
        applyTheme(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute('content', t);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('omnimed_theme', newTheme);
    } catch {
      // Storage blocked or quota
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
