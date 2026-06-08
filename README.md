<div align="center">
  <h1>App QR - Encuadre 2026</h1>
  <p><b>Aplicación Web Progresiva (PWA) de alto rendimiento para el control de acceso y asistencia.</b></p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
  [![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](#)
  [![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](#)
</div>

---

## Descripción del Proyecto

Esta herramienta es de uso interno exclusivo para el **staff y organizadores** del evento *Encuadre 2026*. Permite escanear códigos QR de los gafetes de los participantes, buscar asistentes manualmente y sincronizar las asistencias con la base de datos principal alojada en **Cloudflare Workers**.

La aplicación fue reconstruida desde cero bajo un estándar riguroso, migrando de un entorno Vanilla JS monolítico a una arquitectura modular estricta con TypeScript, empaquetado optimizado con Vite, e integración continua (CI/CD).

## Características Principales

- **PWA Nativa:** Instalable en dispositivos móviles (iOS y Android) y de escritorio. Soporte completo offline gracias a Service Workers generados automáticamente por `vite-plugin-pwa`.
- **Escáner QR Optimizado:** Usa la cámara del dispositivo de forma nativa (`html5-qrcode`) con algoritmos de escaneo eficientes para evitar el calentamiento del dispositivo móvil.
- **Sincronización Offline:** Si la conexión a internet falla, guarda las asistencias de forma local usando una Offline Queue (Cola fuera de línea) y las sincroniza automáticamente al recuperar la red.
- **Búsqueda Instantánea:** Buscador en memoria *debounced* que permite encontrar asistentes por ID, nombre o evento sin demoras.
- **Tipado Estricto:** Código base 100% en TypeScript (`strict: true`), garantizando solidez durante el desarrollo y mantenimiento.

---

## Arquitectura de la Aplicación

La aplicación sigue una arquitectura puramente "Cliente" (*Client-Side Rendering*), pero su lógica está fuertemente modularizada:

```mermaid
graph TD
    A[UI / DOM Events<br/>(main.ts)] -->|Types| B(types.ts)
    A -->|Consume| C(api.ts)
    A -->|Controla| D(scanner.ts)
    C <-->|Peticiones| E[(Cloudflare API)]
    C <-->|Almacenamiento| F[(Offline Queue / LocalStorage)]
    D <-->|Cámara| G[Dispositivo Móvil]
```

## Instalación y Desarrollo Local

### Prerrequisitos
- **Node.js** v20 o superior.
- **npm** v10 o superior.

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/Encuadre2026/app-qr.git
   cd "app-qr"
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar el entorno**
   Copia el archivo de ejemplo y crea tu archivo `.env` local:
   ```bash
   cp .env.example .env
   ```
   *Agrega la clave administrativa en `VITE_ADMIN_SECRET` para poder hacer llamadas a la API.*

4. **Levantar el servidor de desarrollo**
   ```bash
   npm run dev
   ```
   El proyecto estará disponible en `http://localhost:5173/`. Vite se encargará de compilar TypeScript en tiempo real mediante HMR (Hot Module Replacement).

---

## Producción y Despliegue (CI/CD)

El proyecto cuenta con un pipeline automatizado a través de **GitHub Actions**.

1. Cualquier *push* o *merge* a la rama `main` dispara el flujo de trabajo (`.github/workflows/deploy.yml`).
2. El servidor CI instala dependencias (`npm ci`), verifica tipos y compila la app (`npm run build`).
3. Si el build es exitoso, los archivos estáticos de la carpeta `dist/` se publican automáticamente en **GitHub Pages** bajo el directorio base `/app-qr/`.

Para construir manualmente para producción:
```bash
npm run build
npm run preview # Para previsualizar el build generado
```

---

## Endpoints de la API (BFF)

La aplicación se comunica con un backend Serveless alojado en `encuadre-2026-api.sitio-392.workers.dev`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/admin/registros` | Descarga el listado total de participantes. Usado para poblar la caché de búsqueda manual en memoria. |
| `POST` | `/api/asistencia` | Envía el ID del participante para marcar su asistencia de forma definitiva en la base de datos principal. |

> **Nota:** Todos los endpoints requieren autenticación. La app enruta el token secret `VITE_ADMIN_SECRET` mediante un *Bearer Token* en el header `Authorization`.
