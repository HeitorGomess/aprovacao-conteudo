import BrandLockup from './BrandLockup';
import ProfileMenu from './ProfileMenu';

interface PersonalDashboardProps {
  displayName: string;
  avatarUrl?: string;
  spaceName: string;
  error?: string;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export default function PersonalDashboard({
  displayName,
  avatarUrl,
  spaceName,
  error = '',
  onOpenSettings,
  onSignOut,
}: PersonalDashboardProps) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="workspace-header-main">
          <BrandLockup />
          <span className="personal-space-label">{spaceName}</span>
        </div>
        <div className="user-menu">
          <ProfileMenu
            displayName={displayName}
            avatarUrl={avatarUrl}
            onOpenSettings={onOpenSettings}
            onSignOut={onSignOut}
          />
        </div>
      </header>

      <section className="personal-dashboard">
        <p className="eyebrow">SEU ESPAÇO PESSOAL</p>
        <h1>{spaceName}</h1>
        {error ? (
          <div className="personal-dashboard-card">
            <p className="muted">{error}</p>
            <button className="button button-primary" onClick={() => window.location.reload()} type="button">
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="personal-dashboard-card">
            <h2>Seu espaço pessoal está pronto</h2>
            <p>
              Este espaço é seu ambiente de trabalho completo. Você pode começar a planejar conteúdos agora e participar de outras empresas quando quiser.
            </p>
            <button className="button personal-dashboard-settings" onClick={onOpenSettings} type="button">
              Configurar seu espaço
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
