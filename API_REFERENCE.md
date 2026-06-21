# Referencia de la API

La aplicación se comunica exclusivamente con el backend Serverless (Cloudflare Worker) de Encuadre 2026.

**URL Base:** `https://encuadre-2026-api.sitio-392.workers.dev`

## Autenticación
Todas las peticiones requieren un token de autenticación en los *Headers*:
`Authorization: Bearer <VITE_ADMIN_SECRET>`

---

## 1. Descargar Participantes
Descarga la totalidad de los registros para la búsqueda en memoria (caché local).

- **Endpoint:** `/api/admin/registros`
- **Método:** `GET`
- **Headers:** `Authorization: Bearer <TOKEN>`

**Respuesta Exitosa (200 OK)**
```json
{
  "registros": [
    {
      "id_participante": "ENC-001",
      "nombre": "Carlos Arenas",
      "taller": "Taller de UI/UX",
      "correo": "carlos@correo.com",
      "curp": "AAAA123456XXXXXX",
      "telefono": "4491234567",
      "institucion": "UAA",
      "perfil": "Estudiante",
      "fecha_asistencia": "2026-06-20T10:00:00Z",
      "asistio": true
    }
  ]
}
```

---

## 2. Marcar Asistencia
Registra definitivamente la asistencia de un participante escaneado o seleccionado manualmente.

- **Endpoint:** `/api/asistencia`
- **Método:** `POST`
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`

**Body:**
```json
{
  "id": "ENC-001"
}
```

**Respuesta Exitosa (200 OK)**
```json
{
  "success": true,
  "message": "Asistencia registrada correctamente"
}
```

*Nota: Si la red falla, la App QR no hace esta petición, encola la petición localmente y la reintenta usando este mismo endpoint cuando regresa la conexión.*
