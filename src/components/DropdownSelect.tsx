import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  ariaLabel: string;
  className: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function DropdownSelect({
  ariaLabel,
  className,
  options,
  value,
  onChange,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);

  useEffect(() => {
    if (!open) return;

    optionRefs.current[selectedIndex]?.focus();
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open, selectedIndex]);

  function chooseOption(optionValue: string): void {
    onChange(optionValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    else return;

    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
  }

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={`header-dropdown ${className}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className="header-dropdown-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        type="button"
      >
        <span>{selectedOption?.label ?? ''}</span>
        <span className="header-dropdown-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="header-dropdown-menu" role="menu" aria-label={ariaLabel} onKeyDown={handleMenuKeyDown}>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => chooseOption(option.value)}
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value && <span className="header-dropdown-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
