import { useState, type FormEvent } from 'react';
import BrandLockup from './BrandLockup';
import type { WorkspaceSummary } from '../features/content-approval/contentService';

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  canManage: boolean;
  isSystemAdmin?: boolean;
  onChange: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onManageTeam?: () => void;
  onRenameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  onArchiveWorkspace: (workspaceId: string) => Promise<void>;
  onRestoreWorkspace: (workspaceId: string) => Promise<void>;
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    return reason.message;
  }
  return 'Não foi possível concluir a ação na empresa. Tente novamente.';
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  canManage,
  isSystemAdmin = false,
  onChange,
  onCreateWorkspace,
  onManageTeam,
  onRenameWorkspace,
  onArchiveWorkspace,
  onRestoreWorkspace,
}: WorkspaceSwitcherProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [manageError, setManageError] = useState('');
  const [manageNotice, setManageNotice] = useState('');
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const archivedWorkspaces = workspaces.filter((workspace) => workspace.archivedAt);
  const canRestoreAny = isSystemAdmin
    || archivedWorkspaces.some((workspace) => workspace.isOwner || workspace.role === 'administrador');

  async function performManagementAction(action: () => Promise<void>, successMessage: string): Promise<boolean> {
    setPending(true);
    setManageError('');
    setManageNotice('');
    try {
      await action();
      setManageNotice(successMessage);
      return true;
    } catch (reason) {
      setManageError(getErrorMessage(reason));
      return false;
    } finally {
      setPending(false);
    }
  }

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
            {workspaces.filter((workspace) => !workspace.archivedAt).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
        </label>
        {canManage && onManageTeam && (
          <button className="button" onClick={onManageTeam} type="button">Equipe</button>
        )}
        {(canManage || canRestoreAny) && (
          <button
            className="button"
            onClick={() => {
              setNewWorkspaceName(activeWorkspace?.name || '');
              setManageError('');
              setManageNotice('');
              setManageOpen(true);
            }}
            type="button"
          >
            Gerenciar empresa
          </button>
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

      {manageOpen && (
        <div className="modal-backdrop workspace-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) setManageOpen(false);
        }}>
          <section className="workspace-modal workspace-manage-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-manage-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">EMPRESAS</p>
                <h2 id="workspace-manage-title">Gerenciar empresas</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar"
                disabled={pending}
                onClick={() => setManageOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="workspace-management-body">
              {canManage && activeWorkspace && (
                <section className="workspace-manage-current">
                  <h3>Empresa selecionada</h3>
                  <form onSubmit={(event) => {
                    event.preventDefault();
                    void performManagementAction(
                      () => onRenameWorkspace(activeWorkspace.id, newWorkspaceName),
                      'Nome da empresa atualizado.',
                    );
                  }}>
                    <label>
                      Nome da empresa
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                      />
                    </label>
                    <button className="button button-primary" disabled={pending || newWorkspaceName.trim().length < 2 || newWorkspaceName.trim() === activeWorkspace.name} type="submit">
                      Salvar nome
                    </button>
                  </form>
                  <div className="workspace-archive-action">
                    <p>Arquivar oculta a empresa, sem apagar publicações ou equipe. Ela poderá ser restaurada depois.</p>
                    <button
                      className="button button-danger"
                      disabled={pending || activeWorkspace.slug === 'your-space'}
                      onClick={() => {
                        if (!window.confirm(`Arquivar "${activeWorkspace.name}"? Os dados serão preservados e poderão ser restaurados.`)) return;
                        void performManagementAction(
                          () => onArchiveWorkspace(activeWorkspace.id),
                          'Empresa arquivada. Publicações e equipe foram preservadas.',
                        ).then((succeeded) => {
                          if (succeeded) setManageOpen(false);
                        });
                      }}
                      type="button"
                    >
                      Arquivar empresa
                    </button>
                  </div>
                  {activeWorkspace.slug === 'your-space' && (
                    <p className="muted">A empresa principal Your Space não pode ser arquivada.</p>
                  )}
                </section>
              )}

              {archivedWorkspaces.length > 0 && (
                <section className="workspace-archived-list">
                  <h3>Empresas arquivadas</h3>
                  {archivedWorkspaces.map((workspace) => {
                    const canRestore = isSystemAdmin || workspace.isOwner || workspace.role === 'administrador';
                    return (
                      <div className="workspace-archived-row" key={workspace.id}>
                        <div>
                          <strong>{workspace.name}</strong>
                          <span>Conteúdos e equipe preservados</span>
                        </div>
                        {canRestore && (
                          <button
                            className="button"
                            disabled={pending}
                            onClick={() => void performManagementAction(
                              () => onRestoreWorkspace(workspace.id),
                              `${workspace.name} foi restaurada.`,
                            )}
                            type="button"
                          >
                            Restaurar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
              {manageError && <p className="form-error" role="alert">{manageError}</p>}
              {manageNotice && <p className="notice workspace-success" role="status">{manageNotice}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

interface WorkspaceSetupPageProps {
  error: string;
  pending: boolean;
  archivedWorkspaces: WorkspaceSummary[];
  onCreate: (name: string) => Promise<void>;
  onRestoreWorkspace: (workspaceId: string) => Promise<void>;
  onLogout: () => void;
}

export function WorkspaceSetupPage({
  error,
  pending,
  archivedWorkspaces,
  onCreate,
  onRestoreWorkspace,
  onLogout,
}: WorkspaceSetupPageProps) {
  const [name, setName] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoringWorkspaceId, setRestoringWorkspaceId] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(name.trim());
  }

  async function restore(workspace: WorkspaceSummary) {
    setRestoringWorkspaceId(workspace.id);
    setRestoreError('');
    try {
      await onRestoreWorkspace(workspace.id);
    } catch (reason) {
      setRestoreError(getErrorMessage(reason));
    } finally {
      setRestoringWorkspaceId('');
    }
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
        {archivedWorkspaces.length > 0 && (
          <section className="workspace-archived-list workspace-onboarding-archived">
            <h2>Empresas arquivadas</h2>
            <p className="muted">Os dados dessas empresas continuam preservados.</p>
            {archivedWorkspaces.map((workspace) => (
              <div className="workspace-archived-row" key={workspace.id}>
                <strong>{workspace.name}</strong>
                <button
                  className="button"
                  disabled={restoringWorkspaceId !== ''}
                  onClick={() => void restore(workspace)}
                  type="button"
                >
                  {restoringWorkspaceId === workspace.id ? 'Restaurando…' : 'Restaurar'}
                </button>
              </div>
            ))}
            {restoreError && <p className="form-error" role="alert">{restoreError}</p>}
          </section>
        )}
      </section>
    </main>
  );
}
