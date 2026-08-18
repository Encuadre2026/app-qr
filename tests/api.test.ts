import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorApi,
  fetchParticipantes,
  haySesion,
  iniciarSesion,
  marcarAsistenciaAPI,
  obtenerToken,
  olvidarSesion,
} from '../src/api';

/**
 * Acceso del personal.
 *
 * La app se autenticaba con `VITE_ADMIN_SECRET`, y Vite incrusta las variables
 * `VITE_*` en el paquete que descarga el navegador: la credencial que abría el
 * padrón completo —con CURP y teléfono—, la aprobación de pagos y el borrado de
 * registros viajaba dentro de un archivo JavaScript público. Y el PIN que
 * supuestamente protegía la app estaba escrito en el código como `pin === '2026'`.
 *
 * Estas pruebas afirman lo que sustituye a todo eso: que la sesión se obtiene
 * hablando con el servidor, que caduca, y que un fallo dice cuál fue.
 */

function respuesta(status: number, cuerpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as Response;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

// ── Inicio de sesión ────────────────────────────────────
describe('iniciarSesion', () => {
  it('guarda el token que devuelve el servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(200, { ok: true, token: 'un.token', expira: Date.now() + 1000 }))
    );

    await iniciarSesion('482071');

    expect(haySesion()).toBe(true);
    expect(obtenerToken()).toBe('un.token');
  });

  it('no guarda nada del PIN', async () => {
    // El PIN se envía y se olvida. Si quedara en el almacenamiento, volveríamos
    // a tener una credencial reutilizable dentro del dispositivo.
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(200, { ok: true, token: 'un.token' })));

    await iniciarSesion('482071');

    const todo = JSON.stringify({ ...sessionStorage, ...localStorage });
    expect(todo).not.toContain('482071');
  });

  it('distingue un PIN incorrecto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuesta(401, {
          ok: false,
          codigo: 'NO_AUTORIZADO',
          mensaje: 'PIN incorrecto o sesión caducada.',
        })
      )
    );

    const fallo = await iniciarSesion('000000').catch((e) => e);
    expect(fallo).toBeInstanceOf(ErrorApi);
    expect(fallo.message).toBe('PIN incorrecto o sesión caducada.');
    expect(haySesion()).toBe(false);
  });

  it('deja pasar el aviso de demasiados intentos, en vez de decir «PIN incorrecto»', async () => {
    // Es la diferencia entre que alguien vuelva a probar el PIN —inútil, porque
    // está bloqueado— y que sepa que tiene que esperar un minuto.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respuesta(429, {
          ok: false,
          codigo: 'NO_AUTORIZADO',
          mensaje: 'Demasiados intentos. Vuelve a probar en 1 minuto.',
        })
      )
    );

    const fallo = await iniciarSesion('000000').catch((e) => e);
    expect(fallo.message).toMatch(/Demasiados intentos/);
    expect(fallo.status).toBe(429);
  });

  it('distingue un fallo de red de un PIN equivocado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('failed to fetch');
      })
    );

    const fallo = await iniciarSesion('482071').catch((e) => e);
    expect(fallo.esDeRed).toBe(true);
    expect(fallo.esSesionInvalida).toBe(false);
  });

  it('no da por buena una respuesta sin token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(200, { ok: true })));

    await expect(iniciarSesion('482071')).rejects.toBeInstanceOf(ErrorApi);
    expect(haySesion()).toBe(false);
  });
});

// ── Llamadas con sesión ─────────────────────────────────
describe('llamadas autenticadas', () => {
  it('envían el token, no ninguna credencial fija', async () => {
    sessionStorage.setItem('qr_asistencia_staff_token', 'un.token');
    const espia = vi.fn(async () => respuesta(200, { ok: true, participantes: [] }));
    vi.stubGlobal('fetch', espia);

    await fetchParticipantes();

    const [url, opciones] = espia.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/staff/participantes');
    expect((opciones.headers as Record<string, string>).Authorization).toBe('Bearer un.token');
  });

  it('piden el padrón reducido, no el del panel de administración', async () => {
    sessionStorage.setItem('qr_asistencia_staff_token', 'un.token');
    const espia = vi.fn(async () => respuesta(200, { ok: true, participantes: [] }));
    vi.stubGlobal('fetch', espia);

    await fetchParticipantes();

    expect(espia.mock.calls[0][0]).not.toContain('/api/admin/');
  });

  it('sin sesión no llegan a salir', async () => {
    const espia = vi.fn();
    vi.stubGlobal('fetch', espia);

    const fallo = await fetchParticipantes().catch((e) => e);
    expect(fallo.esSesionInvalida).toBe(true);
    expect(espia).not.toHaveBeenCalled();
  });

  it('un 401 olvida la sesión, para no seguir intentando con un token muerto', async () => {
    sessionStorage.setItem('qr_asistencia_staff_token', 'caducado');
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(401, { ok: false, mensaje: 'No autorizado.' })));

    const fallo = await marcarAsistenciaAPI('ENC-001').catch((e) => e);

    expect(fallo.esSesionInvalida).toBe(true);
    expect(haySesion()).toBe(false);
  });
});

describe('olvidarSesion', () => {
  it('deja el dispositivo sin credencial', () => {
    sessionStorage.setItem('qr_asistencia_staff_token', 'un.token');
    olvidarSesion();
    expect(haySesion()).toBe(false);
    expect(obtenerToken()).toBeNull();
  });
});
