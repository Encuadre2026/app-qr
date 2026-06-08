# App QR - Encuadre 2026

Aplicación Web Progresiva (PWA) de una sola página diseñada para llevar el control de asistencia del evento **Encuadre 2026**. 

Esta herramienta es de uso interno exclusivo para el **staff y organizadores**. Permite escanear códigos QR de los gafetes de los participantes, buscar asistentes manualmente y sincronizar las asistencias con la base de datos principal en Cloudflare.

## Características Principales
* **PWA:** Instalable en dispositivos móviles (iOS y Android) para acceso rápido.
* **Escáner QR integrado:** Usa la cámara del dispositivo (`html5-qrcode`) para una validación veloz.
* **Modo Offline:** Si la conexión a internet falla, guarda las asistencias de forma local y las sincroniza automáticamente al recuperar la red.
* **Búsqueda Manual:** Buscador ultrarrápido (en memoria) por nombre o ID del participante.

---

## Levantar el proyecto en local

La aplicación requiere acceso a la cámara web. Por medidas de seguridad de los navegadores (Chrome, Safari, etc.), el acceso a la cámara **solo está permitido en contextos seguros (HTTPS)** o en `localhost`.

Para probarlo desde tu celular conectado a la misma red local que tu computadora, hemos incluido un script en Python que levanta un servidor HTTPS local.

### Prerrequisitos
- Python 3.x
- OpenSSL instalado (o Git Bash en Windows, que incluye OpenSSL).

### Instrucciones
1. Abre tu terminal en la carpeta del proyecto.
2. Ejecuta el servidor:
   ```bash
   python server.py
   ```
3. El script autogenerará un certificado SSL (`_cert.pem` y `_key.pem`) para poder servir HTTPS.
4. En tu celular, navega a la URL que indique la consola (ej. `https://192.168.1.10:8443`).
5. **Nota:** Tu navegador advertirá que la conexión "no es segura" porque el certificado es autofirmado. Debes omitir la advertencia y darle a "Proceder a 192.168.x.x".

---

## Conexión a la API (Cloudflare Workers)

La aplicación se comunica con una API externa alojada en Cloudflare Workers (`https://encuadre-2026-api.sitio-392.workers.dev`).

### Endpoints principales:
- `GET /api/admin/registros`: Descarga el listado inicial de participantes para la búsqueda y caché local.
- `POST /api/asistencia`: Envía el registro de asistencia confirmada de un participante.

> **⚠️ Advertencia de Seguridad Actual:**  
> Actualmente, la clave de administración (`ADMIN_SECRET`) se encuentra escrita "en duro" (hardcoded) dentro del archivo `app.js`. Esto es un riesgo de seguridad en entornos de producción públicos. Para un despliegue real, esta validación debe trasladarse a un servidor backend o manejarse mediante tokens de sesión dinámicos.

---

## Despliegue en Producción
Debido a que es un proyecto puramente basado en archivos estáticos (HTML, CSS, JS), puede alojarse de forma gratuita y con HTTPS en plataformas como:
* GitHub Pages
* Cloudflare Pages
* Vercel
* Netlify

Al subir los archivos a cualquiera de estas plataformas, asegúrate de que el archivo `manifest.json` y `sw.js` se sirvan correctamente para que el dispositivo reconozca la aplicación como una PWA instalable.
