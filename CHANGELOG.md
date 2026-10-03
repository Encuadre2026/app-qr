# Changelog

Todos los cambios notables de la App QR serán documentados en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

### Seguridad

- **Solo entra quien tiene el pago aprobado.** La app daba por buena a cualquiera
  del padrón, y en el padrón está todo el que se pre-registró. El Worker
  responde ahora 409 `PAGO_PENDIENTE` a quien no tiene el pago —o la
  acreditación de la asamblea— aprobado, y la app lo enseña con un aviso propio
  que manda a la mesa de registro. El padrón trae `pago_aprobado`: la lista y
  la ficha dicen «Sin aprobar», y sin red no se encola a quien no lo está.

### Corregido

- **La hora de asistencia ya no sale seis horas adelantada.** La marca de D1
  («2026-10-29 15:00:00», UTC sin zona) se leía como hora local. Una fecha
  ilegible ya no se pinta como «NaN/NaN/NaN».
- **La cola sin conexión no reintenta para siempre** lo que el servidor rechaza
  de forma definitiva (404, 409), **no pierde** un escaneo encolado mientras
  sincroniza y no envía dos veces cuando coinciden dos sincronizaciones.
- La referencia de la API describía un padrón con CURP, teléfono y correo, y el
  contrato viejo `success`/`message`.

- **Quien se inscribe después de teclear el PIN ya no sale «no encontrado».**
  El padrón se cargaba una sola vez, al entrar, y la sesión dura doce horas: al
  escanear el QR de alguien inscrito después —por ejemplo, en un taller recién
  agregado desde el panel— la app decía «ID no encontrado en la base de datos»
  aunque el registro existiera. Ahora, ante un ID que no tiene, pide el padrón
  otra vez antes de rechazarlo. Sin red se comporta como antes.
- **Los cambios del panel llegan sin volver a entrar.** Al volver a la app
  —después de contestar un mensaje, por ejemplo— se pide el padrón otra vez,
  como mucho una vez por minuto, así que un taller renombrado aparece con su
  nombre nuevo. Dos cargas que coinciden se juntan en una sola petición.

### Seguridad

- **Ninguna credencial dentro del paquete.** La app se autenticaba con
  `VITE_ADMIN_SECRET`, y Vite incrusta las variables `VITE_*` en el JavaScript
  que descarga el navegador: el archivo publicado contenía un literal de 23
  caracteres detrás de `Authorization: Bearer`, y con él quedaban abiertos el
  padrón completo —nombre, correo, CURP y teléfono—, la aprobación de pagos, el
  borrado de registros y la descarga de comprobantes. Rotar el secreto no
  servía: el siguiente build lo volvía a incrustar.
- **El PIN deja de estar en el código.** Era `pin === '2026'`, el año del
  evento, escrito en el fuente y por tanto también público. Ahora son seis
  dígitos que se envían a `POST /api/staff/sesion`, que los valida contra un
  secreto del servidor y devuelve un token de 12 h en `sessionStorage`. El
  Worker limita los intentos por origen.
- **Padrón reducido.** Los datos vienen de `/api/staff/participantes`, que no
  devuelve CURP, teléfono ni correo. La ficha del participante muestra taller,
  institución y perfil. La palabra CURP ya no aparece en el paquete compilado.
- `scripts/revisar-paquete.mjs` revisa el JavaScript compilado antes de publicar
  y falla si encuentra una cabecera de autorización con un valor fijo o una
  variable `VITE_*` que huela a credencial.

### Corregido

- **La app se actualiza sola.** El service worker servía la versión cacheada y
  cerrar y reabrir no bastaba. Combinado con lo anterior, un dispositivo con la
  versión vieja pedía el padrón con el secreto ya rotado, se callaba el 401 y
  dejaba la lista vacía: **cualquier QR escaneado salía como «no encontrado en
  la base de datos»**. Ahora se recarga al entrar una versión nueva y pregunta
  por una cada vez que vuelve al primer plano.
- **Marcar asistencia distingue por qué falló.** Trataba cualquier fallo como
  «guardado sin conexión»: una sesión caducada o un participante inexistente se
  encolaban y se le decía al personal que había quedado registrado, con una cola
  que no iba a vaciarse nunca. Ahora solo se encola lo que falló por red.
- **La cola sin conexión ya no se reenvía entera.** Se lanzaba con
  `Promise.all` y bastaba que una fallara para conservarla completa, así que las
  ya registradas se reintentaban en cada sincronización.

### Añadido

- La pantalla del PIN muestra la versión que está corriendo, con la fecha de
  compilación, para poder diagnosticar un teléfono a distancia.
- Verificación en cada pull request y como puerta antes de publicar: tipos,
  pruebas y revisión del paquete compilado. Hasta ahora el workflow solo
  compilaba, y las pruebas que existían no las ejecutaba nadie.

## [2.0.0] - 2026-06-20

### Added
- **Arquitectura PWA**: Migración a Vite y PWA generada automáticamente con `vite-plugin-pwa`.
- **Migración de Backend**: Transición de Google Apps Script a API Serverless en Cloudflare Workers (D1).
- **Tipado**: Integración de TypeScript estricto.
- **Offline Queue**: Sistema de cola de espera en `localStorage` para envíos retardados al perder conexión.
- **Despliegue**: Integración de CI/CD a través de GitHub Actions hacia GitHub Pages.

### Changed
- Reescritura de toda la interfaz y flujos bajo el paradigma de separación de responsabilidades (`main.ts`, `api.ts`, `scanner.ts`, `utils.ts`).
- Estandarización de toda la documentación (README, CONTRIBUTING, etc.) para igualar el nivel del proyecto central `Encuadre_2026`.

### Removed
- Eliminados los archivos monolíticos viejos (`app.js`, `sw.js`).
