import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Content, ContentStatus } from './types';

export type EditorRole = 'programador' | 'revisor';
export type AccountRole = EditorRole | 'sem_acesso' | 'administrador';

export interface PanelAccount {
  userId: string;
  email: string;
  role: AccountRole;
  isAdmin: boolean;
}

export interface EditorAccess {
  role: EditorRole | null;
  isAdmin: boolean;
}

export const supabase = createClient(
  'https://rinsachmljzzzvcgqowi.supabase.co',
  'sb_publishable_uRKFyCDMc0n3WIkSrrkNxg_YR1wp5GA',
);

interface ContentRow {
  id: string;
  data: Omit<Content, 'id'>;
}

export async function fetchContents(): Promise<Content[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id,data')
    .order('id');

  if (error) throw error;
  return ((data ?? []) as ContentRow[]).map((row) => ({ ...row.data, id: row.id }));
}

export async function verifyEditor(userId: string): Promise<EditorAccess> {
  const [editorResult, adminResult] = await Promise.all([
    supabase
    .from('panel_editors')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle(),
    supabase
      .from('panel_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (editorResult.error) throw editorResult.error;
  if (adminResult.error) throw adminResult.error;
  if (editorResult.data && editorResult.data.role !== 'programador' && editorResult.data.role !== 'revisor') {
    throw new Error('O perfil desta conta não é válido. Peça ao administrador para revisar a autorização.');
  }
  return {
    role: editorResult.data?.role || null,
    isAdmin: Boolean(adminResult.data),
  };
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

export async function saveContent(content: Content): Promise<void> {
  const { id, ...data } = content;
  const { error } = await supabase.from('posts').upsert({ id, data });
  if (error) throw error;
}

export async function saveContents(contents: Content[]): Promise<void> {
  const rows = contents.map(({ id, ...data }) => ({ id, data }));
  const { error } = await supabase.from('posts').upsert(rows);
  if (error) throw error;
}

export async function submitReviewDecision(
  postId: string,
  status: Extract<ContentStatus, 'aprovado' | 'ajustes'>,
  comment: string,
): Promise<void> {
  const params = {
    p_post_id: postId,
    p_status: status,
    p_comment: comment,
  };
  const { error } = await supabase.rpc('submit_review_decision', params);
  if (!error) return;

  if (error.code !== 'PGRST202' || !error.message.includes('p_workspace_id')) throw error;

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', 'your-space')
    .maybeSingle();

  if (workspaceError) {
    throw new Error(
      `O Supabase ainda está usando a função de parecer do painel multiempresa. Execute novamente o arquivo completo SUPABASE_SETUP.sql para voltar ao painel único. Detalhe: ${workspaceError.message}`,
    );
  }
  if (!workspace?.id) {
    throw new Error('A função de parecer no Supabase ainda exige um workspace. Execute novamente o arquivo completo SUPABASE_SETUP.sql.');
  }

  const { error: workspaceDecisionError } = await supabase.rpc('submit_review_decision', {
    ...params,
    p_workspace_id: workspace.id,
  });
  if (workspaceDecisionError?.code === 'PGRST202') {
    throw new Error(
      'O Supabase ainda está com a assinatura antiga da função de parecer. No SQL Editor, execute novamente o arquivo completo SUPABASE_SETUP.sql e tente outra vez.',
    );
  }
  if (workspaceDecisionError) throw workspaceDecisionError;
}

export async function deleteContent(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToContents(
  onChange: (contents: Content[]) => void,
  onError: (error: Error) => void,
): () => void {
  let active = true;
  const channel: RealtimeChannel = supabase
    .channel('shared-content')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
      fetchContents()
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
