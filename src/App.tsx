import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import BrandLockup from './components/BrandLockup';
import ContentCard from './components/ContentCard';
import DropdownSelect from './components/DropdownSelect';
import LoginForm from './components/LoginForm';
import ProfileMenu from './components/ProfileMenu';
import ReviewCard from './components/ReviewCard';
import ReviewDecisionModal from './components/ReviewDecisionModal';
import ThemeToggle from './components/ThemeToggle';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import {
  createWorkspace,
  archiveWorkspace,
  deleteArchivedWorkspace,
  deleteContent,
  deleteMyAccount,
  ensurePersonalWorkspace,
  fetchContents,
  listUserWorkspaces,
  renameWorkspace,
  saveContent,
  saveContents,
  restoreWorkspace,
  saveUserProfile,
  saveWorkspaceAvatar,
  resetReviewComments,
  submitReviewDecision,
  subscribeToContents,
  supabase,
  verifyPanelAdmin,
  type EditorRole,
  type WorkspaceAvatarUpdate,
  type WorkspaceRole,
  type WorkspaceSummary,
} from './features/content-approval/contentService';
import { createMockContents } from './features/content-approval/mockData';
import { importContentCsv } from './features/content-approval/csvImport';
import { getChannelLabel } from './features/content-approval/contentLabels';
import type { Content, ContentFormData, ContentStatus, ReviewComment } from './features/content-approval/types';

type ViewMode = 'cards' | 'calendar' | 'table';
type AppRoute = 'dashboard' | 'admin' | 'team' | 'profile';
const VIEW_AS_STORAGE_PREFIX = 'your-space:view-as:';
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ContentForm = lazy(() => import('./components/ContentForm'));
const UserProfilePage = lazy(() => import('./components/UserProfilePage'));
const WorkspaceTeamDashboard = lazy(() => import('./components/WorkspaceTeamDashboard'));

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

const statuses = Object.keys(statusLabels) as ContentStatus[];

function getAppRoute(): AppRoute {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('admin') === '1') return 'admin';
  if (searchParams.get('team') === '1') return 'team';
  if (searchParams.get('profile') === '1') return 'profile';
  return 'dashboard';
}

function clearStoredViewAsRoles(): void {
  const keys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(VIEW_AS_STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.sessionStorage.removeItem(key));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    return [error.message, details, hint].filter(Boolean).join(' ');
  }
  return 'Ocorreu um erro inesperado.';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('O arquivo selecionado não contém uma imagem válida.'));
    };
    reader.readAsDataURL(file);
  });
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
  const [route, setRoute] = useState<AppRoute>(getAppRoute);
  const adminView = route === 'admin';
  const teamView = route === 'team';
  const profileView = route === 'profile';
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  const [accessCheckError, setAccessCheckError] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [viewAsRole, setViewAsRole] = useState<WorkspaceRole>('administrador');
  const [workspaceLoading, setWorkspaceLoading] = useState(!demoMode);
  const [workspaceError, setWorkspaceError] = useState('');
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
  const [newContentDate, setNewContentDate] = useState('');
  const [importing, setImporting] = useState(false);
  const [reviewing, setReviewing] = useState<Content | null>(null);
  const isWorkspaceAdmin = activeWorkspace?.role === 'administrador';
  const activeIsAdmin = demoMode ? demoRole === 'administrador' : isAdmin;
  const activeRole: WorkspaceRole | null = isWorkspaceAdmin
    ? viewAsRole
    : demoMode
      ? demoRole === 'administrador' ? 'administrador' : demoRole
      : role;
  const isAdminReviewerMode = isWorkspaceAdmin && viewAsRole === 'revisor';
  const canManageWorkspace = activeIsAdmin && activeRole === 'administrador';
  const authUserId = useRef<string | null>(null);
  const signupConfirmationRedirect = useRef(
    new URLSearchParams(window.location.search).get('auth') === 'confirmed'
      || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'signup',
  );

  useEffect(() => {
    const syncRoute = () => setRoute(getAppRoute());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    clearStoredViewAsRoles();
  }, [session?.user.id]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    const storedRole = workspaceId
      ? window.sessionStorage.getItem(`${VIEW_AS_STORAGE_PREFIX}${workspaceId}`)
      : null;
    setViewAsRole(
      storedRole === 'programador' || storedRole === 'revisor'
        ? storedRole
        : 'administrador',
    );
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (demoMode) {
      const demoWorkspace: WorkspaceSummary = {
        id: 'demo-workspace',
        name: 'Your Space',
        slug: 'your-space',
        role: demoRole === 'administrador' ? 'administrador' : demoRole,
        isOwner: demoRole === 'administrador',
        isPersonal: false,
        archivedAt: null,
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
        const [personalWorkspaceReady, initialWorkspaceResult, adminResult] = await Promise.all([
          ensurePersonalWorkspace(),
          listUserWorkspaces(),
          verifyPanelAdmin(userId),
        ]);
        let workspaceResult = initialWorkspaceResult;
        if (personalWorkspaceReady && !workspaceResult.some((workspace) => workspace.isPersonal)) {
          workspaceResult = await listUserWorkspaces();
        }
        if (!active) return;
        if (!personalWorkspaceReady && workspaceResult.length === 0) {
          throw new Error('A criação automática do espaço pessoal ainda não foi configurada. Execute o arquivo completo SUPABASE_SETUP.sql no SQL Editor do Supabase.');
        }
        const urlSlug = new URLSearchParams(window.location.search).get('workspace');
        const savedSlug = window.sessionStorage.getItem('activeWorkspaceSlug');
        const selected = (urlSlug
          ? workspaceResult.find((workspace) => workspace.slug === urlSlug && !workspace.archivedAt)
          : undefined)
          || (!urlSlug
            ? workspaceResult.find((workspace) => workspace.slug === savedSlug && !workspace.archivedAt)
            : undefined)
          || workspaceResult.find((workspace) => workspace.isPersonal && !workspace.archivedAt)
          || workspaceResult.find((workspace) => !workspace.archivedAt);
        setWorkspaces(workspaceResult);
        setIsSystemAdmin(adminResult);
        setActiveWorkspace(selected || null);
        setRole(selected?.role || null);
        setIsAdmin(selected?.role === 'administrador' || adminResult);
        setAccessUserId(userId);
        setAccessCheckError('');
        if (selected) updateWorkspaceUrl(selected.slug);
        else if (urlSlug) {
          const url = new URL(window.location.href);
          url.searchParams.delete('workspace');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          window.sessionStorage.removeItem('activeWorkspaceSlug');
        }
        setContents([]);
      } catch (reason) {
        if (!active) return;
        const message = getErrorMessage(reason);
        setWorkspaceError(`Não foi possível preparar seu espaço de trabalho: ${message}`);
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
    if (!activeWorkspace) {
      setContents([]);
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError('');
    fetchContents(activeWorkspace.id, month)
      .then((loadedContents) => {
        if (!active) return;
        setContents(loadedContents);
        unsubscribe = subscribeToContents(
          activeWorkspace.id,
          month,
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
  }, [activeWorkspace?.id, demoMode, month, session]);

  const monthContents = useMemo(
    () => contents.filter((content) => (
      content.date.startsWith(localMonthKey(month))
      && (activeRole !== 'revisor' || content.status !== 'rascunho')
    )),
    [contents, month, activeRole],
  );
  const channels = useMemo(
    () => Array.from(new Set(
      contents
        .filter((content) => activeRole !== 'revisor' || content.status !== 'rascunho')
        .map((content) => content.channel)
        .filter(Boolean),
    )).sort(),
    [contents, activeRole],
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
    if (signUpError?.message.toLowerCase().includes('email rate limit exceeded')) {
      throw new Error(
        'O limite de envio de e-mails foi atingido. Confira se o SMTP personalizado está ativo e verifique Authentication → Rate Limits → Emails sent. O SMTP padrão do Supabase tem uma cota separada de até 2 e-mails por hora.',
      );
    }
    if (signUpError) throw new Error(`Não foi possível criar a conta: ${signUpError.message}`);
    return 'Conta criada. Confirme seu e-mail e entre para abrir seu espaço pessoal como administrador. Você poderá participar de outras empresas quando quiser.';
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

  async function handleDeleteAccount(): Promise<void> {
    await deleteMyAccount();
  }

  function openNewContent(date?: string) {
    setEditing(null);
    setNewContentDate(date || '');
    setFormOpen(true);
  }

  function openEditContent(content: Content) {
    setEditing(content);
    setNewContentDate('');
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
    const actorEmail = demoMode ? 'admin@exemplo.com' : session?.user.email || '';
    const actorName = demoMode
      ? 'Administrador demo'
      : typeof session?.user.user_metadata?.full_name === 'string' && session.user.user_metadata.full_name.trim()
        ? session.user.user_metadata.full_name.trim()
        : actorEmail || 'Usuário';
    const reviewComment: ReviewComment = {
      at: now,
      author: actorName,
      authorEmail: actorEmail,
      comment: normalizedComment,
      decision: status,
    };
    const updated: Content = {
      ...content,
      status,
      updatedAt: now,
      history: [...content.history.slice(-19), { status, at: now, author: actorName, authorEmail: actorEmail }],
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

  function changeViewAsRole(nextRole: WorkspaceRole) {
    if (!activeWorkspace || !isWorkspaceAdmin) return;
    window.sessionStorage.setItem(
      `${VIEW_AS_STORAGE_PREFIX}${activeWorkspace.id}`,
      nextRole,
    );
    setViewAsRole(nextRole);
    if (nextRole !== 'administrador') {
      setFormOpen(false);
      setEditing(null);
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
    setWorkspaceError('');
    const workspace: WorkspaceSummary = demoMode
      ? {
          id: `demo-workspace-${Date.now()}`,
          name,
          slug: `${name.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
          role: 'administrador',
          isOwner: true,
          isPersonal: false,
          archivedAt: null,
        }
      : await createWorkspace(name);
    setWorkspaces((current) => [...current, workspace]);
    setActiveWorkspace(workspace);
    setRole(workspace.role);
    setIsAdmin(true);
    updateWorkspaceUrl(workspace.slug);
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

  async function handleRenameWorkspace(workspaceId: string, name: string): Promise<void> {
    if (!demoMode) await renameWorkspace(workspaceId, name);
    setWorkspaces((current) => current.map((workspace) =>
      workspace.id === workspaceId ? { ...workspace, name: name.trim() } : workspace,
    ));
    setActiveWorkspace((current) =>
      current?.id === workspaceId ? { ...current, name: name.trim() } : current,
    );
  }

  async function handleSaveWorkspaceAvatar(
    workspaceId: string,
    avatarFile: File | null,
  ): Promise<WorkspaceAvatarUpdate> {
    const result = demoMode
      ? { avatarUrl: avatarFile ? await readFileAsDataUrl(avatarFile) : '' }
      : await saveWorkspaceAvatar(workspaceId, avatarFile);
    setWorkspaces((current) => current.map((workspace) =>
      workspace.id === workspaceId ? { ...workspace, avatarUrl: result.avatarUrl } : workspace,
    ));
    setActiveWorkspace((current) =>
      current?.id === workspaceId ? { ...current, avatarUrl: result.avatarUrl } : current,
    );
    return result;
  }

  async function handleArchiveWorkspace(workspaceId: string): Promise<void> {
    if (!demoMode) await archiveWorkspace(workspaceId);
    const archivedAt = new Date().toISOString();
    setWorkspaces((current) => current.map((workspace) =>
      workspace.id === workspaceId ? { ...workspace, archivedAt } : workspace,
    ));
    if (activeWorkspace?.id === workspaceId) {
      const nextWorkspace = workspaces.find((workspace) => workspace.id !== workspaceId && !workspace.archivedAt);
      setActiveWorkspace(nextWorkspace || null);
      setRole(nextWorkspace?.role || null);
      setIsAdmin(Boolean(nextWorkspace?.role === 'administrador' || isSystemAdmin));
      setContents([]);
      setError('');
      if (nextWorkspace) {
        updateWorkspaceUrl(nextWorkspace.slug);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('workspace');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        window.sessionStorage.removeItem('activeWorkspaceSlug');
      }
    }
  }

  async function handleRestoreWorkspace(workspaceId: string): Promise<void> {
    if (!demoMode) await restoreWorkspace(workspaceId);
    const restored = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!restored) throw new Error('Não foi possível localizar a empresa arquivada.');
    const activeRestored = { ...restored, archivedAt: null };
    setWorkspaces((current) => current.map((workspace) =>
      workspace.id === workspaceId ? activeRestored : workspace,
    ));
    setActiveWorkspace(activeRestored);
    setRole(activeRestored.role);
    setIsAdmin(activeRestored.role === 'administrador' || isSystemAdmin);
    setContents([]);
    setError('');
    updateWorkspaceUrl(activeRestored.slug);
  }

  async function handleDeleteArchivedWorkspace(workspaceId: string): Promise<void> {
    if (!demoMode) await deleteArchivedWorkspace(workspaceId);
    const remainingWorkspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);
    setWorkspaces(remainingWorkspaces);
    if (activeWorkspace?.id === workspaceId) {
      const nextWorkspace = remainingWorkspaces.find((workspace) => !workspace.archivedAt) || null;
      setActiveWorkspace(nextWorkspace);
      setRole(nextWorkspace?.role || null);
      setIsAdmin(Boolean(nextWorkspace?.role === 'administrador' || isSystemAdmin));
      setContents([]);
      setError('');
      if (nextWorkspace) {
        updateWorkspaceUrl(nextWorkspace.slug);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('workspace');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        window.sessionStorage.removeItem('activeWorkspaceSlug');
      }
    }
  }

  async function handleSaveProfile(name: string, avatarFile?: File, personalSpaceName?: string): Promise<string> {
    if (demoMode) return '';
    if (activeWorkspace?.isPersonal && personalSpaceName) {
      await renameWorkspace(activeWorkspace.id, personalSpaceName);
      setWorkspaces((current) => current.map((workspace) =>
        workspace.id === activeWorkspace.id ? { ...workspace, name: personalSpaceName } : workspace,
      ));
      setActiveWorkspace((current) =>
        current?.id === activeWorkspace.id ? { ...current, name: personalSpaceName } : current,
      );
    }
    const updatedUser = await saveUserProfile(name, avatarFile, personalSpaceName);
    setSession((current) => current ? { ...current, user: updatedUser } : current);
    const avatarUrl = updatedUser.user_metadata?.avatar_url;
    return typeof avatarUrl === 'string' ? avatarUrl : '';
  }

  function navigateToRoute(nextRoute: AppRoute): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('admin');
    url.searchParams.delete('team');
    url.searchParams.delete('profile');
    if (nextRoute !== 'dashboard') url.searchParams.set(nextRoute, '1');
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setRoute(nextRoute);
  }

  function openPanelPage(): void {
    navigateToRoute('dashboard');
  }

  function openProfileSettings(): void {
    navigateToRoute('profile');
  }

  function navigateBackFromWorkspacePage(_parameter: 'admin' | 'team'): void {
    navigateToRoute('dashboard');
  }

  if (authLoading) {
    return <main className="auth-page"><ThemeToggle className="auth-theme-toggle" /><p className="muted">Verificando acesso…</p></main>;
  }
  if (passwordRecovery && !demoMode) {
    return (
      <LoginForm
        error={authError}
        notice={signupConfirmationNotice ? 'E-mail confirmado. Entre para abrir seu espaço pessoal como administrador.' : ''}
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
        notice={signupConfirmationNotice ? 'E-mail confirmado. Entre para abrir seu espaço pessoal como administrador.' : ''}
        onSubmit={handleLogin}
        onSignUp={handleSignUp}
        onRequestPasswordReset={handlePasswordReset}
        onUpdatePassword={handlePasswordUpdate}
      />
    );
  }
  if (
    (adminView || teamView)
    && !demoMode
    && session
    && (workspaceLoading || accessUserId !== session.user.id)
  ) {
    return (
      <main className="auth-page">
        <ThemeToggle className="auth-theme-toggle" />
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
    return <main className="auth-page"><ThemeToggle className="auth-theme-toggle" /><p className="muted">Carregando empresas e permissões…</p></main>;
  }
  if (adminView) {
    if (!demoMode && !isSystemAdmin) {
      return (
        <main className="auth-page">
          <ThemeToggle className="auth-theme-toggle" />
          <section className="auth-card">
            <BrandLockup className="auth-card-brand" />
            <h1>Acesso restrito</h1>
            <p className="muted">Somente o administrador geral pode gerenciar as contas globais.</p>
            <button className="button" onClick={() => navigateToRoute('dashboard')} type="button">
              Voltar ao painel
            </button>
          </section>
        </main>
      );
    }

    return (
      <Suspense fallback={<main className="auth-page"><ThemeToggle className="auth-theme-toggle" /><p className="muted">Carregando…</p></main>}>
        <AdminDashboard
          demoMode={demoMode}
          onExitDemo={exitDemoMode}
          onBack={() => navigateBackFromWorkspacePage('admin')}
        />
      </Suspense>
    );
  }
  if (profileView) {
    const user = session?.user || null;
    const userEmail = user?.email || (demoMode ? 'admin@exemplo.com' : '');
    const userFullName = typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : '';
    const userAvatarUrl = typeof user?.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : '';
    const personalSpaceName = activeWorkspace?.isPersonal
      ? activeWorkspace.name
      : typeof user?.user_metadata?.personal_space_name === 'string'
      && user.user_metadata.personal_space_name.trim()
      ? user.user_metadata.personal_space_name.trim()
      : 'Your Space';
    return (
      <Suspense fallback={<main className="auth-page"><ThemeToggle className="auth-theme-toggle" /><p className="muted">Carregando…</p></main>}>
        <UserProfilePage
          user={user}
          email={userEmail}
          fullName={userFullName}
          avatarUrl={userAvatarUrl}
          personalSpaceName={personalSpaceName}
          allowPersonalSpaceRename={Boolean(activeWorkspace?.isPersonal && !demoMode)}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace?.id || ''}
          canManage={canManageWorkspace}
          demoMode={demoMode}
          onChangeWorkspace={handleWorkspaceChange}
          onCreateWorkspace={handleCreateWorkspace}
          onManageTeam={() => navigateToRoute('team')}
          onOpenPanel={openPanelPage}
          onOpenSettings={() => undefined}
          onSignOut={() => demoMode ? exitDemoMode() : void handleLogout()}
          onSaveProfile={handleSaveProfile}
          onDeleteAccount={handleDeleteAccount}
        />
      </Suspense>
    );
  }
  if (!activeWorkspace && workspaces.length === 0 && !demoMode) {
    return (
      <main className="auth-page">
        <ThemeToggle className="auth-theme-toggle" />
        <section className="auth-card">
          <BrandLockup className="auth-card-brand" />
          <h1>Não foi possível preparar seu espaço pessoal</h1>
          <p className="muted">
            {workspaceError || 'Não encontramos seu espaço de trabalho. Tente novamente para continuar.'}
          </p>
          <button className="button button-primary" onClick={() => window.location.reload()} type="button">
            Tentar novamente
          </button>
          <button className="button" onClick={() => void handleLogout()} type="button">Sair</button>
        </section>
      </main>
    );
  }
  if (teamView) {
    if (!canManageWorkspace) {
      return (
        <main className="auth-page">
          <ThemeToggle className="auth-theme-toggle" />
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
      <Suspense fallback={<main className="auth-page"><ThemeToggle className="auth-theme-toggle" /><p className="muted">Carregando…</p></main>}>
        <WorkspaceTeamDashboard
          demoMode={demoMode}
          workspaceId={activeWorkspace?.id || 'demo-workspace'}
          workspaceSlug={activeWorkspace?.slug || 'your-space'}
          workspaceName={activeWorkspace?.name || 'Your Space'}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace?.id || ''}
          canManage={canManageWorkspace}
          isSystemAdmin={demoMode ? demoRole === 'administrador' : isSystemAdmin}
          profileName={session?.user.user_metadata?.full_name || ''}
          avatarUrl={typeof session?.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : ''}
          onChangeWorkspace={handleWorkspaceChange}
          onCreateWorkspace={handleCreateWorkspace}
          onRenameWorkspace={handleRenameWorkspace}
          onSaveWorkspaceAvatar={handleSaveWorkspaceAvatar}
          onArchiveWorkspace={handleArchiveWorkspace}
          onRestoreWorkspace={handleRestoreWorkspace}
          onDeleteWorkspace={handleDeleteArchivedWorkspace}
          onManageCompany={() => navigateToRoute('team')}
          onOpenPanel={openPanelPage}
          onOpenSettings={openProfileSettings}
          onSignOut={() => demoMode ? exitDemoMode() : void handleLogout()}
          onExitDemo={exitDemoMode}
        />
      </Suspense>
    );
  }
  if (!activeRole) {
    return (
      <main className="auth-page">
        <ThemeToggle className="auth-theme-toggle" />
        <section className="auth-card">
          <BrandLockup className="auth-card-brand" />
          <p className="eyebrow">ACESSO AO WORKSPACE</p>
          <h1>Espaço pessoal não disponível</h1>
          <p className="muted">{workspaceError || error || 'Tente novamente para abrir seu espaço pessoal.'}</p>
          <button className="button button-primary" onClick={() => window.location.reload()} type="button">
            Tentar novamente
          </button>
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
              canManage={false}
              canCreateWorkspace={!isWorkspaceAdmin || activeRole === 'administrador'}
              onChange={handleWorkspaceChange}
              onCreateWorkspace={handleCreateWorkspace}
            />
          )}
        </div>
        <div className="user-menu">
          <ThemeToggle />
          {isWorkspaceAdmin && (
            <DropdownSelect
              ariaLabel="Visualizar como"
              className="role-header-dropdown"
              value={viewAsRole}
              onChange={(selectedRole) => {
                if (selectedRole === 'administrador' || selectedRole === 'programador' || selectedRole === 'revisor') {
                  changeViewAsRole(selectedRole);
                }
              }}
              options={[
                { value: 'administrador', label: 'Administrador' },
                { value: 'programador', label: 'Programador' },
                { value: 'revisor', label: 'Revisor' },
              ]}
            />
          )}
          <ProfileMenu
            displayName={
              typeof session?.user.user_metadata?.full_name === 'string'
                ? session.user.user_metadata.full_name
                : demoMode ? 'Administrador demo' : 'Meu perfil'
            }
            avatarUrl={typeof session?.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : ''}
            onOpenSettings={openProfileSettings}
            onManageCompany={canManageWorkspace ? () => navigateToRoute('team') : undefined}
            onSignOut={() => demoMode ? exitDemoMode() : void handleLogout()}
          />
        </div>
      </header>

      {isAdminReviewerMode && (
        <div className="review-mode-banner" role="status">
          <span>Você está vendo como revisor</span>
          <button onClick={() => changeViewAsRole('administrador')} type="button">Voltar para administrador</button>
        </div>
      )}

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
              <button className="button button-primary" onClick={() => openNewContent()} type="button">+ Novo conteúdo</button>
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
      ) : isReviewer && visibleContents.length === 0 && view !== 'calendar' ? (
        <div className="empty-state">
          <span className="empty-mark">✓</span>
          <h2>Nenhuma publicação neste mês</h2>
          <p>Publicações em revisão e os pareceres já registrados aparecerão aqui. Rascunhos continuam visíveis apenas para programadores.</p>
        </div>
      ) : !isReviewer && monthContents.length === 0 && view !== 'calendar' ? (
        <div className="empty-state">
          <span className="empty-mark">✳</span>
          <h2>Nada agendado em {monthName}</h2>
          <p>Adicione conteúdos para organizar as publicações e acompanhar as aprovações.</p>
          <button className="button button-primary" onClick={() => openNewContent()} type="button">+ Novo conteúdo</button>
        </div>
      ) : visibleContents.length === 0 && view !== 'calendar' ? (
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
          <div className="calendar-grid" role="grid" aria-label={`Calendário de ${monthName}`}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div className="calendar-weekday" key={day} role="columnheader">{day}</div>)}
            {Array.from({ length: calendarLength }, (_, index) => {
              const day = index - firstWeekday + 1;
              if (day < 1 || day > numberOfDays) return <div className="calendar-day outside" key={`empty-${index}`} role="gridcell" />;
              const date = `${localMonthKey(month)}-${String(day).padStart(2, '0')}`;
              const dayContents = visibleContents.filter((content) => content.date === date);
              return (
                <div className="calendar-day" key={date} role="gridcell">
                  {!isReviewer ? (
                    <button
                      aria-label={`Criar postagem em ${new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}`}
                      className="calendar-day-add"
                      onClick={() => openNewContent(date)}
                      type="button"
                    >
                      <span className="day-number">{day}</span>
                      <span className="calendar-add-label">+ Nova postagem</span>
                    </button>
                  ) : (
                    <span className="day-number">{day}</span>
                  )}
                  <div className="calendar-day-contents">
                    {dayContents.map((content) => (
                      <button
                        className={`calendar-item status-${content.status}`}
                        key={content.id}
                        disabled={isReviewer && content.status !== 'revisao'}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isReviewer) setReviewing(content);
                          else openEditContent(content);
                        }}
                        type="button"
                      >
                        {content.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {formOpen && !isReviewer && (
        <Suspense fallback={null}>
          <ContentForm
            key={editing?.id || newContentDate || 'new-content'}
            initial={editing}
            initialDate={newContentDate}
            isAdmin={canManageWorkspace}
            onClose={() => { setFormOpen(false); setEditing(null); }}
            onDelete={handleDelete}
            onResetReviewComments={handleResetReviewComments}
            onSubmit={handleSave}
          />
        </Suspense>
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
