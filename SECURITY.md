# Seguridad

Este documento describe los mecanismos implementados en la **App QR** para mantener la seguridad y confidencialidad de los datos.

## 1. Ninguna credencial dentro del paquete

Hasta agosto de 2026 esta app se autenticaba con `VITE_ADMIN_SECRET`, inyectado
en tiempo de compilación. Vite incrusta las variables `VITE_*` en el paquete que
descarga el navegador, así que el secreto que abría el padrón completo —con
CURP, teléfono y correo—, la aprobación de pagos y el borrado de registros
viajaba dentro de un archivo JavaScript público. Se comprobó descargándolo.
Aquella nota decía que el riesgo se mitigaba porque el código «se empaqueta con
Vite Rollup» y porque la app «solo debe ser usada por personal autorizado»:
ninguna de las dos cosas impide que alguien abra la URL y lea el archivo.

Hoy **no hay ninguna credencial en el paquete**. El personal teclea un PIN, el
Worker lo valida contra un secreto que nunca sale del servidor y devuelve un
token de doce horas que vive en `sessionStorage`.

## 2. Acceso por PIN

El PIN son seis dígitos y **no está en el código**: antes se comparaba con
`pin === '2026'`, escrito en el fuente y por tanto también público.

- Se envía a `POST /api/staff/sesion`, que lo valida y devuelve el token.
- El PIN no se guarda en el dispositivo; el token sí, en `sessionStorage`
  (llave `qr_asistencia_staff_token`), de modo que cerrar la pestaña revoca el
  acceso.
- El Worker limita los intentos por origen: los cinco primeros fallos se
  perdonan y a partir de ahí la espera se dobla hasta un tope de una hora.

## 3. Lo que el token alcanza

Solo `GET /api/staff/participantes` y `POST /api/asistencia`. Esa lectura **no
devuelve CURP, teléfono ni correo**, y no da acceso a aprobar pagos, borrar
registros ni descargar comprobantes. Si un dispositivo se pierde con la sesión
abierta, lo que queda expuesto son nombres, talleres e instituciones.

## 4. Trusted Types y CSP
Por herencia del ecosistema del proyecto principal, la aplicación PWA y el servidor Cloudflare Workers aplican políticas CORS estrictas.
- Solo los orígenes configurados en el backend (ej. `futurologiaencuadre-2026.com` y `encuadre2026.github.io`) pueden realizar peticiones exitosas. Las peticiones desde dominios extraños o scripts inyectados fallarán por políticas de mismo origen.
