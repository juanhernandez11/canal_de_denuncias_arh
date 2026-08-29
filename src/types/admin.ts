export type EstatusFolio =
  | 'recibida'
  | 'en_revision'
  | 'en_investigacion'
  | 'resuelta'
  | 'desestimada';

export const ESTATUS_LABELS: Record<EstatusFolio, string> = {
  recibida: 'Recibida',
  en_revision: 'En revisión',
  en_investigacion: 'En investigación',
  resuelta: 'Resuelta',
  desestimada: 'Desestimada',
};

export interface AdminUser {
  username: string;
}

export interface Denuncia {
  id: number;
  folio: string;
  estatus: EstatusFolio;
  tipo: string | null;
  empresa: string | null;
  centro: string | null;
  modo: string | null;
  denunciante_nombre: string | null;
  denunciante_correo: string | null;
  descripcion: string | null;
  payload_json: string | null;
  notas_admin: string;
  created_at: string;
  updated_at: string;
}

export type DenunciaType = 'text' | 'textarea' | 'html';

export interface ContentBlock {
  id: number;
  block_key: string;
  label: string;
  type: DenunciaType;
  value: string;
  updated_at: string;
}
