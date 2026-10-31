import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addWorkspaceMember,
  listWorkspaceMembers,
  setWorkspaceMemberRole,
  type WorkspaceRole,
  type EditorRole,
  type WorkspaceMember,
} from '../features/content-approval/contentService';

interface AdminDashboardProps {
  demoMode: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  onBack: () => void;
  onExitDemo: () => void;
}

const demoAccounts: WorkspaceMember[] = [
  { userId: 'demo-owner', email: 'admin@exemplo.com', role: 'administrador', isOwner: true },
  { userId: 'demo-programmer', email: 'programador@exemplo.com', role: 'programador', isOwner: false },
  { userId: 'demo-reviewer', email: 'revisor@exemplo.com', role: 'revisor', isOwner: false },
];

const roleLabels: Record<WorkspaceRole | 'sem_acesso', string> = {
  administrador: 'Administrador',
  programador: 'Programador',
  revisor: 'Revisor',
  sem_acesso: 'Sem acesso',
};

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    const message = reason.message;
    if (message.includes('Could not find the function') || message.includes('list_panel_accounts')) {
      return 'A função de gestão não está configurada neste projeto Supabase. Execute novamente o arquivo SUPABASE_SETUP.sql no SQL Editor do projeto conectado ao app.';
    }
    if (message.includes('structure of query does not match function result type')) {
      return 'A função de gestão no Supabase está com tipos de retorno incompatíveis. No SQL Editor, execute novamente a definição atualizada de list_panel_accounts do arquivo SUPABASE_SETUP.sql.';
    }
    if (message.includes('Somente administradores')) {
      return 'Esta sessão não está cadastrada como administradora no projeto Supabase conectado ao app.';
    }
    return message;
  }
  return 'Ocorreu um erro inesperado.';
}

export default function AdminDashboard({
  demoMode,
  workspaceId,
  workspaceName,
  workspaceSlug,
  onBack,
  onExitDemo,
}: AdminDashboardProps) {
  const [accounts, setAccounts] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<EditorRole | 'administrador'>('programador');

  const refreshAccounts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      setAccounts(demoMode ? demoAccounts : await listWorkspaceMembers(workspaceId));
    } catch (reason) {
      setError(`Não foi possível atualizar as contas: ${getErrorMessage(reason)}`);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [demoMode, workspaceId]);

  useEffect(() => {
    void refreshAccounts(true);
    if (demoMode) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshAccounts();
    };
    const intervalId = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [demoMode, refreshAccounts]);

  const visibleAccounts = useMemo(() => {
    const normalizedSearch = accountSearch.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedSearch) return accounts;
    return accounts.filter((account) => account.email.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  }, [accounts, accountSearch]);

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefreshing(true);
    setError('');
    try {
      if (demoMode) {
        setAccounts((current) => [
          ...current.filter((account) => account.email.toLowerCase() !== newMemberEmail.trim().toLowerCase()),
          {
            userId: `demo-${Date.now()}`,
            email: newMemberEmail.trim().toLowerCase(),
            role: newMemberRole,
            isOwner: false,
          },
        ]);
      } else {
        await addWorkspaceMember(workspaceId, newMemberEmail, newMemberRole);
        setAccounts(await listWorkspaceMembers(workspaceId));
      }
      setNewMemberEmail('');
    } catch (reason) {
      setError(`Não foi possível adicionar a conta: ${getErrorMessage(reason)}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function changeRole(userId: string, role: WorkspaceRole | 'sem_acesso') {
    setSavingUserId(userId);
    setError('');
    try {
      if (demoMode) {
        setAccounts((current) => role === 'sem_acesso'
          ? current.filter((account) => account.userId !== userId)
          : current.map((account) => account.userId === userId ? { ...account, role } : account));
      } else {
        await setWorkspaceMemberRole(workspaceId, userId, role);
        setAccounts(await listWorkspaceMembers(workspaceId));
      }
    } catch (reason) {
      setError(`Não foi possível atualizar o perfil: ${getErrorMessage(reason)}`);
    } finally {
      setSavingUserId('');
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">YS</div>
          <div>
            <p className="eyebrow">YOUR SPACE · MARKETING</p>
            <h1>Gerenciar equipe</h1>
          </div>
        </div>
        <button className="button" onClick={onBack} type="button">Voltar ao painel</button>
      </header>

      {demoMode && (
        <div className="notice demo-banner" role="status">
          <span>Modo demonstração: estas contas são fictícias e as alterações não são salvas.</span>
          <button className="button demo-exit-button" onClick={onExitDemo} type="button">
            Abrir gestão real
          </button>
        </div>
      )}

      <section className="admin-intro admin-intro-row">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO · {workspaceName}</p>
          <h2>Equipe e permissões</h2>
          <p>Adicione contas cadastradas e escolha o que cada pessoa pode fazer neste painel.</p>
        </div>
        {!demoMode && (
          <button
            className="button"
            disabled={refreshing || savingUserId !== ''}
            onClick={() => void refreshAccounts()}
            type="button"
          >
            {refreshing ? 'Atualizando…' : 'Atualizar contas'}
          </button>
        )}
      </section>

      <section className="permission-legend" aria-label="Descrição dos perfis">
        <article><strong>Administrador</strong><span>Gerencia a equipe, os cargos e todos os conteúdos desta empresa.</span></article>
        <article><strong>Programador</strong><span>Cria, importa, edita e exclui publicações.</span></article>
        <article><strong>Revisor</strong><span>Analisa as publicações em revisão e registra seu parecer. Não pode editar nem anexar arquivos.</span></article>
      </section>

      {error && <div className="notice" role="alert">{error}</div>}

      <form className="member-add-form" onSubmit={(event) => void addMember(event)}>
        <label>
          E-mail de uma conta já cadastrada
          <input
            autoComplete="email"
            required
            type="email"
            value={newMemberEmail}
            onChange={(event) => setNewMemberEmail(event.target.value)}
          />
        </label>
        <label>
          Cargo inicial
          <select value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value as EditorRole | 'administrador')}>
            <option value="programador">Programador</option>
            <option value="revisor">Revisor</option>
            <option value="administrador">Administrador</option>
          </select>
        </label>
        <button className="button button-primary" disabled={refreshing} type="submit">
          {refreshing ? 'Adicionando…' : 'Adicionar à equipe'}
        </button>
      </form>

      {loading ? (
        <div className="empty-state"><p>Carregando contas…</p></div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <h2>Ninguém na equipe ainda</h2>
          <p>Digite o e-mail de uma conta Your Space já cadastrada acima para adicioná-la a este painel.</p>
          <button
            className="button"
            disabled={refreshing}
            onClick={() => void refreshAccounts()}
            type="button"
          >
            {refreshing ? 'Atualizando…' : 'Atualizar lista de contas'}
          </button>
        </div>
      ) : (
        <>
          <div className="workspace-share-link">
            Link deste painel:
            <a href={`/aprovacao-conteudo/empresa/${workspaceSlug}`}>
              {window.location.origin}/aprovacao-conteudo/empresa/{workspaceSlug}
            </a>
          </div>
          <div className="account-tools">
            <label>
              <span className="sr-only">Buscar conta por e-mail</span>
              <input
                type="search"
                placeholder="Buscar conta por e-mail"
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
              />
            </label>
            <span className="muted">
              {visibleAccounts.length} de {accounts.length} contas
            </span>
          </div>
          {visibleAccounts.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhuma conta corresponde à busca</h2>
              <p>Confira o e-mail digitado ou limpe a busca para ver todas as contas.</p>
              <button className="button" onClick={() => setAccountSearch('')} type="button">Limpar busca</button>
            </div>
          ) : (
            <section className="account-list" aria-label="Contas cadastradas">
              <div className="account-list-heading">
                <span>Conta ({visibleAccounts.length})</span>
                <span>Perfil de acesso</span>
              </div>
              {visibleAccounts.map((account) => (
                <div className="account-row" key={account.userId}>
                  <div className="account-identity">
                    <span className="account-avatar" aria-hidden="true">{account.email.slice(0, 1).toUpperCase()}</span>
                    <span>{account.email}</span>
                  </div>
                  <div className="account-role">
                    {account.isOwner ? (
                      <span className="role-badge role-administrator">Proprietário · {roleLabels.administrador}</span>
                    ) : (
                      <select
                        aria-label={`Perfil de ${account.email}`}
                        disabled={savingUserId === account.userId}
                        value={account.role}
                        onChange={(event) => void changeRole(
                          account.userId,
                          event.target.value as WorkspaceRole | 'sem_acesso',
                        )}
                      >
                        <option value="sem_acesso">{roleLabels.sem_acesso}</option>
                        <option value="administrador">{roleLabels.administrador}</option>
                        <option value="programador">{roleLabels.programador}</option>
                        <option value="revisor">{roleLabels.revisor}</option>
                      </select>
                    )}
                    {savingUserId === account.userId && <span className="muted">Salvando…</span>}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
