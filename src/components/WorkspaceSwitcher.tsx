import { useState, type FormEvent } from 'react';
import BrandLockup from './BrandLockup';
import type { WorkspaceSummary } from '../features/content-approval/contentService';

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  canManage: boolean;
  onChange: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onManageTeam: () => void;
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    return reason.message;
  }
  return 'Não foi possível criar a empresa. Tente novamente.';
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  canManage,
  onChange,
  onCreateWorkspace,
  onManageTeam,
}: WorkspaceSwitcherProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await onCreateWorkspace(name.trim());
      setName('');
      setCreateOpen(false);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="workspace-controls">
        <label>
          <span className="sr-only">Empresa ativa</span>
          <select
            className="workspace-select"
            value={activeWorkspaceId}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Trocar empresa"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
        </label>
        {canManage && (
          <button className="button" onClick={onManageTeam} type="button">Equipe</button>
        )}
        <button className="button button-primary workspace-create-button" onClick={() => {
          setError('');
          setCreateOpen(true);
        }} type="button">
          + Nova empresa
        </button>
      </div>

      {createOpen && (
        <div className="modal-backdrop workspace-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) setCreateOpen(false);
        }}>
          <section className="workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-create-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">NOVO ESPAÇO DE TRABALHO</p>
                <h2 id="workspace-create-title">Criar empresa</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar"
                disabled={pending}
                onClick={() => setCreateOpen(false)}
              >
                ×
              </button>
            </header>
            <form className="workspace-create-form" onSubmit={(event) => void submit(event)}>
              <p className="muted">A empresa terá conteúdos e equipe separados. Você será o administrador e poderá adicionar usuários cadastrados.</p>
              <label>
                Nome da empresa
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Minha Empresa"
                />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <footer className="modal-footer">
                <button className="button" disabled={pending} onClick={() => setCreateOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="button button-primary" disabled={pending || name.trim().length < 2} type="submit">
                  {pending ? 'Criando…' : 'Criar empresa'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

interface WorkspaceSetupPageProps {
  error: string;
  pending: boolean;
  onCreate: (name: string) => Promise<void>;
  onLogout: () => void;
}

export function WorkspaceSetupPage({ error, pending, onCreate, onLogout }: WorkspaceSetupPageProps) {
  const [name, setName] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(name.trim());
  }

  return (
    <main className="workspace-onboarding">
      <header className="marketing-nav">
        <BrandLockup />
        <button className="button" onClick={onLogout} type="button">Sair</button>
      </header>
      <section className="workspace-setup-card">
        <p className="eyebrow">SEU ESPAÇO DE TRABALHO</p>
        <h1>Crie o painel da sua empresa</h1>
        <p className="muted">Cada empresa tem conteúdo e equipe separados. Você será o administrador e poderá adicionar usuários cadastrados.</p>
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label>
            Nome da empresa
            <input
              autoFocus
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" disabled={pending || name.trim().length < 2} type="submit">
            {pending ? 'Criando painel…' : 'Criar painel'}
          </button>
        </form>
      </section>
    </main>
  );
}
