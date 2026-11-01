import { useState, type FormEvent } from 'react';
import BrandLockup from './BrandLockup';
import DeleteArchivedWorkspaceDialog from './DeleteArchivedWorkspaceDialog';
import type { WorkspaceSummary } from '../features/content-approval/contentService';

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    return reason.message;
  }
  return 'Ocorreu um erro inesperado.';
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  canManage: boolean;
  canCreateWorkspace?: boolean;
  onChange: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onManageTeam?: () => void;
}

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  canManage,
  canCreateWorkspace = true,
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
            {workspaces.filter((workspace) => !workspace.archivedAt).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}{workspace.isPersonal ? ' · Pessoal' : ''}
              </option>
            ))}
          </select>
        </label>
        {canManage && onManageTeam && (
          <button className="button" onClick={onManageTeam} type="button">Gerenciar empresa</button>
        )}
        {canCreateWorkspace && (
          <button className="button button-primary workspace-create-button" onClick={() => {
            setError('');
            setCreateOpen(true);
          }} type="button">
            + Nova empresa
          </button>
        )}
      </div>

      {createOpen && canCreateWorkspace && (
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
  archivedWorkspaces: WorkspaceSummary[];
  onCreate: (name: string) => Promise<void>;
  onRestoreWorkspace: (workspaceId: string) => Promise<void>;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onLogout: () => void;
}

export function WorkspaceSetupPage({
  error,
  pending,
  archivedWorkspaces,
  onCreate,
  onRestoreWorkspace,
  onDeleteWorkspace,
  onLogout,
}: WorkspaceSetupPageProps) {
  const [name, setName] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoringWorkspaceId, setRestoringWorkspaceId] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceSummary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState('');

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

  async function deleteArchivedWorkspace() {
    if (!workspaceToDelete) return;
    setDeletingWorkspaceId(workspaceToDelete.id);
    setDeleteError('');
    setDeleteNotice('');
    try {
      await onDeleteWorkspace(workspaceToDelete.id);
      setDeleteNotice(`${workspaceToDelete.name} foi excluída permanentemente.`);
      setWorkspaceToDelete(null);
    } catch (reason) {
      setDeleteError(getErrorMessage(reason));
    } finally {
      setDeletingWorkspaceId('');
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
                <div className="workspace-archived-actions">
                  <button
                    className="button"
                    disabled={restoringWorkspaceId !== '' || deletingWorkspaceId !== ''}
                    onClick={() => void restore(workspace)}
                    type="button"
                  >
                    {restoringWorkspaceId === workspace.id ? 'Restaurando…' : 'Restaurar'}
                  </button>
                  <button
                    className="button button-danger"
                    disabled={restoringWorkspaceId !== '' || deletingWorkspaceId !== ''}
                    onClick={() => {
                      setDeleteError('');
                      setWorkspaceToDelete(workspace);
                    }}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {restoreError && <p className="form-error" role="alert">{restoreError}</p>}
            {deleteNotice && <p className="notice workspace-success" role="status">{deleteNotice}</p>}
          </section>
        )}
      </section>
      {workspaceToDelete && (
        <DeleteArchivedWorkspaceDialog
          workspaceName={workspaceToDelete.name}
          pending={deletingWorkspaceId === workspaceToDelete.id}
          error={deleteError}
          onClose={() => {
            setWorkspaceToDelete(null);
            setDeleteError('');
          }}
          onConfirm={() => void deleteArchivedWorkspace()}
        />
      )}
    </main>
  );
}
