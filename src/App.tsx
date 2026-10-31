import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AdminDashboard from './components/AdminDashboard';
import BrandLockup from './components/BrandLockup';
import ContentCard from './components/ContentCard';
import ContentForm from './components/ContentForm';
import LoginForm from './components/LoginForm';
import ReviewCard from './components/ReviewCard';
import ReviewDecisionModal from './components/ReviewDecisionModal';
import WorkspaceSwitcher, { WorkspaceSetupPage } from './components/WorkspaceSwitcher';
import WorkspaceTeamDashboard from './components/WorkspaceTeamDashboard';
import {
  createWorkspace,
  deleteContent,
  fetchContents,
  listUserWorkspaces,
  saveContent,
  saveContents,
  resetReviewComments,
  submitReviewDecision,
  subscribeToContents,
  supabase,
  verifyPanelAdmin,
  type EditorRole,
  type WorkspaceRole,
  type WorkspaceSummary,
} from './features/content-approval/contentService';
import { createMockContents } from './features/content-approval/mockData';
import { importContentCsv } from './features/content-approval/csvImport';
import { getChannelLabel } from './features/content-approval/contentLabels';
import type { Content, ContentFormData, ContentStatus, ReviewComment } from './features/content-approval/types';

type ViewMode = 'cards' | 'calendar' | 'table';

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

const statuses = Object.keys(statusLabels) as ContentStatus[];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    return [error.message, details, hint].filter(Boolean).join(' ');
  }
  return 'Ocorreu um erro inesperado.';
}

function localMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getAdminDashboardUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('admin', '1');
  return url.toString();
}

function getWorkspaceTeamUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('team', '1');
  return url.toString();
}

function updateWorkspaceUrl(slug: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', slug);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.sessionStorage.setItem('activeWorkspaceSlug', slug);
}

function App() {
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
  const demoRoleParam = new URLSearchParams(window.location.search).get('role');
  const demoRole: EditorRole | 'administrador' = demoRoleParam === 'revisor'
    ? 'revisor'
    : demoRoleParam === 'admin'
      ? 'administrador'
      : 'programador';
  const adminView = new URLSearchParams(window.location.search).get('admin') === '1';
  const teamView = new URLSearchParams(window.location.search).get('team') === '1';
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  const [accessCheckError, setAccessCheckError] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(!demoMode);
  const [workspaceError, setWorkspaceError] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [signupConfirmationNotice, setSignupConfirmationNotice] = useState(false);
  const [contents, setContents] = useState<Content[]>(() => demoMode ? createMockContents() : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | ''>('');
  const [channelFilter, setChannelFilter] = useState('');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);
  const [importing, setImporting] = useState(false);
  const [reviewing, setReviewing] = useState<Content | null>(null);
  const authUserId = useRef<string | null>(null);
  const signupConfirmationRedirect = useRef(
    new URLSearchParams(window.location.search).get('auth') === 'confirmed'
      || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'signup',
  );

  useEffect(() => {
    if (demoMode) {
      const demoWorkspace: WorkspaceSummary = {
        id: 'demo-workspace',
        name: 'Your Space',
        slug: 'your-space',
        role: demoRole === 'administrador' ? 'administrador' : demoRole,
        isOwner: demoRole === 'administrador',
      };
      setWorkspaces([demoWorkspace]);
      setActiveWorkspace(demoWorkspace);
      setRole(demoWorkspace.role);
      setIsAdmin(demoRole === 'administrador');
      setIsSystemAdmin(demoRole === 'administrador');
      setAccessUserId('demo');
      setWorkspaceLoading(false);
      setAuthLoading(false);
      return;
    }

    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        const confirmingSignup = event === 'SIGNED_IN' && signupConfirmationRedirect.current;
        const nextUserId = nextSession?.user.id ?? null;
        if (authUserId.current !== nextUserId) {
          authUserId.current = nextUserId;
          setRole(null);
          setIsAdmin(false);
          setIsSystemAdmin(false);
          setAccessUserId(null);
          setAccessCheckError('');
          setWorkspaces([]);
          setActiveWorkspace(null);
          setWorkspaceError('');
          setWorkspaceLoading(Boolean(nextSession));
          setLoading(Boolean(nextSession));
        }
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') setPasswordRecovery(false);
        setSession(nextSession);
        setAuthError('');
        if (confirmingSignup) setAuthLoading(true);
        else setAuthLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setAuthError(sessionError.message);
      const nextUserId = data.session?.user.id ?? null;
      if (authUserId.current !== nextUserId) {
        authUserId.current = nextUserId;
        setRole(null);
        setIsAdmin(false);
        setIsSystemAdmin(false);
        setAccessUserId(null);
        setAccessCheckError('');
        setWorkspaces([]);
        setActiveWorkspace(null);
        setWorkspaceError('');
        setWorkspaceLoading(Boolean(data.session));
        setLoading(Boolean(data.session));
      }
      setSession(data.session);
      if (signupConfirmationRedirect.current && !data.session) {
        signupConfirmationRedirect.current = false;
        setSignupConfirmationNotice(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('auth');
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      }
      if (!(signupConfirmationRedirect.current && data.session)) setAuthLoading(false);
    }).catch((reason: unknown) => {
      if (active) {
        setAuthError(getErrorMessage(reason));
        setAuthLoading(false);
        setWorkspaceLoading(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [demoMode]);

  useEffect(() => {
    if (demoMode || !session || !signupConfirmationRedirect.current) return;

    signupConfirmationRedirect.current = false;
    setPasswordRecovery(false);
    setAuthLoading(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    url.hash = '';
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);

    void supabase.auth.signOut({ scope: 'local' }).then(({ error: signOutError }) => {
      if (signOutError) throw signOutError;
      setSession(null);
      setRole(null);
      setIsAdmin(false);
      setIsSystemAdmin(false);
      setAccessUserId(null);
      setSignupConfirmationNotice(true);
    }).catch((reason: unknown) => {
      setAuthError(`E-mail confirmado, mas não foi possível voltar ao login: ${getErrorMessage(reason)}`);
      setSession(null);
    }).finally(() => {
      setAuthLoading(false);
    });
  }, [demoMode, session]);

  useEffect(() => {
    if (demoMode) return;
    if (!session) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setWorkspaceLoading(false);
      setLoading(false);
      return;
    }

    let active = true;
    const userId = session.user.id;
    setWorkspaceLoading(true);
    setWorkspaceError('');
    setAccessCheckError('');

    async function loadUserWorkspaces() {
      try {
        const [workspaceResult, adminResult] = await Promise.all([
          listUserWorkspaces(),
          verifyPanelAdmin(userId),
        ]);
        if (!active) return;
        const urlSlug = new URLSearchParams(window.location.search).get('workspace');
        const savedSlug = window.sessionStorage.getItem('activeWorkspaceSlug');
        const selected = urlSlug
          ? workspaceResult.find((workspace) => workspace.slug === urlSlug)
          : workspaceResult.find((workspace) => workspace.slug === savedSlug) || workspaceResult[0];
        if (urlSlug && !selected) {
          throw new Error('Sua conta não tem acesso à empresa selecionada. Selecione uma empresa disponível ou peça um convite ao administrador.');
        }
        setWorkspaces(workspaceResult);
        setIsSystemAdmin(adminResult);
        setActiveWorkspace(selected || null);
        setRole(selected?.role || null);
        setIsAdmin(selected?.role === 'administrador' || adminResult);
        setAccessUserId(userId);
        setAccessCheckError('');
        if (selected) updateWorkspaceUrl(selected.slug);
        setContents([]);
      } catch (reason) {
        if (!active) return;
        const message = getErrorMessage(reason);
        setWorkspaceError(`Não foi possível carregar suas empresas: ${message}`);
        setAccessCheckError(message);
        setAccessUserId(userId);
      } finally {
        if (active) setWorkspaceLoading(false);
      }
    }
    void loadUserWorkspaces();

    return () => {
      active = false;
    };
  }, [demoMode, session?.user.id]);

  useEffect(() => {
    if (demoMode || !session) {
      setLoading(false);
      return;
    }
    if (!activeWorkspace || adminView || teamView) {
      setContents([]);
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError('');
    fetchContents(activeWorkspace.id)
      .then((loadedContents) => {
        if (!active) return;
        setContents(loadedContents);
        unsubscribe = subscribeToContents(
          activeWorkspace.id,
          setContents,
          (reason) => setError(`Problema na sincronização: ${getErrorMessage(reason)}`),
        );
      })
      .catch((reason: unknown) => {
        if (active) setError(`Não foi possível carregar os conteúdos: ${getErrorMessage(reason)}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [activeWorkspace?.id, adminView, demoMode, session, teamView]);

  const monthContents = useMemo(
    () => contents.filter((content) => content.date.startsWith(localMonthKey(month))),
    [contents, month],
  );
  const channels = useMemo(
    () => Array.from(new Set(contents.map((content) => content.channel).filter(Boolean))).sort(),
    [contents],
  );
  const visibleContents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return monthContents.filter((content) => {
      if (statusFilter && content.status !== statusFilter) return false;
      if (channelFilter && content.channel !== channelFilter) return false;
      return !normalizedQuery || `${content.title} ${content.caption}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
    }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'));
  }, [monthContents, statusFilter, channelFilter, query]);

  async function handleLogin(email: string, password: string) {
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) throw new Error(`Não foi possível entrar: ${loginError.message}`);
  }

  async function handleSignUp(email: string, password: string): Promise<string> {
    const confirmationUrl = new URL(window.location.pathname, window.location.origin);
    confirmationUrl.searchParams.set('auth', 'confirmed');
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmationUrl.toString() },
    });
    if (signUpError) throw new Error(`Não foi possível criar a conta: ${signUpError.message}`);
    return 'Conta criada. Confirme seu e-mail para criar uma empresa ou pedir para ser adicionado a uma equipe.';
  }

  async function handlePasswordReset(email: string): Promise<string> {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    if (resetError) throw new Error(`Não foi possível enviar o link: ${resetError.message}`);
    return 'Se existir uma conta para este e-mail, você receberá um link para redefinir a senha.';
  }

  async function handlePasswordUpdate(password: string) {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw new Error(`Não foi possível atualizar a senha: ${updateError.message}`);
  }

  async function handleLogout() {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) setError(`Não foi possível sair: ${logoutError.message}`);
  }

  function openNewContent() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEditContent(content: Content) {
    setEditing(content);
    setFormOpen(true);
  }

  async function handleSave(data: ContentFormData) {
    const now = new Date().toISOString();
    const statusChanged = editing && editing.status !== data.status;
    const content: Content = editing
      ? {
          ...editing,
          ...data,
          updatedAt: now,
          history: statusChanged
            ? [...editing.history.slice(-19), { status: data.status, at: now }]
            : editing.history,
        }
      : {
          ...data,
          id: crypto.randomUUID(),
          updatedAt: now,
          history: [{ status: data.status, at: now }],
        };

    if (!demoMode) {
      if (!activeWorkspace) throw new Error('Selecione uma empresa antes de salvar o conteúdo.');
      await saveContent(activeWorkspace.id, content);
    }
    setContents((current) => {
      const index = current.findIndex((item) => item.id === content.id);
      if (index < 0) return [...current, content];
      return current.map((item) => item.id === content.id ? content : item);
    });
    const [year, selectedMonth] = data.date.split('-').map(Number);
    setMonth(new Date(year, selectedMonth - 1, 1));
    setFormOpen(false);
    setEditing(null);
    setError('');
  }

  async function handleDelete(content: Content) {
    if (!demoMode) {
      if (!activeWorkspace) throw new Error('Selecione uma empresa antes de excluir o conteúdo.');
      await deleteContent(activeWorkspace.id, content.id);
    }
    setContents((current) => current.filter((item) => item.id !== content.id));
    setFormOpen(false);
    setEditing(null);
  }

  async function handleResetReviewComments(content: Content) {
    if (!demoMode) {
      if (!activeWorkspace) throw new Error('Selecione uma empresa antes de resetar os pareceres.');
      await resetReviewComments(activeWorkspace.id, content.id);
    }
    const updated = { ...content, reviewComments: undefined, updatedAt: new Date().toISOString() };
    setContents((current) => current.map((item) => item.id === content.id ? updated : item));
    setEditing(updated);
    setError('');
  }

  async function handleReviewDecision(
    content: Content,
    status: Extract<ContentStatus, 'aprovado' | 'ajustes'>,
    comment: string,
  ) {
    const now = new Date().toISOString();
    const normalizedComment = comment.trim();
    const reviewComment: ReviewComment = {
      at: now,
      author: demoMode ? 'Revisor de demonstração' : session?.user.email || 'Revisor',
      comment: normalizedComment,
      decision: status,
    };
    const updated: Content = {
      ...content,
      status,
      updatedAt: now,
      history: [...content.history.slice(-19), { status, at: now }],
      reviewComments: normalizedComment
        ? [...(content.reviewComments || []), reviewComment]
        : content.reviewComments,
    };
    try {
      if (!demoMode) {
        if (!activeWorkspace) throw new Error('Selecione uma empresa antes de registrar o parecer.');
        await submitReviewDecision(activeWorkspace.id, content.id, status, normalizedComment);
      }
      setContents((current) => current.map((item) => item.id === updated.id ? updated : item));
      setReviewing(null);
      setError('');
    } catch (reason) {
      throw new Error(`Não foi possível registrar o parecer: ${getErrorMessage(reason)}`);
    }
  }

  async function handleImportCsv(file?: File) {
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const imported = importContentCsv(await file.text());
      if (!demoMode) {
        if (!activeWorkspace) throw new Error('Selecione uma empresa antes de importar conteúdos.');
        await saveContents(activeWorkspace.id, imported);
      }
      setContents((current) => [...current, ...imported]);
      const earliestDate = imported.map((content) => content.date).sort()[0];
      const [year, selectedMonth] = earliestDate.split('-').map(Number);
      setMonth(new Date(year, selectedMonth - 1, 1));
      setError('');
    } catch (reason) {
      setError(`Não foi possível importar a planilha: ${getErrorMessage(reason)}`);
    } finally {
      setImporting(false);
    }
  }

  function shiftMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function exitDemoMode() {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    url.searchParams.delete('role');
    window.location.assign(url);
  }

  async function handleCreateWorkspace(name: string): Promise<void> {
    setCreatingWorkspace(true);
    setWorkspaceError('');
    try {
      const workspace: WorkspaceSummary = demoMode
        ? {
            id: `demo-workspace-${Date.now()}`,
            name,
            slug: `${name.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
            role: 'administrador',
            isOwner: true,
          }
        : await createWorkspace(name);
      setWorkspaces((current) => [...current, workspace]);
      setActiveWorkspace(workspace);
      setRole(workspace.role);
      setIsAdmin(true);
      updateWorkspaceUrl(workspace.slug);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleSetupCreateWorkspace(name: string): Promise<void> {
    try {
      await handleCreateWorkspace(name);
    } catch (reason) {
      setWorkspaceError(`Não foi possível criar a empresa: ${getErrorMessage(reason)}`);
    }
  }

  function handleWorkspaceChange(workspaceId: string): void {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;
    setActiveWorkspace(workspace);
    setRole(workspace.role);
    setIsAdmin(workspace.role === 'administrador' || isSystemAdmin);
    setWorkspaceError('');
    setContents([]);
    setError('');
    setStatusFilter('');
    setChannelFilter('');
    setQuery('');
    updateWorkspaceUrl(workspace.slug);
  }

  function navigateBackFromWorkspacePage(parameter: 'admin' | 'team'): void {
    const url = new URL(window.location.href);
    url.searchParams.delete(parameter);
    window.location.assign(url);
  }

  if (authLoading) {
    return <main className="auth-page"><p className="muted">Verificando acesso…</p></main>;
  }
  if (passwordRecovery && !demoMode) {
    return (
      <LoginForm
        error={authError}
        notice={signupConfirmationNotice ? 'E-mail confirmado. Entre para criar uma empresa ou pedir para ser adicionado a uma equipe.' : ''}
        recovery
        onSubmit={handleLogin}
        onSignUp={handleSignUp}
        onRequestPasswordReset={handlePasswordReset}
        onUpdatePassword={handlePasswordUpdate}
      />
    );
  }
  if (!session && !demoMode) {
    return (
      <LoginForm
        error={authError}
        notice={signupConfirmationNotice ? 'E-mail confirmado. Entre para criar uma empresa ou pedir para ser adicionado a uma equipe.' : ''}
        onSubmit={handleLogin}
        onSignUp={handleSignUp}
        onRequestPasswordReset={handlePasswordReset}
        onUpdatePassword={handlePasswordUpdate}
      />
    );
  }
  const activeIsAdmin = demoMode ? demoRole === 'administrador' : isAdmin;
  const activeRole = demoMode
    ? demoRole === 'administrador' ? 'programador' : demoRole
    : role;
  if (
    (adminView || teamView)
    && !demoMode
    && session
    && (workspaceLoading || accessUserId !== session.user.id)
  ) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <BrandLockup className="auth-card-brand" />
          <h1>{accessCheckError ? 'Não foi possível verificar o acesso' : 'Verificando permissões…'}</h1>
          <p className="muted">
            {accessCheckError || 'Aguarde enquanto confirmamos as empresas e permissões desta conta.'}
          </p>
          {accessCheckError && (
            <button className="button" onClick={() => window.location.reload()} type="button">
              Tentar novamente
            </button>
          )}
        </section>
      </main>
    );
  }
  if (workspaceLoading) {
    return <main className="auth-page"><p className="muted">Carregando empresas e permissões…</p></main>;
  }
  if (adminView) {
    if (!demoMode && !isSystemAdmin) {
      return (
        <main className="auth-page">
          <section className="auth-card">
            <BrandLockup className="auth-card-brand" />
            <h1>Acesso restrito</h1>
            <p className="muted">Somente o administrador geral pode gerenciar as contas globais.</p>
            <button className="button" onClick={() => window.location.assign(window.location.pathname)} type="button">
              Voltar ao painel
            </button>
          </section>
        </main>
      );
    }

    return (
      <AdminDashboard
        demoMode={demoMode}
        onExitDemo={exitDemoMode}
        onBack={() => navigateBackFromWorkspacePage('admin')}
      />
    );
  }
  if (!activeWorkspace && !demoMode) {
    return (
      <WorkspaceSetupPage
        error={workspaceError}
        pending={creatingWorkspace}
        onCreate={handleSetupCreateWorkspace}
        onLogout={() => void handleLogout()}
      />
    );
  }
  if (teamView) {
    if (!activeIsAdmin) {
      return (
        <main className="auth-page">
          <section className="auth-card">
            <BrandLockup className="auth-card-brand" />
            <h1>Acesso restrito</h1>
            <p className="muted">Somente administradores desta empresa podem gerenciar a equipe.</p>
            <button className="button" onClick={() => navigateBackFromWorkspacePage('team')} type="button">
              Voltar à empresa
            </button>
          </section>
        </main>
      );
    }

    return (
      <WorkspaceTeamDashboard
        demoMode={demoMode}
        workspaceId={activeWorkspace?.id || 'demo-workspace'}
        workspaceName={activeWorkspace?.name || 'Your Space'}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspace?.id || ''}
        onChangeWorkspace={handleWorkspaceChange}
        onCreateWorkspace={handleCreateWorkspace}
        onBack={() => navigateBackFromWorkspacePage('team')}
        onExitDemo={exitDemoMode}
      />
    );
  }
  if (!activeRole) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <BrandLockup className="auth-card-brand" />
          <p className="eyebrow">ACESSO AO WORKSPACE</p>
          <h1>Empresa não disponível</h1>
          <p className="muted">{workspaceError || error || 'Crie uma empresa ou peça ao administrador para adicionar sua conta à equipe.'}</p>
          <button className="button" onClick={() => void handleLogout()} type="button">Sair</button>
        </section>
      </main>
    );
  }
  const isReviewer = activeRole === 'revisor';

  const monthName = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const approvedCount = monthContents.filter((content) => content.status === 'aprovado').length;
  const completion = monthContents.length ? Math.round((approvedCount / monthContents.length) * 100) : 0;
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const numberOfDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarLength = Math.ceil((firstWeekday + numberOfDays) / 7) * 7;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="workspace-header-main">
          <BrandLockup />
          {activeWorkspace && (
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspace.id}
              canManage={activeIsAdmin}
              onChange={handleWorkspaceChange}
              onCreateWorkspace={handleCreateWorkspace}
              onManageTeam={() => window.location.assign(getWorkspaceTeamUrl())}
            />
          )}
        </div>
        <div className="user-menu">
          <span title={demoMode ? 'Dados fictícios desta demonstração' : session?.user.email}>
            {demoMode ? `Demonstração · ${demoRole === 'administrador' ? 'Administrador' : demoRole}` : session?.user.email}
          </span>
          {(demoMode ? demoRole === 'administrador' : isSystemAdmin) && (
            <a className="button" href={getAdminDashboardUrl()}>Acessos do Your Space</a>
          )}
          <button className="button" onClick={() => demoMode ? exitDemoMode() : void handleLogout()} type="button">
            {demoMode ? 'Sair do demo' : 'Sair'}
          </button>
        </div>
      </header>

      {demoMode && (
        <div className="notice demo-banner" role="status">
          Dados fictícios para demonstração. Alterações ficam apenas nesta sessão e não são salvas no Supabase.
        </div>
      )}

      <section className="toolbar">
        <div>
          <p className="eyebrow">PLANEJAMENTO EDITORIAL</p>
          <h2>{isReviewer ? 'Revisão de conteúdo' : 'Calendário de conteúdo'}</h2>
        </div>
        <div className="toolbar-actions">
          <div className="month-nav" aria-label="Navegar entre meses">
            <button className="icon-button" onClick={() => shiftMonth(-1)} type="button" aria-label="Mês anterior">‹</button>
            <span>{monthName}</span>
            <button className="icon-button" onClick={() => shiftMonth(1)} type="button" aria-label="Próximo mês">›</button>
          </div>
          <div className="view-switch" aria-label="Visualização">
            <button aria-pressed={view === 'cards'} onClick={() => setView('cards')} type="button">Cards</button>
            <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} type="button">Calendário</button>
            <button aria-pressed={view === 'table'} onClick={() => setView('table')} type="button">Tabela</button>
          </div>
          {!isReviewer && (
            <div className="toolbar-actions">
              <label className="button import-button">
                {importing ? 'Importando…' : 'Importar CSV'}
                <input
                  accept=".csv,text/csv"
                  aria-label="Importar arquivo CSV"
                  disabled={importing}
                  onChange={(event) => {
                    void handleImportCsv(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  type="file"
                />
              </label>
              <button className="button button-primary" onClick={openNewContent} type="button">+ Novo conteúdo</button>
            </div>
          )}
        </div>
      </section>

      <section className="summary-panel" aria-label="Resumo do mês">
        <div className="status-summary">
          {statuses.map((status) => {
            const count = monthContents.filter((content) => content.status === status).length;
            return (
              <button
                className={`summary-stat ${statusFilter === status ? 'selected' : ''}`}
                key={status}
                onClick={() => setStatusFilter((current) => current === status ? '' : status)}
                type="button"
                aria-pressed={statusFilter === status}
              >
                <strong>{count}</strong>
                <span><i className={`status-dot status-${status}`} />{statusLabels[status]}</span>
              </button>
            );
          })}
        </div>
        <div className="progress-line">
          <span>{approvedCount} de {monthContents.length} aprovados</span>
          <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
          <strong>{completion}%</strong>
        </div>
      </section>

      <section className="filters" aria-label="Filtros">
        <input
          aria-label="Buscar conteúdo"
          placeholder="Buscar por título ou legenda"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Filtrar por canal" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
          <option value="">Todos os canais</option>
          {channels.map((channel) => <option key={channel} value={channel}>{getChannelLabel(channel)}</option>)}
        </select>
      </section>

      {error && <div className="notice" role="alert">{error}<button className="icon-button" onClick={() => setError('')} type="button" aria-label="Fechar aviso">×</button></div>}

      {loading ? (
        <div className="empty-state"><p>Carregando conteúdos…</p></div>
      ) : isReviewer && visibleContents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark">✓</span>
          <h2>Nenhuma publicação neste mês</h2>
          <p>Publicações em revisão e os pareceres já registrados aparecerão aqui. Rascunhos continuam visíveis apenas para programadores.</p>
        </div>
      ) : !isReviewer && monthContents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark">✳</span>
          <h2>Nada agendado em {monthName}</h2>
          <p>Adicione conteúdos para organizar as publicações e acompanhar as aprovações.</p>
          <button className="button button-primary" onClick={openNewContent} type="button">+ Novo conteúdo</button>
        </div>
      ) : visibleContents.length === 0 ? (
        <div className="empty-state"><h2>Nenhum resultado</h2><p>Ajuste os filtros para ver os conteúdos deste mês.</p></div>
      ) : view === 'cards' && isReviewer ? (
        <section className="content-grid review-grid" aria-label="Publicações e pareceres">
          {visibleContents.map((content) => (
            <ReviewCard
              content={content}
              key={content.id}
              onReview={content.status === 'revisao' ? setReviewing : undefined}
            />
          ))}
        </section>
      ) : view === 'cards' ? (
        <section className="content-grid" aria-label="Conteúdos do mês">
          {visibleContents.map((content) => (
            <ContentCard content={content} key={content.id} onEdit={openEditContent} />
          ))}
        </section>
      ) : view === 'table' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Conteúdo</th><th>Canal</th><th>Formato</th><th>Status</th><th>Link</th>
                {isReviewer && <th>Parecer</th>}
              </tr>
            </thead>
            <tbody>
              {visibleContents.map((content) => (
                <tr className={isReviewer ? '' : 'clickable-row'} key={content.id} onClick={isReviewer ? undefined : () => openEditContent(content)}>
                  <td>{dateLabel(content.date)}</td>
                  <td className="table-title">{content.title}</td>
                  <td>{getChannelLabel(content.channel)}</td>
                  <td>{content.format}</td>
                  <td><span className={`status-pill status-${content.status}`}>{statusLabels[content.status]}</span></td>
                  <td>{content.link ? <a href={content.link} onClick={(event) => event.stopPropagation()} target="_blank" rel="noopener noreferrer">Abrir ↗</a> : '—'}</td>
                  {isReviewer && (
                    <td>
                      {content.status === 'revisao' ? (
                        <button className="button button-primary" onClick={() => setReviewing(content)} type="button">Aprovar</button>
                      ) : (
                        <span className="muted">Parecer registrado</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="calendar-wrap" aria-label={`Calendário de ${monthName}`}>
          <div className="calendar-grid">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {Array.from({ length: calendarLength }, (_, index) => {
              const day = index - firstWeekday + 1;
              if (day < 1 || day > numberOfDays) return <div className="calendar-day outside" key={`empty-${index}`} />;
              const date = `${localMonthKey(month)}-${String(day).padStart(2, '0')}`;
              const dayContents = visibleContents.filter((content) => content.date === date);
              return (
                <div className="calendar-day" key={date}>
                  <span className="day-number">{day}</span>
                  {dayContents.map((content) => (
                    <button
                      className={`calendar-item status-${content.status}`}
                      key={content.id}
                      disabled={isReviewer && content.status !== 'revisao'}
                      onClick={() => isReviewer ? setReviewing(content) : openEditContent(content)}
                      type="button"
                    >
                      {content.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {formOpen && (
        <ContentForm
          key={editing?.id || 'new-content'}
          initial={editing}
          isAdmin={activeIsAdmin}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onDelete={handleDelete}
          onResetReviewComments={handleResetReviewComments}
          onSubmit={handleSave}
        />
      )}
      {reviewing && (
        <ReviewDecisionModal
          content={reviewing}
          onClose={() => setReviewing(null)}
          onSubmit={(status, comment) => handleReviewDecision(reviewing, status, comment)}
        />
      )}
    </main>
  );
}

export default App;
