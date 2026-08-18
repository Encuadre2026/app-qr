# Solución de Problemas (Troubleshooting)

Esta guía ayuda a solucionar los problemas más frecuentes que podrían surgir al operar o desarrollar la App QR.

## 1. La cámara no abre o se queda en negro
- **Causa:** El navegador no tiene permisos, estás en HTTP en lugar de HTTPS (fuera de localhost), o el hardware de la cámara está en uso por otra app.
- **Solución:** Revisa los permisos del navegador en el icono del candado en la barra de direcciones. Asegúrate de estar accediendo a la versión segura `https://`. Si falla, cierra y vuelve a abrir el navegador.

## 2. No descarga la lista de participantes ("Cargando...")
- **Causa:** El secreto administrativo en `.env` es incorrecto o falta en los secretos de GitHub Actions. También podría deberse a una caída de la red en ese instante preciso.
- **Solución (Desarrollador):** El acceso ya no depende de ninguna variable de entorno. Si la app pide el PIN una y otra vez, comprueba que el secreto `STAFF_PIN` del Worker son seis dígitos exactos; si responde «Demasiados intentos», espera lo que indique el mensaje.

## 3. La interfaz se congeló en una versión anterior (PWA)
- **Causa:** El Service Worker está reteniendo agresivamente la versión vieja del sitio en caché.
- **Solución:** En móviles: Cierra por completo la PWA y ábrela de nuevo (suele disparar el autoUpdate). En Chrome de Escritorio: Abre DevTools (F12) > Application > Service Workers > "Update" o "Unregister" y recarga la página.

## 4. Las asistencias marcadas offline no se sincronizaron
- **Causa:** Se perdió la sesión, la pestaña se cerró forzosamente antes de recuperar la señal, o los datos de LocalStorage se corrompieron.
- **Solución:** Abre la pestaña en una zona con Wi-Fi estable. Revisa el contador naranja en la esquina superior; debería desaparecer cuando termine de enviar los datos encolados. Nunca borres el caché del celular si tienes asistencias pendientes de sincronizar.

## El despliegue falla con «El paquete contiene credenciales»

`npm run verificar` revisa el JavaScript compilado antes de publicarlo y aborta
si encuentra una credencial dentro. No es un falso positivo: lo que ese paso
mira es el archivo que descarga cualquiera que abra la app.

Casi siempre significa que alguien escribió `import.meta.env.VITE_ALGO` en una
cabecera de autorización. Vite sustituye esas variables por su valor **en tiempo
de compilación**, así que el secreto acaba en un archivo público —exactamente lo
que pasó con `VITE_ADMIN_SECRET` hasta agosto de 2026—.

La solución no es silenciar la comprobación ni renombrar la variable: es no
mandar credenciales al build. El acceso se obtiene tecleando el PIN, que el
Worker canjea por un token temporal guardado en `sessionStorage`.

## La app muestra una versión vieja

La pantalla del PIN enseña abajo la versión que está corriendo. Si un teléfono
no coincide con la desplegada, tiene la anterior en la caché del service worker.

Desde agosto de 2026 esto se corrige solo: al entrar una versión nueva, la app
se recarga sin que nadie haga nada, y comprueba si hay una cada vez que vuelve
al primer plano. Antes no lo hacía, y pasó lo siguiente: se desplegó el acceso
por PIN y en el teléfono seguía la versión anterior; cerrar la app y reabrirla
no bastó. Peor, esa versión vieja pedía el padrón con un secreto ya rotado, se
callaba el error y dejaba la lista vacía, de modo que **cualquier QR escaneado
salía como «no encontrado en la base de datos»**.

Si aun así hiciera falta forzarlo, la salida de emergencia es abrir la URL con
un parámetro cualquiera:

    https://encuadre2026.github.io/app-qr/?v=2

Ese parámetro no coincide con nada precacheado, así que obliga a ir a la red.
