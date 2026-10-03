import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decidirEscaneo, estaAprobado } from '../src/puerta';
import { addToOfflineQueue, getOfflineQueue, syncOfflineQueue } from '../src/api';
import { desdeLaApi, formatearFecha } from '../src/utils';

/**
 * La puerta: quién entra, y qué se hace sin red.
 *
 * Hasta octubre de 2026 la app daba por buena a cualquiera del padrón, y en el
 * padrón está todo el que se pre-registró, haya pagado o no. El QR solo lleva
 * el id, que se conoce desde el alta.
 */

describe('decidirEscaneo', () => {
  it('quien ya entró no se vuelve a preguntar', () => {
    expect(decidirEscaneo({ aprobado: true, asistencia: '29/10/2026 09:00' }, true)).toBe(
      'ya-registrado'
    );
  });

  it('con red decide el servidor, también para quien el padrón da por pendiente', () => {
    // La organización puede haberlo aprobado hace un minuto en la mesa de
    // registro, y el padrón del teléfono todavía no lo sabe.
    expect(decidirEscaneo({ aprobado: true, asistencia: null }, true)).toBe('preguntar');
    expect(decidirEscaneo({ aprobado: false, asistencia: null }, true)).toBe('preguntar');
  });

  it('sin red, a quien se sabe aprobado se le encola', () => {
    expect(decidirEscaneo({ aprobado: true, asistencia: null }, false)).toBe('encolar');
  });

  it('sin red, a quien no está aprobado no se le deja pasar ni se le encola', () => {
    expect(decidirEscaneo({ aprobado: false, asistencia: null }, false)).toBe('pendiente-sin-red');
  });
});

describe('estaAprobado', () => {
  it('lee el booleano que manda el Worker', () => {
    expect(estaAprobado(true)).toBe(true);
    expect(estaAprobado(false)).toBe(false);
  });

  it('sin el campo —un Worker anterior— se comporta como siempre', () => {
    // Si no, durante los minutos en que conviven las dos versiones nadie
    // podría pasar lista.
    expect(estaAprobado(undefined)).toBe(true);
  });
});

describe('las fechas de la API', () => {
  it('leen la marca de D1 como UTC, no como hora local', () => {
    // «2026-10-29 15:00:00» es lo que escribe CURRENT_TIMESTAMP: las 9:00 en
    // Aguascalientes. new Date() a secas lo tomaba por las 15:00 locales.
    const fecha = desdeLaApi('2026-10-29 15:00:00');
    expect(fecha?.toISOString()).toBe('2026-10-29T15:00:00.000Z');
  });

  it('aceptan también una ISO completa', () => {
    expect(desdeLaApi('2026-10-29T15:00:00Z')?.toISOString()).toBe('2026-10-29T15:00:00.000Z');
  });

  it('una fecha ilegible no se pinta como NaN', () => {
    expect(desdeLaApi('no es una fecha')).toBeNull();
    expect(formatearFecha('no es una fecha')).toBeNull();
  });

  it('formatearFecha pinta la hora local que corresponde', () => {
    const esperado = new Date('2026-10-29T15:00:00Z');
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    expect(formatearFecha('2026-10-29 15:00:00')).toBe(
      `${pad(esperado.getDate())}/${pad(esperado.getMonth() + 1)}/${esperado.getFullYear()} ` +
        `${pad(esperado.getHours())}:${pad(esperado.getMinutes())}`
    );
  });
});

// ── La cola sin conexión ────────────────────────────────
function respuesta(status: number, cuerpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as Response;
}

describe('la cola sin conexión', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('qr_asistencia_staff_token', 'un.token');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('descarta lo que el servidor rechaza para siempre y conserva lo que puede salir bien', async () => {
    addToOfflineQueue({ id: 'ENC-404', asistencia: 'x' });
    addToOfflineQueue({ id: 'ENC-409', asistencia: 'x' });
    addToOfflineQueue({ id: 'ENC-500', asistencia: 'x' });
    addToOfflineQueue({ id: 'ENC-200', asistencia: 'x' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, opciones: RequestInit) => {
        const { id } = JSON.parse(String(opciones.body));
        const estado = Number(id.slice(4));
        return respuesta(estado, { ok: estado === 200, mensaje: `estado ${estado}` });
      })
    );

    await syncOfflineQueue(() => {});

    // Antes el 404 y el 409 se quedaban en la cola para siempre.
    expect(getOfflineQueue().map((q) => q.id)).toEqual(['ENC-500']);
  });

  it('no pierde lo que se encola mientras sincroniza', async () => {
    addToOfflineQueue({ id: 'ENC-001', asistencia: 'x' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        // La red va y viene en la puerta: entre tanto alguien escanea otro QR.
        addToOfflineQueue({ id: 'ENC-002', asistencia: 'y' });
        return respuesta(200, { ok: true, duplicado: false });
      })
    );

    await syncOfflineQueue(() => {});

    expect(getOfflineQueue().map((q) => q.id)).toEqual(['ENC-002']);
  });

  it('dos sincronizaciones a la vez envían cada escaneo una sola vez', async () => {
    addToOfflineQueue({ id: 'ENC-001', asistencia: 'x' });
    const espia = vi.fn(async () => respuesta(200, { ok: true, duplicado: false }));
    vi.stubGlobal('fetch', espia);

    await Promise.all([syncOfflineQueue(() => {}), syncOfflineQueue(() => {})]);

    expect(espia).toHaveBeenCalledTimes(1);
    expect(getOfflineQueue()).toEqual([]);
  });
});
