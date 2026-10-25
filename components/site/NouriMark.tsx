/** Compact Nouri face used as the logo mark. */
export function NouriMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="30" rx="12" fill="#f4f8fd" />
      <rect x="5" y="5" width="30" height="22" rx="9" fill="#07101f" />
      <ellipse cx="14.5" cy="14.5" rx="3.2" ry="4" fill="#7ef4ff" />
      <ellipse cx="25.5" cy="14.5" rx="3.2" ry="4" fill="#7ef4ff" />
      <path d="M16.5 21q3.5 2.6 7 0" stroke="#7ef4ff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
