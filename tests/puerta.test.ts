import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  decidirEscaneo,
  dentroDeLaEspera,
  estaAprobado,
  MINUTOS_ENTRE_ASISTENCIAS,
  minutosDeEspera,
  minutosQueFaltan,
} from '../src/puerta';
import { addToOfflineQueue, getOfflineQueue, syncOfflineQueue } from '../src/api';
import { desdeLaApi, expresarMinutos, formatearFecha } from '../src/utils';

/**
 * La puerta: quién entra, cuántas veces cuenta y qué se hace sin red.
 *
 * Hasta octubre de 2026 la app daba por buena a cualquiera del padrón, y en el
 * padrón está todo el que se pre-registró, haya pagado o no. El QR solo lleva
 * el id, que se conoce desde el alta.
 *
 * Y la asistencia era un sí o no: la app decidía aquí mismo que alguien «ya
 * estaba registrado» y no llamaba al Worker, así que cuando la constancia pasó a
 * entregarse por un mínimo de asistencias, una segunda era imposible desde la
 * app por mucho que el Worker la admitiera.
 */

/** Una fecha como las manda la API, situada hace tantos minutos. */
function haceMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * 60000).toISOString().replace('T', ' ').substring(0, 19);
}

describe('decidirEscaneo', () => {
  it('con red decide el servidor, incluso para quien ya tiene asistencias', () => {
    // Quien sabe cuánta espera queda —y si otro teléfono acaba de pasarle
    // lista— es el Worker.
    expect(decidirEscaneo({ aprobado: true, ultima: haceMinutos(1) }, true)).toBe('preguntar');
    expect(decidirEscaneo({ aprobado: true, ultima: null }, true)).toBe('preguntar');
    // También para quien el padrón da por pendiente: la organización puede
    // haberlo aprobado hace un minuto en la mesa de registro.
    expect(decidirEscaneo({ aprobado: false, ultima: null }, true)).toBe('preguntar');
  });

  it('sin red y dentro de la espera, el escaneo no cuenta y no se encola', () => {
    // Encolarlo solo serviría para decirle al personal «guardado» de algo que
    // el servidor va a descartar cuando vuelva la red.
    expect(decidirEscaneo({ aprobado: true, ultima: haceMinutos(10) }, false, 240)).toBe(
      'ya-registrado'
    );
  });

  it('sin red y pasada la espera, se encola como cualquier otra', () => {
    expect(decidirEscaneo({ aprobado: true, ultima: haceMinutos(241) }, false, 240)).toBe('encolar');
  });

  it('sin red, a quien se sabe aprobado y no ha entrado se le encola', () => {
    expect(decidirEscaneo({ aprobado: true, ultima: null }, false)).toBe('encolar');
  });

  it('sin red, a quien no está aprobado no se le deja pasar ni se le encola', () => {
    expect(decidirEscaneo({ aprobado: false, ultima: null }, false)).toBe('pendiente-sin-red');
  });

  it('sin red, la espera se mira antes del pago, igual que en el Worker', () => {
    // A quien ya está dentro no se le manda a la mesa de registro.
    expect(decidirEscaneo({ aprobado: false, ultima: haceMinutos(10) }, false, 240)).toBe(
      'ya-registrado'
    );
  });
});

describe('la espera entre dos asistencias', () => {
  it('la dice el padrón, para poder cambiarla sin desplegar la app', () => {
    expect(minutosDeEspera(90)).toBe(90);
    expect(minutosDeEspera(0)).toBe(0);
  });

  it('sin el campo —un Worker anterior— se usa la de por defecto', () => {
    expect(minutosDeEspera(undefined)).toBe(MINUTOS_ENTRE_ASISTENCIAS);
    expect(minutosDeEspera('cuatro horas')).toBe(MINUTOS_ENTRE_ASISTENCIAS);
    expect(minutosDeEspera(-5)).toBe(MINUTOS_ENTRE_ASISTENCIAS);
  });

  it('cuenta los minutos que faltan redondeando hacia arriba', () => {
    const ahora = Date.parse('2026-10-29T15:00:00Z');
    expect(minutosQueFaltan('2026-10-29 14:00:00', 240, ahora)).toBe(180);
    expect(minutosQueFaltan('2026-10-29 10:59:00', 240, ahora)).toBe(0);
    expect(minutosQueFaltan(null, 240, ahora)).toBe(0);
  });

  it('en 0 no hay espera: todo escaneo cuenta', () => {
    const ahora = Date.parse('2026-10-29T15:00:00Z');
    expect(dentroDeLaEspera('2026-10-29 14:59:00', 0, ahora)).toBe(false);
  });

  it('una fecha ilegible no deja a nadie en la puerta', () => {
    expect(dentroDeLaEspera('no es una fecha', 240)).toBe(false);
  });

  it('la frase de cuánto falta se lee igual que la del Worker', () => {
    expect(expresarMinutos(45)).toBe('45 minutos');
    expect(expresarMinutos(60)).toBe('1 hora');
    expect(expresarMinutos(230)).toBe('3 horas y 50 minutos');
    // Nunca «0 minutos», que se leería como «ya puedes».
    expect(expresarMinutos(0)).toBe('1 minuto');
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
