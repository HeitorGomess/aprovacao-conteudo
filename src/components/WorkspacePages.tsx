import { useMemo, useState, type FormEvent } from 'react';
import type { WorkspaceSummary } from '../features/content-approval/contentService';

interface LandingPageProps {
  onLogin: () => void;
  onCreateAccount: () => void;
}

export function LandingPage({ onLogin, onCreateAccount }: LandingPageProps) {
  return (
    <main className="marketing-home">
      <header className="marketing-nav">
        <a className="auth-brand" href="/aprovacao-conteudo/" aria-label="YS Your Space">
          <span className="brand-mark" aria-hidden="true">YS</span>
          <span>Your Space</span>
        </a>
        <div>
          <button className="button" onClick={onLogin} type="button">Entrar</button>
          <button className="button button-primary" onClick={onCreateAccount} type="button">Criar painel da empresa</button>
        </div>
      </header>
      <section className="marketing-hero">
        <p className="auth-kicker"><span /> YOUR SPACE · WORKSPACE</p>
        <h1>O espaço de trabalho da sua equipe.</h1>
        <p>Planeje conteúdos, organize revisões e acompanhe aprovações em um painel privado para sua empresa.</p>
        <button className="button button-primary" onClick={onCreateAccount} type="button">
          Criar painel da empresa
        </button>
        <span className="marketing-note">Comece com sua conta. Convide sua equipe quando o painel estiver pronto.</span>
      </section>
      <footer className="marketing-footer">YS · YOUR SPACE</footer>
    </main>
  );
}

interface WorkspaceSetupProps {
  error: string;
  pending: boolean;
  onCreate: (name: string, slug: string) => Promise<void>;
  onLogout: () => void;
}

export function WorkspaceSetupPage({ error, pending, onCreate, onLogout }: WorkspaceSetupProps) {
  const [name, setName] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const slug = useMemo(() => slugInput
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48), [slugInput]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(name.trim(), slug);
  }

  return (
    <main className="workspace-onboarding">
      <header className="marketing-nav">
        <a className="auth-brand" href="/aprovacao-conteudo/" aria-label="YS Your Space">
          <span className="brand-mark" aria-hidden="true">YS</span><span>Your Space</span>
        </a>
        <button className="button" onClick={onLogout} type="button">Sair</button>
      </header>
      <section className="workspace-setup-card">
        <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>
        <h1>Crie o painel da sua empresa</h1>
        <p className="muted">O painel será privado para sua equipe. Você será o administrador e poderá adicionar membros e definir os cargos.</p>
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label>
            Nome da empresa
            <input autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Endereço do painel
            <input
              minLength={3}
              maxLength={48}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
            />
          </label>
          <p className="workspace-url-preview">
            {window.location.origin}/aprovacao-conteudo/empresa/{slug || 'nome-da-empresa'}
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" disabled={pending || slug.length < 3} type="submit">
            {pending ? 'Criando painel…' : 'Criar painel'}
          </button>
        </form>
      </section>
    </main>
  );
}

interface WorkspacePickerProps {
  workspaces: WorkspaceSummary[];
  onSelect: (slug: string) => void;
  onCreate: () => void;
  onLogout: () => void;
}

export function WorkspacePickerPage({ workspaces, onSelect, onCreate, onLogout }: WorkspacePickerProps) {
  return (
    <main className="workspace-onboarding">
      <header className="marketing-nav">
        <a className="auth-brand" href="/aprovacao-conteudo/" aria-label="YS Your Space">
          <span className="brand-mark" aria-hidden="true">YS</span><span>Your Space</span>
        </a>
        <button className="button" onClick={onLogout} type="button">Sair</button>
      </header>
      <section className="workspace-picker-card">
        <p className="eyebrow">BEM-VINDO AO YOUR SPACE</p>
        <h1>Escolha um painel</h1>
        <p className="muted">Cada empresa tem seu próprio espaço, equipe e conteúdo.</p>
        <div className="workspace-picker-list">
          {workspaces.map((workspace) => (
            <button className="workspace-picker-item" key={workspace.id} onClick={() => onSelect(workspace.slug)} type="button">
              <span><strong>{workspace.name}</strong><small>{workspace.slug}</small></span>
              <span className="role-badge">{workspace.role === 'administrador' ? 'Administrador' : workspace.role === 'programador' ? 'Programador' : 'Revisor'}</span>
            </button>
          ))}
        </div>
        <button className="button button-primary" onClick={onCreate} type="button">+ Criar outro painel</button>
      </section>
    </main>
  );
}
