# Seguridad

Este documento describe los mecanismos implementados en la **App QR** para mantener la seguridad y confidencialidad de los datos.

## 1. Protección del Secreto Administrativo
El token `VITE_ADMIN_SECRET` se inyecta en tiempo de compilación. Puesto que es una aplicación PWA *Client-Side*, el secreto reside en el bundle de Javascript minificado. Para mitigar riesgos:
- El código no se ofusca fuertemente pero sí se empaqueta con Vite Rollup.
- El servidor Cloudflare Workers verifica estrictamente este *Bearer Token*.
- La aplicación **solo debe ser distribuida y usada por personal autorizado** (Staff del evento).

## 2. Acceso por PIN
Para añadir una capa de seguridad física, al abrir la aplicación se requiere introducir un **PIN local**.
- El PIN correcto permite el ingreso a la interfaz.
- La sesión del PIN se guarda en `sessionStorage` (llave: `qr_asistencia_pin_ok`), por lo que al cerrar la pestaña se revoca el acceso y se requerirá el PIN nuevamente al reabrir.

## 3. Trusted Types y CSP
Por herencia del ecosistema del proyecto principal, la aplicación PWA y el servidor Cloudflare Workers aplican políticas CORS estrictas.
- Solo los orígenes configurados en el backend (ej. `futurologiaencuadre-2026.com` y `encuadre2026.github.io`) pueden realizar peticiones exitosas. Las peticiones desde dominios extraños o scripts inyectados fallarán por políticas de mismo origen.
