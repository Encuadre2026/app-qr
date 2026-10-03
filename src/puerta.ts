/**
 * Qué hace la app con un escaneo, según lo que sabe de esa persona.
 *
 * Hasta octubre de 2026 la app daba por buena a cualquiera que estuviera en el
 * padrón, y en el padrón está todo el que se pre-registró, haya pagado o no. El
 * QR solo lleva el id, y ese id se conoce desde el alta, así que tener un código
 * no probaba nada. Ahora el Worker responde 409 `PAGO_PENDIENTE` a quien no
 * tiene el pago —o la acreditación de la asamblea— aprobado, y el padrón trae
 * `pago_aprobado` para que la app pueda decirlo también sin red.
 *
 * Vive aparte de `main.ts` para poder probar la decisión sin DOM.
 */

/** Lo que la app sabe de alguien al escanearlo. */
export interface EstadoConocido {
  /** Si su pago —o su acreditación— estaba aprobado en el último padrón. */
  aprobado: boolean;
  /** Cuándo entró, si ya entró. */
  asistencia: string | null;
}

/**
 * - `ya-registrado`: ya había entrado; no se pregunta nada.
 * - `preguntar`: con red, el servidor decide. Vale también para quien el padrón
 *   da por pendiente: la organización puede haberlo aprobado hace un minuto, en
 *   la mesa de registro, y el padrón del teléfono no lo sabe todavía.
 * - `pendiente-sin-red`: sin red y pendiente según el último padrón. No se
 *   encola: dar por buena la entrada sería dejar pasar a quien no tiene el pago
 *   aprobado, y encolarla para después no cambia que ya está dentro.
 * - `encolar`: sin red y aprobado; se guarda para enviarlo al volver la red.
 */
export type DecisionDeEscaneo = 'ya-registrado' | 'preguntar' | 'pendiente-sin-red' | 'encolar';

export function decidirEscaneo(estado: EstadoConocido, enLinea: boolean): DecisionDeEscaneo {
  if (estado.asistencia) return 'ya-registrado';
  if (enLinea) return 'preguntar';
  return estado.aprobado ? 'encolar' : 'pendiente-sin-red';
}

/**
 * Si el padrón dice que el pago está aprobado.
 *
 * Un Worker anterior a octubre de 2026 no manda el campo. Entonces se da por
 * aprobado, que es lo que la app hacía siempre: lo contrario dejaría sin pasar
 * lista a todo el mundo durante los minutos en que conviven las dos versiones.
 * Con red, de todos modos, decide el servidor.
 */
export function estaAprobado(pagoAprobado: unknown): boolean {
  return pagoAprobado !== false;
}

/** El código con el que el Worker dice «pago sin aprobar» en la puerta. */
export const CODIGO_PAGO_PENDIENTE = 'PAGO_PENDIENTE';
