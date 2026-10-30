export type ContentStatus = 'rascunho' | 'revisao' | 'ajustes' | 'aprovado';

export interface StatusChange {
  status: ContentStatus;
  at: string;
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
  updatedAt: string;
}

export type ContentFormData = Omit<Content, 'id' | 'history' | 'updatedAt'>;
