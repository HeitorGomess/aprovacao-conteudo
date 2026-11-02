import { createClient, type RealtimeChannel, type User } from '@supabase/supabase-js';
import type { Content, ContentStatus } from './types';
import { optimizeAvatarImage } from './optimizeAvatarImage';

export type EditorRole = 'programador' | 'revisor';
export type AccountRole = EditorRole | 'sem_acesso' | 'administrador';
export type WorkspaceRole = EditorRole | 'administrador';

export interface PanelAccount {
  userId: string;
  email: string;
  role: AccountRole;
  isAdmin: boolean;
  avatarUrl?: string;
}

export interface EditorAccess {
  role: WorkspaceRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  workspaceId: string;
  workspaceName: string;
  avatarUrl: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  isOwner: boolean;
  isPersonal: boolean;
  archivedAt: string | null;
  avatarUrl?: string;
}

export interface WorkspaceAvatarUpdate {
  avatarUrl: string;
  warning?: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  role: WorkspaceRole;
  isOwner: boolean;
  avatarUrl?: string;
}

export const supabase = createClient(
  'https://rinsachmljzzzvcgqowi.supabase.co',
  'sb_publishable_uRKFyCDMc0n3WIkSrrkNxg_YR1wp5GA',
);

function getWorkspaceAvatarUrl(path: string | null | undefined): string {
  if (!path) return '';
  const { data } = supabase.storage.from('workspace-avatars').getPublicUrl(path);
  return data.publicUrl;
}

interface ContentMetadataRow {
  id: string;
  date: string | null;
  channel: string | null;
  status: ContentStatus | null;
}

interface ContentMonthRow {
  id: string;
  data: Omit<Content, 'id'>;
}

function monthDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function fetchContents(workspaceId: string, month: Date): Promise<Content[]> {
  const monthStart = monthDateKey(month);
  const nextMonthStart = monthDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const [metadataResult, monthResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id,date:data->>date,channel:data->>channel,status:data->>status')
      .eq('workspace_id', workspaceId)
      .order('id'),
    supabase
      .from('posts')
      .select('id,data')
      .eq('workspace_id', workspaceId)
      .gte('data->>date', monthStart)
      .lt('data->>date', nextMonthStart)
      .order('id'),
  ]);

  if (metadataResult.error) throw metadataResult.error;
  if (monthResult.error) throw monthResult.error;

  const monthContents = new Map(
    ((monthResult.data ?? []) as ContentMonthRow[])
      .map((row) => [row.id, row.data]),
  );
  return ((metadataResult.data ?? []) as ContentMetadataRow[]).map((row) => ({
    ...(monthContents.get(row.id) || {
      title: '',
      date: row.date || '',
      channel: row.channel || '',
      format: '',
      link: '',
      caption: '',
      note: '',
      status: row.status || 'rascunho',
      coverData: '',
      history: [],
      reviewComments: [],
      updatedAt: '',
    }),
    id: row.id,
  }));
}

export async function listUserWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data, error } = await supabase.rpc('list_user_workspaces');
  if (error) throw error;
  const workspaces: WorkspaceSummary[] = (data || []).map((item: {
    workspace_id: string;
    workspace_name: string;
    workspace_slug: string;
    role: WorkspaceRole;
    is_owner: boolean;
    is_personal: boolean;
    archived_at: string | null;
    avatar_path: string | null;
  }) => ({
    id: item.workspace_id,
    name: item.workspace_name,
    slug: item.workspace_slug,
    role: item.role,
    isOwner: item.is_owner,
    isPersonal: item.is_personal === true,
    archivedAt: item.archived_at,
    avatarUrl: getWorkspaceAvatarUrl(item.avatar_path),
  }));
  return workspaces.filter((workspace) => !workspace.isPersonal || workspace.isOwner);
}

export async function ensurePersonalWorkspace(): Promise<boolean> {
  const { error } = await supabase.rpc('ensure_my_personal_workspace');
  if (!error) return true;
  if (error.code === 'PGRST202' || error.message.includes('Could not find the function')) return false;
  throw error;
}

export async function deleteMyAccount(): Promise<void> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) throw new Error('Sua sessão expirou. Entre novamente antes de excluir a conta.');

  const { error: deletionError } = await supabase.rpc('delete_my_account');
  if (deletionError) {
    if (deletionError.code === 'PGRST202' || deletionError.message.includes('Could not find the function')) {
      throw new Error('A exclusão de contas ainda não está configurada neste Supabase. Execute o arquivo completo SUPABASE_SETUP.sql no SQL Editor.');
    }
    throw deletionError;
  }

  const avatarUrl = data.user.user_metadata?.avatar_url;
  let avatarCleanupError = '';
  if (typeof avatarUrl === 'string' && avatarUrl.includes('/profile-avatars/')) {
    const { error: avatarError } = await supabase.storage
      .from('profile-avatars')
      .remove([`${data.user.id}/avatar`]);
    if (avatarError) avatarCleanupError = avatarError.message;
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) throw new Error(`Sua conta foi excluída, mas não foi possível limpar esta sessão: ${signOutError.message}`);
  if (avatarCleanupError) {
    throw new Error(`Sua conta foi excluída e a sessão encerrada, mas não foi possível remover a foto de perfil: ${avatarCleanupError}`);
  }
}

export async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  const { data, error } = await supabase.rpc('create_workspace', {
    p_name: name.trim(),
  });
  if (error) throw error;
  const workspace = Array.isArray(data) ? data[0] : data;
  if (!workspace?.workspace_id) throw new Error('O Supabase não retornou a empresa criada.');
  return {
    id: workspace.workspace_id,
    name: workspace.workspace_name,
    slug: workspace.workspace_slug,
    role: 'administrador',
    isOwner: true,
    isPersonal: false,
    archivedAt: null,
  };
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_workspace', {
    p_workspace_id: workspaceId,
    p_name: name.trim(),
  });
  if (error) throw error;
}

export async function saveWorkspaceAvatar(
  workspaceId: string,
  avatarFile: File | null,
): Promise<WorkspaceAvatarUpdate> {
  let avatarPath: string | null = null;
  if (avatarFile) {
    const optimizedFile = await optimizeAvatarImage(avatarFile);
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const extension = extensionByType[optimizedFile.type];
    if (!extension) throw new Error('Escolha uma imagem JPG, PNG, GIF ou WebP.');

    avatarPath = `${workspaceId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('workspace-avatars')
      .upload(avatarPath, optimizedFile, {
        cacheControl: '31536000',
        contentType: optimizedFile.type,
        upsert: false,
      });
    if (uploadError) {
      if (uploadError.message.includes('row-level security policy')) {
        throw new Error('O Supabase bloqueou o envio por uma regra de segurança desatualizada. Execute novamente o arquivo completo SUPABASE_SETUP.sql no SQL Editor.');
      }
      throw new Error(`Não foi possível enviar a foto da empresa: ${uploadError.message}`);
    }
  }

  const { data: previousAvatarPath, error: updateError } = await supabase.rpc('set_workspace_avatar', {
    p_workspace_id: workspaceId,
    p_avatar_path: avatarPath,
  });
  if (updateError) {
    if (avatarPath) {
      const { error: cleanupError } = await supabase.storage.from('workspace-avatars').remove([avatarPath]);
      if (cleanupError) {
        throw new Error(`Não foi possível salvar a foto da empresa: ${updateError.message}. Também não foi possível limpar o arquivo enviado: ${cleanupError.message}`);
      }
    }
    if (updateError.code === 'PGRST202' || updateError.message.includes('Could not find the function')) {
      throw new Error('A configuração das fotos de empresa ainda não está disponível. Execute novamente o arquivo completo SUPABASE_SETUP.sql no SQL Editor do Supabase.');
    }
    throw new Error(`Não foi possível salvar a foto da empresa: ${updateError.message}`);
  }

  let warning: string | undefined;
  if (typeof previousAvatarPath === 'string' && previousAvatarPath && previousAvatarPath !== avatarPath) {
    const { error: cleanupError } = await supabase.storage
      .from('workspace-avatars')
      .remove([previousAvatarPath]);
    if (cleanupError) {
      warning = `A foto foi atualizada, mas não foi possível limpar o arquivo anterior: ${cleanupError.message}`;
    }
  }

  return { avatarUrl: getWorkspaceAvatarUrl(avatarPath), warning };
}

export async function archiveWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
}

export async function restoreWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
}

export async function deleteArchivedWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_archived_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
}

export async function saveUserProfile(
  name: string,
  avatarFile?: File,
  personalSpaceName?: string,
): Promise<User> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error('Sua sessão expirou. Entre novamente para atualizar o perfil.');

  let avatarUrl = typeof user.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : '';
  if (avatarFile) {
    const optimizedFile = await optimizeAvatarImage(avatarFile);
    const { error: uploadError } = await supabase.storage
      .from('profile-avatars')
      .upload(`${user.id}/avatar`, optimizedFile, {
        cacheControl: '31536000',
        contentType: optimizedFile.type,
        upsert: true,
      });
    if (uploadError) throw new Error(`Não foi possível enviar a foto: ${uploadError.message}`);
    const { data: publicUrl } = supabase.storage
      .from('profile-avatars')
      .getPublicUrl(`${user.id}/avatar`);
    avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
  }

  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: name.trim(),
      avatar_url: avatarUrl,
      ...(personalSpaceName ? { personal_space_name: personalSpaceName.trim() } : {}),
    },
  });
  if (error) throw new Error(`Não foi possível atualizar o perfil: ${error.message}`);
  if (!data.user) throw new Error('O Supabase não retornou o usuário atualizado.');
  return data.user;
}

export async function verifyWorkspaceAccess(workspaceSlug: string): Promise<EditorAccess> {
  const { data, error } = await supabase.rpc('verify_workspace_access', {
    p_workspace_slug: workspaceSlug,
  });
  if (error) throw error;
  const access = Array.isArray(data) ? data[0] : data;
  if (!access?.workspace_id) throw new Error('Empresa não encontrada ou sem acesso para esta conta.');
  return {
    role: access.role as WorkspaceRole | null,
    isAdmin: access.is_admin,
    isOwner: access.is_owner,
    workspaceId: access.workspace_id,
    workspaceName: access.workspace_name,
    avatarUrl: getWorkspaceAvatarUrl(access.avatar_path),
  };
}

export async function verifyPanelAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('panel_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase.rpc('list_workspace_members', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return (data || []).map((member: {
    user_id: string;
    email: string;
    role: WorkspaceRole;
    is_owner: boolean;
    avatar_url?: string | null;
  }) => ({
    userId: member.user_id,
    email: member.email,
    role: member.role,
    isOwner: member.is_owner,
    avatarUrl: member.avatar_url || '',
  }));
}

export async function addWorkspaceMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
): Promise<void> {
  const { error } = await supabase.rpc('add_workspace_member', {
    p_workspace_id: workspaceId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });
  if (error) throw error;
}

export async function setWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole | 'sem_acesso',
): Promise<void> {
  const { error } = await supabase.rpc('set_workspace_member_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function listPanelAccounts(): Promise<PanelAccount[]> {
  const { data, error } = await supabase.rpc('list_panel_accounts');
  if (error) throw error;
  return (data || []).map((account: {
    user_id: string;
    email: string;
    role: AccountRole;
    is_admin: boolean;
    avatar_url?: string | null;
  }) => ({
    userId: account.user_id,
    email: account.email,
    role: account.role,
    isAdmin: account.is_admin,
    avatarUrl: account.avatar_url || '',
  }));
}

export async function setPanelAccountRole(userId: string, role: EditorRole | 'sem_acesso'): Promise<void> {
  const { error } = await supabase.rpc('set_panel_account_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function saveContent(workspaceId: string, content: Content): Promise<void> {
  const { id, ...data } = content;
  const { error } = await supabase.from('posts').upsert({ id, workspace_id: workspaceId, data });
  if (error) throw error;
}

export async function saveContents(workspaceId: string, contents: Content[]): Promise<void> {
  const rows = contents.map(({ id, ...data }) => ({ id, workspace_id: workspaceId, data }));
  const { error } = await supabase.from('posts').upsert(rows);
  if (error) throw error;
}

export async function submitReviewDecision(
  workspaceId: string,
  postId: string,
  status: Extract<ContentStatus, 'aprovado' | 'ajustes'>,
  comment: string,
): Promise<void> {
  const params = {
    p_workspace_id: workspaceId,
    p_post_id: postId,
    p_status: status,
    p_comment: comment,
  };
  const { error } = await supabase.rpc('submit_review_decision', params);
  if (error) throw error;
}

export async function resetReviewComments(workspaceId: string, postId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_review_comments', {
    p_workspace_id: workspaceId,
    p_post_id: postId,
  });
  if (error) throw error;
}

export async function deleteContent(workspaceId: string, id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('workspace_id', workspaceId).eq('id', id);
  if (error) throw error;
}

export function subscribeToContents(
  workspaceId: string,
  month: Date,
  onChange: (contents: Content[]) => void,
  onError: (error: Error) => void,
): () => void {
  let active = true;
  const channel: RealtimeChannel = supabase
    .channel(`workspace-content-${workspaceId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'posts',
      filter: `workspace_id=eq.${workspaceId}`,
    }, () => {
      fetchContents(workspaceId, month)
        .then((contents) => {
          if (active) onChange(contents);
        })
        .catch((error: unknown) => {
          if (active) onError(error instanceof Error ? error : new Error('Falha ao sincronizar conteúdos.'));
        });
    })
    .subscribe((status) => {
      if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
        onError(new Error('A sincronização ao vivo falhou. Recarregue o painel para buscar alterações.'));
      }
    });

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}
