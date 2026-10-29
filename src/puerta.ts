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
 * Desde octubre de 2026 a la misma persona se le pasa lista **varias veces** —la
 * constancia se entrega a quien acumule un mínimo de asistencias—, pero no dos
 * veces seguidas: entre una y otra tiene que pasar una espera, que es lo que
 * impide que escanear tres veces el mismo código en la misma mesa regale una
 * constancia. Esa espera la aplica el Worker; aquí se conoce para poder avisar
 * sin red, y porque un botón que se puede pulsar y nunca cuenta es peor que un
 * botón apagado.
 *
 * Vive aparte de `main.ts` para poder probar la decisión sin DOM.
 */

import { desdeLaApi } from './utils';

/** Lo que la app sabe de alguien al escanearlo. */
export interface EstadoConocido {
  /** Si su pago —o su acreditación— estaba aprobado en el último padrón. */
  aprobado: boolean;
  /**
   * Cuándo se le pasó lista la última vez, tal y como lo manda la API —UTC—, o
   * null si nunca. Es la fecha en crudo y no la ya formateada porque con ella se
   * mide la espera, y para eso hay que poder restarla.
   */
  ultima: string | null;
}

/**
 * Espera que se aplica mientras el padrón no diga otra.
 *
 * La de verdad llega en `minutos_entre_asistencias`, porque se configura en el
 * Worker y se puede cambiar sin desplegar nada. Este número es el que se usa
 * mientras no llegue —un Worker anterior, o un padrón guardado antes— y vale lo
 * mismo que el suyo por defecto: cuatro horas.
 */
export const MINUTOS_ENTRE_ASISTENCIAS = 240;

/** La espera que dice el padrón, o la de por defecto si no viene o viene rota. */
export function minutosDeEspera(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? valor
    : MINUTOS_ENTRE_ASISTENCIAS;
}

/** Minutos que faltan para que la siguiente asistencia cuente. Cero si ya cuenta. */
export function minutosQueFaltan(
  ultima: string | null,
  minutos: number,
  ahora = Date.now()
): number {
  if (!ultima || minutos <= 0) return 0;
  const fecha = desdeLaApi(ultima);
  // Una fecha ilegible cuenta como «no hay espera»: es mejor preguntarle al
  // servidor que dejar a alguien en la puerta por un dato que no se pudo leer.
  if (!fecha) return 0;
  return Math.max(0, Math.ceil((fecha.getTime() + minutos * 60000 - ahora) / 60000));
}

/** Si se le pasó lista hace tan poco que otra asistencia no contaría. */
export function dentroDeLaEspera(
  ultima: string | null,
  minutos: number,
  ahora = Date.now()
): boolean {
  return minutosQueFaltan(ultima, minutos, ahora) > 0;
}

/**
 * - `preguntar`: con red decide el servidor. **Siempre**, también para quien ya
 *   tiene asistencias: desde que se puede pasar lista varias veces, «ya entró»
 *   dejó de significar «no vuelvas a preguntar», y quien sabe de verdad cuánta
 *   espera queda —y si otro teléfono acaba de pasarle lista— es el Worker.
 * - `ya-registrado`: sin red, y se le pasó lista hace menos de la espera. Ese
 *   escaneo no va a contar, así que tampoco se encola: encolarlo solo serviría
 *   para decirle al personal «guardado» de algo que el servidor descartará.
 * - `pendiente-sin-red`: sin red y pendiente según el último padrón. No se
 *   encola: dar por buena la entrada sería dejar pasar a quien no tiene el pago
 *   aprobado.
 * - `encolar`: sin red, aprobado y fuera de la espera; se guarda para enviarlo
 *   cuando vuelva la red.
 */
export type DecisionDeEscaneo = 'ya-registrado' | 'preguntar' | 'pendiente-sin-red' | 'encolar';

export function decidirEscaneo(
  estado: EstadoConocido,
  enLinea: boolean,
  minutos = MINUTOS_ENTRE_ASISTENCIAS
): DecisionDeEscaneo {
  if (enLinea) return 'preguntar';
  // La espera antes del pago, igual que en el Worker: a quien ya está dentro no
  // se le manda a la mesa de registro.
  if (dentroDeLaEspera(estado.ultima, minutos)) return 'ya-registrado';
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
