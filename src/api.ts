import { API_URL, OFFLINE_QUEUE_KEY, STAFF_TOKEN_KEY } from './config';
import { RegistrosResponse, OfflineQueueItem, RespuestaDeAsistencia } from './types';

/**
 * Un error de la API, con el código que permite distinguirlo.
 *
 * El Worker responde con un contrato uniforme: toda respuesta lleva `ok`, y los
 * errores además `codigo` y `mensaje`. Antes esta capa lanzaba
 * `new Error('Error de red al obtener participantes')` para cualquier fallo, así
 * que un token caducado, un acceso bloqueado por demasiados intentos y un cable
 * desconectado se veían exactamente igual.
 */
export class ErrorApi extends Error {
  codigo?: string;
  status: number;

  constructor(mensaje: string, codigo?: string, status = 0) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    this.status = status;
  }

  /** La sesión caducó o el token dejó de valer: hay que volver a teclear el PIN. */
  get esSesionInvalida(): boolean {
    return this.status === 401;
  }

  /** No se pudo hablar con el servidor. Es lo que activa la cola sin conexión. */
  get esDeRed(): boolean {
    return this.status === 0;
  }
}

// ── Sesión ──────────────────────────────────────────────

export function obtenerToken(): string | null {
  return sessionStorage.getItem(STAFF_TOKEN_KEY);
}

export function haySesion(): boolean {
  return Boolean(obtenerToken());
}

export function olvidarSesion(): void {
  sessionStorage.removeItem(STAFF_TOKEN_KEY);
}

interface CuerpoApi {
  ok?: boolean;
  codigo?: string;
  mensaje?: string;
  message?: string;
  token?: string;
  reintentarEn?: number;
  [clave: string]: unknown;
}

async function leerCuerpo(res: Response): Promise<CuerpoApi | null> {
  try {
    return (await res.json()) as CuerpoApi;
  } catch {
    // Un cuerpo ilegible no debe tapar el estado, que sí es informativo.
    return null;
  }
}

function errorDe(cuerpo: CuerpoApi | null, status: number): ErrorApi {
  const mensaje = cuerpo?.mensaje || cuerpo?.message || 'No se pudo completar la operación.';
  return new ErrorApi(mensaje, cuerpo?.codigo, status);
}

/**
 * Canjea el PIN por un token de staff.
 *
 * El PIN no se guarda en ningún sitio: se envía, se obtiene el token y se
 * olvida. Lo que persiste es el token, en sessionStorage, y caduca solo.
 */
export async function iniciarSesion(pin: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/staff/sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
  } catch {
    throw new ErrorApi('Sin conexión con el servidor. Revisa la red.');
  }

  const cuerpo = await leerCuerpo(res);
  if (!res.ok || cuerpo?.ok === false) throw errorDe(cuerpo, res.status);
  if (!cuerpo?.token) throw new ErrorApi('El servidor no devolvió una sesión válida.');

  sessionStorage.setItem(STAFF_TOKEN_KEY, cuerpo.token);
}

/** Llama a la API con el token de staff. Ante un 401 olvida la sesión. */
async function pedir(ruta: string, opciones: RequestInit = {}): Promise<CuerpoApi> {
  const token = obtenerToken();
  if (!token) throw new ErrorApi('Tu sesión expiró. Vuelve a introducir el PIN.', undefined, 401);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new ErrorApi('Sin conexión con el servidor.');
  }

  const cuerpo = await leerCuerpo(res);

  if (res.status === 401) {
    // Seguir con un token que ya no vale solo produce más errores.
    olvidarSesion();
    throw new ErrorApi('Tu sesión expiró. Vuelve a introducir el PIN.', 'NO_AUTORIZADO', 401);
  }

  if (!res.ok || cuerpo?.ok === false) throw errorDe(cuerpo, res.status);
  return cuerpo || {};
}

/**
 * Padrón reducido para pasar lista.
 *
 * Antes se pedía `/api/admin/registros`, que devuelve CURP, teléfono y correo
 * de todo el mundo. Esta ruta no los trae: lo que queda en el teléfono del
 * personal son nombres, talleres e instituciones.
 */
export async function fetchParticipantes(): Promise<RegistrosResponse> {
  const cuerpo = await pedir('/api/staff/participantes');
  return {
    participantes: (cuerpo.participantes as RegistrosResponse['participantes']) || [],
    // La espera entre dos asistencias la dice el Worker, que es donde se
    // configura. Si no viene —un Worker anterior—, `minutosDeEspera` pone la de
    // por defecto.
    minutos_entre_asistencias: cuerpo.minutos_entre_asistencias as number | undefined,
  };
}

/**
 * Anota una asistencia y devuelve lo que contestó el Worker.
 *
 * Antes se descartaba la respuesta: bastaba con que no fallara, porque la
 * asistencia era un sí o no. Ahora trae el recuento y, si el escaneo cayó dentro
 * de la espera, un `duplicado: true` con los minutos que faltan; eso no es un
 * error —el servidor contesta 200— y es lo que la app tiene que enseñar.
 */
export async function marcarAsistenciaAPI(id: string): Promise<RespuestaDeAsistencia> {
  return (await pedir('/api/asistencia', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })) as RespuestaDeAsistencia;
}

// ── Lógica Offline ──

export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function addToOfflineQueue(item: OfflineQueueItem): void {
  const queue = getOfflineQueue();
  // Un id, una entrada. Ahora que a la misma persona se le puede pasar lista
  // varias veces esto podría parecer una pérdida, y no lo es: la cola se vacía
  // de una vez, así que dos escaneos suyos saldrían con segundos de diferencia
  // y el segundo caería dentro de la espera del Worker igual.
  if (!queue.find((q) => q.id === item.id)) {
    queue.push(item);
    saveOfflineQueue(queue);
  }
}

/**
 * Un rechazo del servidor que no cambia por reintentarlo: cualquier 4xx salvo
 * la sesión caducada (401, que se arregla volviendo a teclear el PIN) y el 429
 * de «espera un poco».
 */
export function esRechazoDefinitivo(e: ErrorApi): boolean {
  return e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429;
}

/**
 * Envía lo que quedó pendiente por falta de red.
 *
 * Se envían de uno en uno y se van quitando los que sí entran. Antes se
 * lanzaban todos a la vez con `Promise.all` y bastaba con que uno fallara para
 * conservar la cola entera, de modo que los que sí se habían registrado se
 * reintentaban en cada sincronización.
 *
 * Al terminar no se guarda la lista que se leyó al empezar, sino la cola de
 * ese momento sin los que ya se resolvieron: un escaneo encolado mientras esto
 * corría —la red que va y viene en la puerta— se perdía al sobrescribirla.
 */
let sincronizando: Promise<void> | null = null;

export function syncOfflineQueue(onUpdateBadge: () => void): Promise<void> {
  // Volver a la app y recuperar la red disparan esto a la vez. Dos pasadas
  // simultáneas enviaban cada escaneo dos veces y se pisaban al guardar.
  sincronizando ??= sincronizar(onUpdateBadge).finally(() => {
    sincronizando = null;
  });
  return sincronizando;
}

async function sincronizar(onUpdateBadge: () => void): Promise<void> {
  const queue = getOfflineQueue();
  if (queue.length === 0 || !navigator.onLine || !haySesion()) return;

  const resueltos = new Set<string>();
  for (const item of queue) {
    try {
      await marcarAsistenciaAPI(item.id);
      resueltos.add(item.id);
    } catch (e) {
      // Si la sesión caducó no tiene sentido seguir intentando con el resto:
      // se conserva todo lo que falta para cuando se vuelva a entrar.
      if (e instanceof ErrorApi && e.esSesionInvalida) break;
      // Un rechazo definitivo —el participante ya no existe (404) o su pago no
      // está aprobado (409)— no se arregla reintentando, y antes se quedaba en
      // la cola para siempre, con la insignia de «pendientes» encendida todo el
      // día. Solo se conserva lo que puede salir bien más tarde: la red caída
      // y los fallos del servidor.
      if (e instanceof ErrorApi && esRechazoDefinitivo(e)) {
        console.warn(`Se descarta de la cola ${item.id}: ${e.message}`);
        resueltos.add(item.id);
      }
    }
  }

  saveOfflineQueue(getOfflineQueue().filter((q) => !resueltos.has(q.id)));
  onUpdateBadge();
}
