export type ContentStatus = 'rascunho' | 'revisao' | 'ajustes' | 'aprovado';

export interface StatusChange {
  status: ContentStatus;
  at: string;
}

export interface ReviewComment {
  at: string;
  author: string;
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
  history: StatusChange[];
  reviewComments?: ReviewComment[];
  updatedAt: string;
}

export type ContentFormData = Omit<Content, 'id' | 'history' | 'updatedAt'>;
