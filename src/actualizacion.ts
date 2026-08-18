/**
 * Mantener la app al día en el teléfono del personal.
 *
 * El 18 de agosto de 2026 se desplegó una versión que cambiaba el acceso —PIN de
 * seis dígitos contra el servidor en vez de uno escrito en el código— y en el
 * teléfono seguía apareciendo la anterior. Cerrar la app y volver a abrirla no
 * bastó: hizo falta forzar la URL con un parámetro para saltarse la caché.
 *
 * Y no era solo una molestia. La versión vieja pedía el padrón con un secreto
 * que ya se había rotado, se callaba el 401 y dejaba la lista vacía, de modo que
 * cualquier QR escaneado salía como «no encontrado en la base de datos». En la
 * puerta, el 29 de octubre, con gente esperando, eso es una avería.
 *
 * La causa es que `registerSW.js` solo registra el service worker: cuando entra
 * una versión nueva, esta toma el control pero la página que ya está cargada
 * sigue ejecutando el código viejo hasta que alguien la recargue. Aquí se cierra
 * ese hueco.
 */

/**
 * ¿Hay que recargar al cambiar el service worker que controla la página?
 *
 * Solo si ya había uno antes. En la primera visita no existe controlador, el
 * service worker recién instalado reclama la página y `controllerchange` se
 * dispara igual: recargar ahí sería un parpadeo gratuito nada más abrir.
 */
export function debeRecargar(habiaControlador: boolean, yaRecargando: boolean): boolean {
  return habiaControlador && !yaRecargando;
}

export function vigilarActualizaciones(): void {
  if (!('serviceWorker' in navigator)) return;

  const habiaControlador = Boolean(navigator.serviceWorker.controller);
  let yaRecargando = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!debeRecargar(habiaControlador, yaRecargando)) return;
    yaRecargando = true;
    window.location.reload();
  });

  // Un teléfono en la puerta puede pasar el día entero con la app abierta, y
  // entonces no hay ninguna carga de página que dispare la comprobación. Cada
  // vez que vuelve al primer plano se pregunta por una versión nueva.
  const comprobar = () => {
    if (document.visibilityState !== 'visible') return;
    navigator.serviceWorker.getRegistration().then((registro) => registro?.update());
  };

  document.addEventListener('visibilitychange', comprobar);
  comprobar();
}

/** Versión que está corriendo. Se inyecta al compilar. */
export const VERSION: string = __VERSION_APP__;
