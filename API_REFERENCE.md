# Referencia de la API

La aplicación se comunica exclusivamente con el Worker de Encuadre 2026. La
referencia completa vive en el repositorio del backend
([API_REFERENCE.md](https://github.com/Encuadre2026/Encuadre_2026/blob/main/API_REFERENCE.md));
aquí está solo lo que usa esta app.

**URL base:** `VITE_API_URL`, y si no está definida
`https://encuadre-2026-api.sitio-392.workers.dev`.

Toda respuesta lleva `ok`; los errores llevan además `codigo` —estable, para que
la app decida sin comparar textos— y `mensaje`, el texto que se le enseña al
personal.

## Autenticación

`POST /api/staff/sesion` canjea el PIN de seis dígitos por un token de 12 horas,
que se guarda en `sessionStorage`. Las demás peticiones lo envían en
`Authorization: Bearer <token>`. Un 401 significa que el token caducó: la app
vuelve al teclado del PIN. Un 429 significa demasiados intentos desde esa
conexión, y trae `reintentarEn`.

---

## 1. Padrón para pasar lista

`GET /api/staff/participantes`

Padrón reducido: **sin CURP, teléfono ni correo**. La app lo guarda en memoria
para buscar sin red y lo vuelve a pedir al volver a primer plano (como mucho una
vez por minuto) y ante un ID que no tiene.

```json
{
  "ok": true,
  "participantes": [
    {
      "id_participante": "ENC-001",
      "nombre": "Carlos Arenas",
      "taller": "Futurología aplicada al diseño",
      "institucion": "UAA · Universidad Autónoma de Aguascalientes",
      "perfil": "Estudiante",
      "pago_aprobado": true,
      "asistio": true,
      "fecha_asistencia": "2026-10-29 15:00:00"
    }
  ]
}
```

- `pago_aprobado` dice si el pago —o la acreditación, en la asamblea— está
  aprobado. Un Worker anterior a octubre de 2026 no lo manda; entonces la app da
  a todos por aprobados, que es lo que hacía siempre, y con red decide el
  servidor de todos modos.
- `fecha_asistencia` llega como la escribe D1: en **UTC y sin marca de zona**.
  La app la lee como UTC (`desdeLaApi` en `src/utils.ts`); leída como hora local
  salía seis horas adelantada.

---

## 2. Marcar asistencia

`POST /api/asistencia` con `{ "id": "ENC-001" }`

| Respuesta               | Qué significa                                     | Qué hace la app                             |
| ----------------------- | ------------------------------------------------- | ------------------------------------------- |
| 200, `duplicado: false` | Entró                                             | «Asistencia registrada ✓»                   |
| 200, `duplicado: true`  | Ya había entrado                                  | «Ya registrado previamente»                 |
| 409, `PAGO_PENDIENTE`   | Su pago o acreditación no está aprobado; no entra | Aviso rojo: enviarlo a la mesa de registro  |
| 404                     | No existe ese participante                        | Error                                       |
| 401                     | La sesión caducó                                  | Vuelve al PIN                               |
| Sin respuesta (red)     | No se sabe                                        | Si estaba aprobado, se encola; si no, aviso |

**Sin conexión** solo se encola a quien el último padrón da por aprobado. A
quien no, la app le dice que no se puede comprobar y lo manda a la mesa de
registro: dejarlo pasar y registrarlo después sería lo mismo que no mirar.

La cola se envía en cuanto vuelve la red. Lo que el servidor rechaza para
siempre —un 404, un 409— se descarta en vez de reintentarse sin fin; lo que
puede salir bien más tarde —la red, un 5xx— se conserva.
