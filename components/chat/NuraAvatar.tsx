/**
 * Nura, the site's AI assistant. "Nur" means light, so the avatar is a cream
 * four-point spark on brand cobalt. Mirrors AVATAR_SVG in lib/widget/entry.ts
 * (the embeddable widget can't import React components).
 */
export function NuraAvatar({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="20" cy="20" r="20" fill="#0047ab" />
      <path
        d="M20 8.5C21 15.5 24.5 19 31.5 20C24.5 21 21 24.5 20 31.5C19 24.5 15.5 21 8.5 20C15.5 19 19 15.5 20 8.5Z"
        fill="#f5ebe0"
      />
      <circle cx="29" cy="11" r="2.2" fill="#f5ebe0" />
    </svg>
  );
}
