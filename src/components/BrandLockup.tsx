interface BrandLockupProps {
  className?: string;
  variant?: 'default' | 'light';
}

export default function BrandLockup({ className = '', variant = 'default' }: BrandLockupProps) {
  const classes = ['brand-lockup', `brand-lockup-${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <span className="brand-mark" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
      </span>
      <span className="brand-copy">
        <span className="brand-name">Space Social</span>
        <span className="brand-tagline">Do planejamento à publicação.</span>
      </span>
    </div>
  );
}
