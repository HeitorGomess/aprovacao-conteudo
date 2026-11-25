export type ContentStatus = 'rascunho' | 'revisao' | 'ajustes' | 'aprovado';

export interface StatusChange {
  status: ContentStatus;
  at: string;
  author?: string;
  authorEmail?: string;
}

export interface ReviewComment {
  at: string;
  author: string;
  authorEmail?: string;
  comment: string;
  decision: 'aprovado' | 'ajustes';
}

export interface Content {
  id: string;
  title: string;
  date: string;
  channel: string;
  format: string;
  link: string;
  caption: string;
  note: string;
  status: ContentStatus;
  coverData: string;
  additionalImages?: string[];
  history: StatusChange[];
  reviewComments?: ReviewComment[];
  updatedAt: string;
}

export type ContentFormData = Omit<Content, 'id' | 'history' | 'updatedAt'>;

export const MAX_CONTENT_IMAGES = 20;

export function getContentImages(content: Pick<Content, 'coverData' | 'additionalImages'>): string[] {
  return [content.coverData, ...(content.additionalImages || [])].filter(Boolean);
}
