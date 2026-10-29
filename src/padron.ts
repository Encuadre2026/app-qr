/**
 * El padrón: cómo se lee cada fila, cómo se busca en él y cuándo se vuelve a
 * pedir.
 *
 * La app lo cargaba una sola vez, al teclear el PIN, y la sesión dura doce
 * horas. Todo lo que cambiara después no llegaba al teléfono hasta volver a
 * entrar: un taller renombrado desde el panel seguía con su nombre viejo, y
 * —peor— quien se inscribía después, por ejemplo en un taller recién
 * agregado, salía «no encontrado» en la puerta aunque su registro existiera.
 */

import { estaAprobado } from './puerta';
import { Participante, RegistroAPI } from './types';
import { formatearFecha, normalizar } from './utils';

/**
 * Una fila del padrón de la API, como la guarda la app.
 *
 * Vive aquí, fuera de `main.ts`, por lo mismo que `decidirEscaneo`: para poder
 * probar sin DOM lo que la app entiende de cada respuesta. Y hay dos respuestas
 * que entender mientras el Worker se despliega: la que trae el recuento de
 * asistencias y la anterior, que solo traía la marca de haber entrado.
 */
export function participanteDesdeLaApi(reg: RegistroAPI): Participante {
  // Si el recuento no viene —un Worker anterior a octubre de 2026—, se deduce
  // de lo que sí: la marca vale por una asistencia y su fecha por la última.
  const ultima = reg.ultima_asistencia ?? (reg.asistio ? reg.fecha_asistencia : null);
  return {
    id: reg.id_participante,
    nombre: reg.nombre,
    evento: reg.taller,
    institucion: reg.institucion,
    perfil: reg.perfil,
    aprobado: estaAprobado(reg.pago_aprobado),
    // `formatearFecha` devuelve null si la fecha no se puede leer, y quien ya
    // entró tiene que seguir constando como dentro aunque sea sin hora.
    asistencia: ultima ? (formatearFecha(ultima) ?? 'sí') : null,
    asistencias: reg.asistencias ?? (reg.asistio ? 1 : 0),
    ultima,
  };
}

/**
 * Cuántos nombres se enseñan como mucho.
 *
 * Dos letras pueden casar con cientos de personas, y una lista así no se
 * recorre con el pulgar: lo que se hace es teclear una letra más.
 */
export const MAXIMO_RESULTADOS = 20;

/**
 * Los participantes que casan con lo escrito, por nombre o por id.
 *
 * Compara las dos partes normalizadas —ver `normalizar`— y no el texto tal
 * cual, para que una tilde olvidada, o puesta de más, siga encontrando a la
 * persona.
 *
 * Vive aquí, fuera de `main.ts`, por lo mismo que la función de arriba.
 */
export function buscarEnPadron(
  lista: Participante[],
  texto: string,
  limite: number = MAXIMO_RESULTADOS
): Participante[] {
  const buscado = normalizar(texto);
  if (!buscado) return [];

  const resultados: Participante[] = [];
  for (const p of lista) {
    if (normalizar(p.nombre).includes(buscado) || normalizar(p.id).includes(buscado)) {
      resultados.push(p);
      if (resultados.length >= limite) break;
    }
  }
  return resultados;
}

/**
 * Lo mínimo entre dos recargas al volver a la app.
 *
 * El personal cambia de aplicación a cada rato —para contestar un mensaje,
 * para mirar la hora— y no hace falta pedir el padrón entero cada vez. Un
 * minuto basta para que un cambio del panel llegue sin multiplicar peticiones.
 */
export const MINIMO_ENTRE_RECARGAS_MS = 60_000;

/** ¿Toca volver a pedir el padrón? Siempre, si nunca se cargó. */
export function tocaRecargar(ultimaCarga: number | null, ahora: number): boolean {
  return ultimaCarga === null || ahora - ultimaCarga >= MINIMO_ENTRE_RECARGAS_MS;
}

/**
 * Busca en el padrón cargado y, si no está, lo pide otra vez —una sola— antes
 * de darlo por no encontrado.
 *
 * `recargar` devuelve si la carga salió bien: si falló, no tiene sentido
 * volver a buscar en la misma lista.
 */
export async function buscarConRecarga<T>(
  buscar: () => T | null,
  recargar: () => Promise<boolean>
): Promise<T | null> {
  const encontrado = buscar();
  if (encontrado !== null) return encontrado;
  if (!(await recargar())) return null;
  return buscar();
}
