import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import BrandLockup from './BrandLockup';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import {
  addWorkspaceMember,
  listWorkspaceMembers,
  setWorkspaceMemberRole,
  type WorkspaceMember,
  type WorkspaceRole,
  type WorkspaceSummary,
} from '../features/content-approval/contentService';

interface WorkspaceTeamDashboardProps {
  demoMode: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  canManage: boolean;
  isSystemAdmin: boolean;
  onChangeWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onRenameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  onArchiveWorkspace: (workspaceId: string) => Promise<void>;
  onRestoreWorkspace: (workspaceId: string) => Promise<void>;
  onBack: () => void;
  onExitDemo: () => void;
}

const demoMembers: WorkspaceMember[] = [
  { userId: 'demo-owner', email: 'admin@exemplo.com', role: 'administrador', isOwner: true },
  { userId: 'demo-programmer', email: 'programador@exemplo.com', role: 'programador', isOwner: false },
  { userId: 'demo-reviewer', email: 'revisor@exemplo.com', role: 'revisor', isOwner: false },
];

function getDemoMembers(workspaceId: string): WorkspaceMember[] {
  if (workspaceId === 'demo-workspace') return demoMembers;
  return [{
    userId: `${workspaceId}-owner`,
    email: 'admin@exemplo.com',
    role: 'administrador',
    isOwner: true,
  }];
}

const roleLabels: Record<WorkspaceRole, string> = {
  administrador: 'Administrador',
  programador: 'Programador',
  revisor: 'Revisor',
};

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    const message = reason.message;
    if (message.includes('Could not find the function') || message.includes('list_workspace_members')) {
      return 'A gestão de equipes não está configurada neste Supabase. Execute o arquivo completo SUPABASE_SETUP.sql no SQL Editor.';
    }
    return message;
  }
  return 'Ocorreu um erro inesperado.';
}

export default function WorkspaceTeamDashboard({
  demoMode,
  workspaceId,
  workspaceName,
  workspaces,
  activeWorkspaceId,
  canManage,
  isSystemAdmin,
  onChangeWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onArchiveWorkspace,
  onRestoreWorkspace,
  onBack,
  onExitDemo,
}: WorkspaceTeamDashboardProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('revisor');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshMembers = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      setMembers(demoMode ? getDemoMembers(workspaceId) : await listWorkspaceMembers(workspaceId));
    } catch (reason) {
      setError(`Não foi possível carregar a equipe: ${getErrorMessage(reason)}`);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [demoMode, workspaceId]);

  useEffect(() => {
    void refreshMembers(true);
    if (demoMode) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshMembers();
    };
    const intervalId = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [demoMode, refreshMembers]);

  const visibleMembers = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return normalized
      ? members.filter((member) => member.email.toLocaleLowerCase('pt-BR').includes(normalized))
      : members;
  }, [members, search]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setError('');
    setNotice('');
    try {
      if (!demoMode) await addWorkspaceMember(workspaceId, email, role);
      else if (!members.some((member) => member.email.toLowerCase() === email.trim().toLowerCase())) {
        setMembers((current) => [...current, {
          userId: `demo-${Date.now()}`,
          email: email.trim(),
          role,
          isOwner: false,
        }]);
      } else {
        throw new Error('Esta conta já está na equipe.');
      }
      if (!demoMode) await refreshMembers();
      setEmail('');
      setNotice('A pessoa foi adicionada à equipe desta empresa.');
    } catch (reason) {
      setError(`Não foi possível adicionar a pessoa: ${getErrorMessage(reason)}`);
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(member: WorkspaceMember, nextRole: WorkspaceRole | 'sem_acesso') {
    setSavingUserId(member.userId);
    setError('');
    setNotice('');
    try {
      if (!demoMode) await setWorkspaceMemberRole(workspaceId, member.userId, nextRole);
      setMembers((current) => nextRole === 'sem_acesso'
        ? current.filter((item) => item.userId !== member.userId)
        : current.map((item) => item.userId === member.userId ? { ...item, role: nextRole } : item));
      setNotice(nextRole === 'sem_acesso'
        ? 'A pessoa foi removida desta empresa; o acesso às outras empresas não foi alterado.'
        : 'Perfil atualizado somente nesta empresa.');
    } catch (reason) {
      setError(`Não foi possível atualizar o perfil: ${getErrorMessage(reason)}`);
    } finally {
      setSavingUserId('');
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar workspace-admin-topbar">
        <div className="workspace-admin-brand">
          <BrandLockup />
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            canManage={canManage}
            isSystemAdmin={isSystemAdmin}
            onChange={onChangeWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            onRenameWorkspace={onRenameWorkspace}
            onArchiveWorkspace={onArchiveWorkspace}
            onRestoreWorkspace={onRestoreWorkspace}
          />
        </div>
        <button className="button" onClick={onBack} type="button">Voltar à empresa</button>
      </header>

      {demoMode && (
        <div className="notice demo-banner" role="status">
          <span>Modo demonstração: alterações fictícias não são salvas.</span>
          <button className="button demo-exit-button" onClick={onExitDemo} type="button">Abrir gestão real</button>
        </div>
      )}

      <section className="admin-intro admin-intro-row">
        <div>
          <p className="eyebrow">EMPRESA</p>
          <h2>Equipe de {workspaceName}</h2>
          <p>Os perfis aqui valem apenas para esta empresa. A mesma pessoa pode ter outro perfil em outro painel.</p>
        </div>
        {!demoMode && (
          <button className="button" disabled={refreshing || adding || savingUserId !== ''} onClick={() => void refreshMembers()} type="button">
            {refreshing ? 'Atualizando…' : 'Atualizar equipe'}
          </button>
        )}
      </section>

      <section className="permission-legend" aria-label="Perfis da empresa">
        <article><strong>Administrador</strong><span>Gerencia a equipe e todos os conteúdos desta empresa.</span></article>
        <article><strong>Programador</strong><span>Cria, importa, edita e exclui conteúdos desta empresa.</span></article>
        <article><strong>Revisor</strong><span>Visualiza conteúdos em revisão, ajustes e aprovados e registra pareceres.</span></article>
      </section>

      <form className="workspace-member-form" onSubmit={(event) => void addMember(event)}>
        <label>
          E-mail da conta
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@empresa.com"
          />
        </label>
        <label>
          Perfil nesta empresa
          <select value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)}>
            <option value="revisor">Revisor</option>
            <option value="programador">Programador</option>
            <option value="administrador">Administrador</option>
          </select>
        </label>
        <button className="button button-primary" disabled={adding || email.trim() === ''} type="submit">
          {adding ? 'Adicionando…' : 'Adicionar à empresa'}
        </button>
        <p className="muted">A pessoa precisa criar a conta e confirmar o e-mail antes de ser adicionada.</p>
      </form>

      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="notice workspace-success" role="status">{notice}</div>}

      {loading ? (
        <div className="empty-state"><p>Carregando equipe…</p></div>
      ) : (
        <>
          <div className="account-tools">
            <label>
              <span className="sr-only">Buscar pessoa por e-mail</span>
              <input
                type="search"
                placeholder="Buscar pessoa por e-mail"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <span className="muted">{visibleMembers.length} de {members.length} pessoas</span>
          </div>
          <section className="account-list" aria-label={`Equipe de ${workspaceName}`}>
            <div className="account-list-heading">
              <span>Pessoa ({visibleMembers.length})</span>
              <span>Perfil nesta empresa</span>
            </div>
            {visibleMembers.map((member) => (
              <div className="account-row" key={member.userId}>
                <div className="account-identity">
                  <span className="account-avatar" aria-hidden="true">{member.email.slice(0, 1).toUpperCase()}</span>
                  <span>{member.email}{member.isOwner ? ' · Proprietário' : ''}</span>
                </div>
                <div className="account-role">
                  {member.isOwner ? (
                    <span className="role-badge">{roleLabels.administrador}</span>
                  ) : (
                    <select
                      aria-label={`Perfil de ${member.email} nesta empresa`}
                      disabled={savingUserId !== ''}
                      value={member.role}
                      onChange={(event) => void changeRole(member, event.target.value as WorkspaceRole | 'sem_acesso')}
                    >
                      <option value="administrador">Administrador</option>
                      <option value="programador">Programador</option>
                      <option value="revisor">Revisor</option>
                      <option value="sem_acesso">Remover desta empresa</option>
                    </select>
                  )}
                  {savingUserId === member.userId && <span className="muted">Salvando…</span>}
                </div>
              </div>
            ))}
            {visibleMembers.length === 0 && (
              <div className="empty-state"><p>Nenhuma pessoa corresponde à busca.</p></div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
