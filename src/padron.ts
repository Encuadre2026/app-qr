/**
 * Cuándo se vuelve a pedir el padrón.
 *
 * La app lo cargaba una sola vez, al teclear el PIN, y la sesión dura doce
 * horas. Todo lo que cambiara después no llegaba al teléfono hasta volver a
 * entrar: un taller renombrado desde el panel seguía con su nombre viejo, y
 * —peor— quien se inscribía después, por ejemplo en un taller recién
 * agregado, salía «no encontrado» en la puerta aunque su registro existiera.
 */

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
