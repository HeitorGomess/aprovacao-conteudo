import { useCallback, useEffect, useMemo, useState } from 'react';
import AccountAvatar from './AccountAvatar';
import BrandLockup from './BrandLockup';
import ThemeToggle from './ThemeToggle';
import {
  listPanelAccounts,
  setPanelAccountRole,
  type AccountRole,
  type EditorRole,
  type PanelAccount,
} from '../features/content-approval/contentService';

interface AdminDashboardProps {
  demoMode: boolean;
  onBack: () => void;
  onExitDemo: () => void;
}

const demoAccounts: PanelAccount[] = [
  { userId: 'demo-owner', email: 'admin@exemplo.com', role: 'administrador', isAdmin: true },
  { userId: 'demo-programmer', email: 'programador@exemplo.com', role: 'programador', isAdmin: false },
  { userId: 'demo-reviewer', email: 'revisor@exemplo.com', role: 'revisor', isAdmin: false },
  { userId: 'demo-no-access', email: 'convidado@exemplo.com', role: 'sem_acesso', isAdmin: false },
];

const roleLabels: Record<AccountRole, string> = {
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

export default function AdminDashboard({ demoMode, onBack, onExitDemo }: AdminDashboardProps) {
  const [accounts, setAccounts] = useState<PanelAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [accountSearch, setAccountSearch] = useState('');

  const refreshAccounts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      setAccounts(demoMode ? demoAccounts : await listPanelAccounts());
    } catch (reason) {
      setError(`Não foi possível atualizar as contas: ${getErrorMessage(reason)}`);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [demoMode]);

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

  async function changeRole(userId: string, role: EditorRole | 'sem_acesso') {
    setSavingUserId(userId);
    setError('');
    try {
      if (demoMode) {
        setAccounts((current) => current.map((account) =>
          account.userId === userId ? { ...account, role } : account,
        ));
      } else {
        await setPanelAccountRole(userId, role);
        setAccounts(await listPanelAccounts());
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
        <BrandLockup />
        <div className="user-menu">
          <ThemeToggle />
          <button className="button" onClick={onBack} type="button">Voltar ao painel</button>
        </div>
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
          <p className="eyebrow">EMPRESA SPACE SOCIAL</p>
          <h2>Acessos do Space Social</h2>
          <p>Defina o perfil das contas nesta empresa. Para gerenciar outras empresas, volte ao painel e abra a opção Equipe.</p>
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

      <section className="permission-legend" aria-label="Descrição dos perfis do Space Social">
        <article><strong>Programador</strong><span>Cria, importa, edita e exclui publicações no Space Social.</span></article>
        <article><strong>Revisor</strong><span>Analisa publicações em revisão e registra pareceres no Space Social.</span></article>
        <article><strong>Sem acesso</strong><span>Não tem acesso ao Space Social. O perfil em outras empresas não é alterado.</span></article>
      </section>

      {error && <div className="notice" role="alert">{error}</div>}

      {loading ? (
        <div className="empty-state"><p>Carregando contas…</p></div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <h2>Nenhuma conta encontrada</h2>
          <p>Não há contas registradas para listar. Novos cadastros aparecem automaticamente depois de serem criados; esta tela atualiza a lista ao voltar para a aba.</p>
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
                    <AccountAvatar email={account.email} avatarUrl={account.avatarUrl} />
                    <span>{account.email}</span>
                  </div>
                  <div className="account-role">
                    {account.isAdmin ? (
                      <span className="role-badge role-administrator">{roleLabels.administrador}</span>
                    ) : (
                      <select
                        aria-label={`Perfil de ${account.email}`}
                        disabled={savingUserId === account.userId}
                        value={account.role}
                        onChange={(event) => void changeRole(
                          account.userId,
                          event.target.value as EditorRole | 'sem_acesso',
                        )}
                      >
                        <option value="sem_acesso">{roleLabels.sem_acesso}</option>
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
