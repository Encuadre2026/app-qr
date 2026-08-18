import { describe, it, expect } from 'vitest';
import { debeRecargar } from '../src/actualizacion';

/**
 * Cuándo hay que recargar al entrar una versión nueva.
 *
 * El 18 de agosto de 2026 se desplegó el acceso nuevo y en el teléfono seguía
 * la versión anterior: cerrar la app y reabrirla no bastó, hubo que forzar la
 * URL con un parámetro para saltarse la caché. Peor aún, esa versión vieja
 * pedía el padrón con un secreto ya rotado, se callaba el 401 y dejaba la lista
 * vacía, así que cualquier QR salía como «no encontrado».
 */
describe('debeRecargar', () => {
  it('recarga cuando el service worker cambia habiendo uno antes', () => {
    // Es el caso real: la app estaba instalada, entra una versión nueva, la
    // toma el control y la página tiene que dejar de ejecutar el código viejo.
    expect(debeRecargar(true, false)).toBe(true);
  });

  it('no recarga en la primera visita', () => {
    // Sin controlador previo, `controllerchange` también se dispara: es el
    // service worker recién instalado reclamando la página. Recargar ahí sería
    // un parpadeo gratuito nada más abrir.
    expect(debeRecargar(false, false)).toBe(false);
  });

  it('no recarga dos veces', () => {
    // Sin esta guarda, dos eventos seguidos encadenan recargas.
    expect(debeRecargar(true, true)).toBe(false);
  });
});
