'use client';

interface LogoProps {
  /** Show only the icon mark, not the wordmark */
  iconOnly?: boolean;
  /** Size in pixels for the icon mark */
  size?: number;
}

/**
 * Life OS logo mark.
 * The icon is a stylised "target with orbit" — representing
 * the philosophy of aiming at a dream and making it real.
 */
export default function Logo({ iconOnly = false, size = 32 }: LogoProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
      aria-label="Life OS"
    >
      {/* Icon mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer ring */}
        <circle cx="16" cy="16" r="14" stroke="url(#logo-gradient)" strokeWidth="1.5" />
        {/* Mid ring */}
        <circle cx="16" cy="16" r="9" stroke="url(#logo-gradient)" strokeWidth="1.5" strokeOpacity="0.6" />
        {/* Center dot */}
        <circle cx="16" cy="16" r="3.5" fill="url(#logo-gradient)" />
        {/* Orbit arc — top right */}
        <path
          d="M 22 6 A 14 14 0 0 1 28 14"
          stroke="url(#logo-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="logo-gradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a594ff" />
            <stop offset="1" stopColor="#5b4fe8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Wordmark */}
      {!iconOnly && (
        <span
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #e8e8f2 0%, #a594ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            whiteSpace: 'nowrap',
          }}
        >
          Life OS
        </span>
      )}
    </div>
  );
}
