import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/ThemeContext';

export const metadata: Metadata = {
  title: 'OmniMed — Universal Medical Exams Platform',
  description: 'Production-ready platform for organizing, practicing, analyzing, and mastering medical board exams across all academic years, modules, subjects, chapters, and concepts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="dark light" />
        {/* Anti-FOUC Theme Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('omnimed_theme');
                const theme = storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
                const meta = document.querySelector('meta[name="color-scheme"]');
                if (meta) meta.setAttribute('content', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <Suspense fallback={<div style={{ height: '68px', background: 'var(--bg-glass)' }} />}>
            <Navbar />
          </Suspense>
          <main style={{ minHeight: 'calc(100vh - 68px)' }}>
            <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading medical portal...</div>}>
              {children}
            </Suspense>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
