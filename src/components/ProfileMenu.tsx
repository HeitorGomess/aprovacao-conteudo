import { useEffect, useRef, useState } from 'react';

interface ProfileMenuProps {
  displayName: string;
  avatarUrl?: string;
  onOpenSettings: () => void;
  onManageCompany?: () => void;
  onSignOut: () => void;
}

export default function ProfileMenu({
  displayName,
  avatarUrl,
  onOpenSettings,
  onManageCompany,
  onSignOut,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        className="profile-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {avatarUrl ? (
          <img className="profile-menu-avatar" src={avatarUrl} alt="" decoding="async" />
        ) : (
          <span className="profile-menu-avatar profile-menu-avatar-fallback" aria-hidden="true">
            {displayName.slice(0, 1).toLocaleUpperCase('pt-BR') || 'P'}
          </span>
        )}
        <span>Perfil</span>
        <span className="profile-menu-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="profile-menu-popover" role="menu" aria-label="Menu do perfil">
          <div className="profile-menu-heading">
            <strong>{displayName}</strong>
            <span>Conta Your Space</span>
          </div>
          <button role="menuitem" onClick={() => run(onOpenSettings)} type="button">Configuração</button>
          {onManageCompany && (
            <button role="menuitem" onClick={() => run(onManageCompany)} type="button">Gerenciar empresa</button>
          )}
          <button className="profile-menu-logout" role="menuitem" onClick={() => run(onSignOut)} type="button">Sair</button>
        </div>
      )}
    </div>
  );
}
