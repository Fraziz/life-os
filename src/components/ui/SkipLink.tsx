'use client';

/**
 * Skip-to-content link for keyboard accessibility.
 * Extracted as a Client Component because it uses CSS-in-JS inline style
 * toggling via onFocus/onBlur, which requires client-side event handlers.
 *
 * Alternatively, this can be done with pure CSS using :focus-within,
 * but the inline approach keeps layout.tsx free of a separate CSS file.
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: '-100%',
        left: 0,
        padding: '8px 16px',
        background: 'var(--color-accent)',
        color: 'white',
        fontWeight: 600,
        zIndex: 9999,
        borderRadius: '0 0 8px 0',
        transition: 'top 0.1s ease',
        fontSize: '14px',
      }}
      onFocus={(e) => { e.currentTarget.style.top = '0'; }}
      onBlur={(e)  => { e.currentTarget.style.top = '-100%'; }}
    >
      Skip to main content
    </a>
  );
}
