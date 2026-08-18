# Guía de Despliegue (CI/CD)

La publicación de la **App QR** está 100% automatizada usando GitHub Actions y GitHub Pages. No es necesario realizar despliegues manuales (como conectarse a servidores o subir archivos por FTP).

## Requisitos de Entorno en GitHub

Para que el proceso de *build* se ejecute exitosamente, GitHub requiere que configures las variables de entorno necesarias para la aplicación Vite.

1. Ve a **Settings** > **Secrets and variables** > **Actions** en tu repositorio de GitHub.
2. Agrega el siguiente secreto (Repository Secret):
   - Ninguno. El build ya no recibe credenciales: el acceso se obtiene tecleando el PIN,
     que el Worker canjea por un token temporal. El secreto `VITE_ADMIN_SECRET` del
     repositorio se puede borrar.

## Pipeline de Despliegue (`.github/workflows/deploy.yml`)

1. **Disparador:** El Action se dispara automáticamente cuando hay un *push* a la rama `main`, o manualmente mediante `workflow_dispatch`.
2. **Instalación:** El servidor Ubuntu clona el repositorio, configura Node.js 20 y ejecuta `npm ci` para instalar exactamente las dependencias del `package-lock.json`.
3. **Construcción (Build):** Se ejecuta `npm run build`. Vite minifica el código TypeScript y empaqueta la PWA. No se inyecta ningún secreto: cualquier variable `VITE_*` acabaría dentro del paquete público.
4. **Publicación:** Los archivos compilados que caen en la carpeta `/dist/` se suben a GitHub Pages de forma transparente.

## Estructura de GitHub Pages
Debido a que está hospedada en `usuario.github.io/app-qr`, el archivo `vite.config.ts` tiene la propiedad `base: '/app-qr/'` para garantizar que los enlaces relativos funcionen correctamente en producción.
