interface BrandLockupProps {
  className?: string;
  variant?: 'default' | 'light';
}

export default function BrandLockup({ className = '', variant = 'default' }: BrandLockupProps) {
  const classes = ['brand-lockup', `brand-lockup-${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <span className="brand-mark" aria-hidden="true">YS</span>
      <span className="brand-copy">
        <span className="brand-name">Your Space</span>
        <span className="brand-tagline">Do planejamento à publicação.</span>
      </span>
    </div>
  );
}
