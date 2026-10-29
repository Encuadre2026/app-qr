/**
 * Una marca de tiempo de la API, leída como lo que es.
 *
 * D1 escribe `fecha_asistencia` con `CURRENT_TIMESTAMP`: «2026-10-29 15:00:00»,
 * en UTC, con un espacio en medio y sin marca de zona. Esa cadena no es ISO, y
 * `new Date()` la tomaba por hora local: en Aguascalientes, quien entró a las
 * 9:00 salía como «Ya registrado previamente … 15:00», seis horas en el
 * futuro. El panel tuvo el mismo fallo y lo corrigió en septiembre de 2026; el
 * portal ya lo leía bien.
 *
 * Devuelve `null` si no se puede leer, en vez de una fecha inválida que acaba
 * pintada como «NaN/NaN/NaN».
 */
export function desdeLaApi(texto: string): Date | null {
  const d1 = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(texto.trim());
  const fecha = new Date(d1 ? `${d1[1]}T${d1[2]}Z` : texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFecha(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = desdeLaApi(dateStr);
  if (!d) return null;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * «45 minutos», «1 hora», «3 horas y 50 minutos».
 *
 * Es la misma redacción que usa el Worker en su mensaje, porque las dos frases
 * salen en la misma pantalla: la suya cuando hay red y esta cuando no. Nunca
 * dice «0 minutos», que se leería como «ya puedes».
 */
export function expresarMinutos(minutos: number): string {
  const total = Math.max(1, Math.round(minutos));
  const plural = (n: number, singular: string) => `${n} ${singular}${n === 1 ? '' : 's'}`;
  if (total < 60) return plural(total, 'minuto');

  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0
    ? plural(horas, 'hora')
    : `${plural(horas, 'hora')} y ${plural(resto, 'minuto')}`;
}

export function getInitials(name: string | null | undefined): string {
  const parts = (name || '?').split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

export function esc(str: string | null | undefined): string {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

let audioCtx: AudioContext | null = null;

export function playBeep(): void {
  try {
    if (!audioCtx) {
      // Safari por debajo de la 14.1 solo expone el constructor con prefijo, y
      // lib.dom no lo declara. Se tipa en lugar de recurrir a `any` para que
      // `new AudioContextClass()` siga comprobándose.
      const AudioContextClass =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono agradable
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volumen suave
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1); // 100ms
    }
  } catch (e) {
    // Ignorar errores de audio
    console.warn("No se pudo reproducir el beep", e);
  }
}

export function obtenerFechaActualStr(): string {
  const ahora = new Date();
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return `${pad(ahora.getDate())}/${pad(ahora.getMonth() + 1)}/${ahora.getFullYear()} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
}
