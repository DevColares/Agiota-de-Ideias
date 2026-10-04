import type { Timestamp } from 'firebase-admin/firestore';

export type LinkStatus = 'PENDENTE' | 'CONCLUIDO';

export interface GeminiAnalysis {
  titulo: string;
  checklist: string[];
  dias_prazo_sugerido: number;
}

export interface LinkDocument {
  id?: string;
  short_id: string;
  user_id: number | string;
  chat_id: number | string;
  user_name?: string;
  url: string;
  titulo: string;
  checklist: string[];
  dias_prazo_sugerido: number;
  status: LinkStatus;
  criado_em: Timestamp | Date;
  data_cobranca: Timestamp | Date;
  tentativas_cobranca: number;
  ultima_cobranca?: Timestamp | Date;
}
