export function formatearFecha(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
