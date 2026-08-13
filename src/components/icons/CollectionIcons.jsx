import React from 'react';

/**
 * Custom SwapPulse collection icons — geometric, rounded, matching the
 * Midnight Vault design language.  All use currentColor so they inherit
 * text colour like lucide-react icons.
 */

export function ChecklistIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="2.5" width="6" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 12.5l2.2 2.2l4.3-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8.5" y1="17.5" x2="15.5" y2="17.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
    </svg>
  );
}

export function BinderIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8.5" y1="3" x2="8.5" y2="21" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.3" cy="8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6.3" cy="12" r="1.3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6.3" cy="16" r="1.3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="11.5" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <line x1="11.5" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <line x1="11.5" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
    </svg>
  );
}

export function PdfDocIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2h8l4 4v16a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="currentColor" fontFamily="sans-serif">PDF</text>
    </svg>
  );
}