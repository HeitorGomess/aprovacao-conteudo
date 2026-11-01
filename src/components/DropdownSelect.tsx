import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

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
  variant?: 'header' | 'field';
}

export default function DropdownSelect({
  ariaLabel,
  className,
  options,
  value,
  onChange,
  variant = 'header',
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);

  useLayoutEffect(() => {
    if (!open || variant !== 'field') return;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const menuHeight = Math.min(options.length * 41 + 16, 280);
      const menuWidth = Math.min(180, window.innerWidth - 16);
      const spaceBelow = window.innerHeight - bounds.bottom;
      const top = spaceBelow >= menuHeight + 8 || spaceBelow >= bounds.top
        ? bounds.bottom + 4
        : Math.max(8, bounds.top - menuHeight - 4);
      setMenuPosition({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - menuWidth - 8)),
        top,
        width: menuWidth,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, options.length, variant]);

  useEffect(() => {
    if (!open) return;

    optionRefs.current[selectedIndex]?.focus();
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
        && !menuRef.current?.contains(event.target)
      ) setOpen(false);
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
  const menu = open && (
    <div
      ref={menuRef}
      className={`header-dropdown-menu${variant === 'field' ? ' field-dropdown-menu' : ''}`}
      role="menu"
      aria-label={ariaLabel}
      onKeyDown={handleMenuKeyDown}
      style={variant === 'field' && menuPosition ? {
        position: 'fixed',
        left: menuPosition.left,
        top: menuPosition.top,
        width: menuPosition.width,
      } : undefined}
    >
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
  );

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
      {variant === 'field' && menuPosition ? createPortal(menu, document.body) : menu}
    </div>
  );
}
