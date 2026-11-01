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
            <h2>Este espaço é só seu</h2>
            <p>
              Sua conta ainda não está vinculada a nenhuma empresa. Quando um administrador adicionar você à equipe,
              o painel da empresa ficará disponível aqui.
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
