export interface Participante {
  id: string;
  nombre: string;
  evento: string | null;
  correo: string | null;
  curp: string | null;
  telefono: string | null;
  institucion: string | null;
  perfil: string | null;
  asistencia: string | null;
}

export interface RegistroAPI {
  id_participante: string;
  nombre: string;
  taller: string | null;
  correo: string | null;
  curp: string | null;
  telefono: string | null;
  institucion: string | null;
  perfil: string | null;
  asistio: boolean;
  fecha_asistencia: string | null;
}

export interface RegistrosResponse {
  registros: RegistroAPI[];
}

export interface OfflineQueueItem {
  id: string;
  asistencia: string;
}
