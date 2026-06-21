# Guía de Despliegue (CI/CD)

La publicación de la **App QR** está 100% automatizada usando GitHub Actions y GitHub Pages. No es necesario realizar despliegues manuales (como conectarse a servidores o subir archivos por FTP).

## Requisitos de Entorno en GitHub

Para que el proceso de *build* se ejecute exitosamente, GitHub requiere que configures las variables de entorno necesarias para la aplicación Vite.

1. Ve a **Settings** > **Secrets and variables** > **Actions** en tu repositorio de GitHub.
2. Agrega el siguiente secreto (Repository Secret):
   - `VITE_ADMIN_SECRET`: (La misma clave maestra que se usa para el backend).

## Pipeline de Despliegue (`.github/workflows/deploy.yml`)

1. **Disparador:** El Action se dispara automáticamente cuando hay un *push* a la rama `main`, o manualmente mediante `workflow_dispatch`.
2. **Instalación:** El servidor Ubuntu clona el repositorio, configura Node.js 20 y ejecuta `npm ci` para instalar exactamente las dependencias del `package-lock.json`.
3. **Construcción (Build):** Se ejecuta `npm run build`. Vite minifica el código TypeScript y empaqueta la PWA inyectando el valor de `VITE_ADMIN_SECRET` en el código.
4. **Publicación:** Los archivos compilados que caen en la carpeta `/dist/` se suben a GitHub Pages de forma transparente.

## Estructura de GitHub Pages
Debido a que está hospedada en `usuario.github.io/app-qr`, el archivo `vite.config.ts` tiene la propiedad `base: '/app-qr/'` para garantizar que los enlaces relativos funcionen correctamente en producción.
