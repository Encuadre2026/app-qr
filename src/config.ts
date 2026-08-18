export const API_URL = 'https://encuadre-2026-api.sitio-392.workers.dev';

// Aquí vivía `ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET`. Vite incrusta
// las variables `VITE_*` en el paquete que descarga el navegador, así que la
// credencial que abría el padrón completo —con CURP y teléfono—, la aprobación
// de pagos y el borrado de registros viajaba dentro de un archivo JavaScript
// público. Rotar el secreto no servía: el siguiente build lo volvía a incrustar.
//
// Ahora no hay ninguna credencial en el paquete. El personal teclea un PIN, el
// Worker lo canjea por un token de doce horas, y ese token vive en
// sessionStorage.

export const OFFLINE_QUEUE_KEY = 'qr_asistencia_offline_queue';

/** Token de staff de la sesión en curso. No es el PIN, y caduca. */
export const STAFF_TOKEN_KEY = 'qr_asistencia_staff_token';

export const SEARCH_DEBOUNCE_MS = 400;

/** Huecos del teclado numérico. Debe coincidir con lo que exige el Worker. */
export const LARGO_PIN = 6;
