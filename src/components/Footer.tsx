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
          <div className="premium-footer-socials" aria-label="Social Media Links">
            <a
              href="https://www.facebook.com/share/1Fz94zLcqD/"
              target="_blank"
              rel="noopener noreferrer"
              className="premium-social-link premium-social-fb"
              aria-label="Facebook — DR/SOHAIB NASR"
              title="Facebook"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V6.65c0-1.05.29-1.73 1.76-1.73Z" />
              </svg>
            </a>
            <a
              href="https://wa.me/201126712420"
              target="_blank"
              rel="noopener noreferrer"
              className="premium-social-link premium-social-wa"
              aria-label="WhatsApp — DR/SOHAIB NASR"
              title="WhatsApp"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.758.461 3.477 1.336 4.984L2 22l5.203-1.367a9.93 9.93 0 0 0 4.828 1.242h.004c5.516 0 9.969-4.453 9.969-9.969 0-2.664-1.039-5.168-2.926-7.051A9.913 9.913 0 0 0 12.031 2Zm5.82 14.172c-.246.691-1.434 1.32-1.988 1.402-.508.074-1.168.105-1.883-.121-.434-.137-.992-.324-1.703-.629-2.996-1.293-4.953-4.309-5.102-4.508-.148-.199-1.219-1.621-1.219-3.094 0-1.473.77-2.195 1.043-2.496.273-.301.598-.375.797-.375.199 0 .398.004.574.012.184.008.43-.07.672.512.246.598.844 2.066.918 2.215.074.148.125.324.023.523-.102.199-.148.324-.297.496-.148.172-.312.387-.445.52-.148.148-.305.309-.129.609.172.301.77 1.27 1.652 2.055 1.137 1.012 2.094 1.324 2.395 1.473.301.148.477.125.652-.074.176-.199.746-.871.945-1.172.199-.301.398-.25.672-.148.273.102 1.742.82 2.043.973.301.148.5.223.574.348.074.125.074.723-.172 1.414Z" />
              </svg>
            </a>
          </div>
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
