/** Lo que la app guarda en su caché local para poder buscar sin red. */
export interface Participante {
  id: string;
  nombre: string;
  evento: string | null;
  institucion: string | null;
  perfil: string | null;
  /** Si su pago —o su acreditación, en la asamblea— está aprobado. */
  aprobado: boolean;
  asistencia: string | null;
}

/**
 * Un registro tal como lo devuelve `/api/staff/participantes`.
 *
 * Ya no trae `correo`, `curp` ni `telefono`. Antes se pedía
 * `/api/admin/registros`, que sí los devuelve, de modo que cada teléfono del
 * personal acababa con el padrón completo —incluidos datos de contacto— en su
 * almacenamiento. Para pasar lista no hacen ninguna falta.
 */
export interface RegistroAPI {
  id_participante: string;
  nombre: string;
  taller: string | null;
  institucion: string | null;
  perfil: string | null;
  /**
   * Si su pago —o su acreditación— está aprobado. Opcional porque un Worker
   * anterior a octubre de 2026 no lo manda: ver `estaAprobado`.
   */
  pago_aprobado?: boolean;
  asistio: boolean;
  fecha_asistencia: string | null;
}

export interface RegistrosResponse {
  participantes: RegistroAPI[];
}

export interface OfflineQueueItem {
  id: string;
  asistencia: string;
}
