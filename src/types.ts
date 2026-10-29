/** Lo que la app guarda en su caché local para poder buscar sin red. */
export interface Participante {
  id: string;
  nombre: string;
  evento: string | null;
  institucion: string | null;
  perfil: string | null;
  /** Si su pago —o su acreditación, en la asamblea— está aprobado. */
  aprobado: boolean;
  /** La última vez que se le pasó lista, ya formateada. Null si ninguna. */
  asistencia: string | null;
  /** Cuántas veces se le ha pasado lista. Cero si ninguna. */
  asistencias: number;
  /** Esa última, en crudo como la manda la API, para poder medir la espera. */
  ultima: string | null;
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
  /** Que entró, y cuándo lo hizo la PRIMERA vez. */
  asistio: boolean;
  fecha_asistencia: string | null;
  /**
   * El recuento de la migración 0012 del Worker: cuántas veces se le ha pasado
   * lista, en cuántos días distintos y cuándo fue la última. Opcionales porque
   * un Worker anterior no los manda, y entonces la app cuenta lo que sabe:
   * `asistio` como una asistencia y `fecha_asistencia` como la última.
   */
  asistencias?: number;
  dias_asistidos?: number;
  ultima_asistencia?: string | null;
}

export interface RegistrosResponse {
  participantes: RegistroAPI[];
  /**
   * Minutos que el Worker exige entre dos asistencias de la misma persona.
   * Opcional por lo mismo que los de arriba: ver `minutosDeEspera`.
   */
  minutos_entre_asistencias?: number;
}

/** Lo que responde `POST /api/asistencia`. Todo opcional: ver `RegistroAPI`. */
export interface RespuestaDeAsistencia {
  /** True cuando no se anotó nada porque la espera no había terminado. */
  duplicado?: boolean;
  asistencias?: number;
  dias_asistidos?: number;
  ultima_asistencia?: string | null;
  /** Minutos que faltan para que la siguiente cuente, si esta no contó. */
  faltan_minutos?: number;
  mensaje?: string;
}

export interface OfflineQueueItem {
  id: string;
  asistencia: string;
}
