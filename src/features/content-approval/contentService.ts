import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Content, ContentStatus } from './types';

export type EditorRole = 'programador' | 'revisor';
export type AccountRole = EditorRole | 'sem_acesso' | 'administrador';
export type WorkspaceRole = EditorRole | 'administrador';

export interface PanelAccount {
  userId: string;
  email: string;
  role: AccountRole;
  isAdmin: boolean;
}

export interface EditorAccess {
  role: WorkspaceRole | null;
  isAdmin: boolean;
  isOwner: boolean;
  workspaceId: string;
  workspaceName: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  isOwner: boolean;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  role: WorkspaceRole;
  isOwner: boolean;
}

export const supabase = createClient(
  'https://rinsachmljzzzvcgqowi.supabase.co',
  'sb_publishable_uRKFyCDMc0n3WIkSrrkNxg_YR1wp5GA',
);

interface ContentRow {
  id: string;
  data: Omit<Content, 'id'>;
}

export async function fetchContents(workspaceId: string): Promise<Content[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id,data')
    .eq('workspace_id', workspaceId)
    .order('id');

  if (error) throw error;
  return ((data ?? []) as ContentRow[]).map((row) => ({ ...row.data, id: row.id }));
}

export async function listUserWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data, error } = await supabase.rpc('list_user_workspaces');
  if (error) throw error;
  return (data || []).map((item: {
    workspace_id: string;
    workspace_name: string;
    workspace_slug: string;
    role: WorkspaceRole;
    is_owner: boolean;
  }) => ({
    id: item.workspace_id,
    name: item.workspace_name,
    slug: item.workspace_slug,
    role: item.role,
    isOwner: item.is_owner,
  }));
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
  };
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
  }) => ({
    userId: member.user_id,
    email: member.email,
    role: member.role,
    isOwner: member.is_owner,
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
  return (data || []).map((account: { user_id: string; email: string; role: AccountRole; is_admin: boolean }) => ({
    userId: account.user_id,
    email: account.email,
    role: account.role,
    isAdmin: account.is_admin,
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
      fetchContents(workspaceId)
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
