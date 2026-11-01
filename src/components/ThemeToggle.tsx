import { useEffect, useRef, useState } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'your-space:theme';
const themeLabels: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
};

function readThemePreference(): ThemePreference {
  try {
    const preference = window.localStorage.getItem(THEME_STORAGE_KEY);
    return preference === 'light' || preference === 'dark' || preference === 'system'
      ? preference
      : 'light';
  } catch (error) {
    console.error('Não foi possível ler a preferência de tema salva.', error);
    return 'light';
  }
}

function syncThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (meta && background) meta.content = background;
}

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [systemIsDark, setSystemIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [open, setOpen] = useState(false);
  const [storageError, setStorageError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const transitionTimer = useRef<number | null>(null);
  const classes = ['theme-control', className].filter(Boolean).join(' ');
  const effectiveTheme =
    preference === 'dark' || (preference === 'system' && systemIsDark) ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = preference;
    syncThemeColor();

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event: MediaQueryListEvent) => {
      setSystemIsDark(event.matches);
      if (preference === 'system') syncThemeColor();
    };
    setSystemIsDark(systemTheme.matches);
    systemTheme.addEventListener('change', updateSystemTheme);
    return () => systemTheme.removeEventListener('change', updateSystemTheme);
  }, [preference]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);

  function chooseTheme(nextPreference: ThemePreference): void {
    const root = document.documentElement;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-transition');
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => {
        root.classList.remove('theme-transition');
        transitionTimer.current = null;
      }, 180);
    }

    if (nextPreference === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = nextPreference;
    syncThemeColor();
    setPreference(nextPreference);
    setStorageError('');

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
      setOpen(false);
    } catch (error) {
      console.error('Não foi possível salvar a preferência de tema.', error);
      setStorageError('A preferência não pôde ser salva neste navegador.');
      setOpen(true);
    }
  }

  return (
    <div className={classes} ref={menuRef}>
      <button
        className="theme-toggle-button"
        aria-label={`Tema: ${themeLabels[preference]}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        title={`Tema: ${themeLabels[preference]}`}
        type="button"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {effectiveTheme === 'dark' ? (
            <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Escolher tema">
          {(Object.keys(themeLabels) as ThemePreference[]).map((theme) => (
            <button
              key={theme}
              role="menuitemradio"
              aria-checked={preference === theme}
              onClick={() => chooseTheme(theme)}
              type="button"
            >
              <span>{themeLabels[theme]}</span>
              {preference === theme && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          {storageError && <p role="alert">{storageError}</p>}
        </div>
      )}
    </div>
  );
}
