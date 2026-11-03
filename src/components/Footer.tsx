'use client';

import React from 'react';

export default function PremiumFooter() {
  return (
    <footer
      className="premium-page-footer"
      role="contentinfo"
      aria-label="Site Credits and Islamic Reminder"
    >
      <div className="premium-footer-gold-line" aria-hidden="true" />
      <div className="premium-footer-container">
        {/* Developer Credit in English (LTR) */}
        <div className="premium-footer-credit" dir="ltr">
          <span className="premium-footer-label">DEVELOPED BY:</span>
          <span className="premium-footer-author">DR/SOHAIB NASR</span>
        </div>

        {/* Decorative Golden Star Divider (desktop/tablet) */}
        <div className="premium-footer-divider" aria-hidden="true">
          <span>✦</span>
        </div>

        {/* Religious Arabic Reminder (RTL) */}
        <div className="premium-footer-arabic" dir="rtl" lang="ar">
          (ولا تنسَ الصلاة على النبي ﷺ)
        </div>
      </div>
    </footer>
  );
}
