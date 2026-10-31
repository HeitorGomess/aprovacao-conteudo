interface BrandLockupProps {
  className?: string;
  variant?: 'default' | 'light';
}

export default function BrandLockup({ className = '', variant = 'default' }: BrandLockupProps) {
  const classes = ['brand-lockup', `brand-lockup-${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 100 100" focusable="false">
          <path d="M29 27 50 53 71 27M50 53v25" />
          <circle cx="50" cy="24" r="7" />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name">Your Space</span>
        <span className="brand-tagline">Do planejamento à publicação.</span>
      </span>
    </div>
  );
}
