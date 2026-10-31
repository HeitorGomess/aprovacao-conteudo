import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Content, ContentStatus } from './types';

export type EditorRole = 'programador' | 'revisor';

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

export async function verifyEditor(userId: string): Promise<EditorRole | null> {
  const { data, error } = await supabase
    .from('panel_editors')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.role !== 'programador' && data.role !== 'revisor') {
    throw new Error('O perfil desta conta não é válido. Peça ao administrador para revisar a autorização.');
  }
  return data.role;
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
  const { error } = await supabase.rpc('submit_review_decision', {
    p_post_id: postId,
    p_status: status,
    p_comment: comment,
  });
  if (error) throw error;
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
