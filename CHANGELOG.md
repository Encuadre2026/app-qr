# Changelog

Todos los cambios notables de la App QR serán documentados en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [2.0.0] - 2026-06-20

### Added
- **Arquitectura PWA**: Migración a Vite y PWA generada automáticamente con `vite-plugin-pwa`.
- **Migración de Backend**: Transición de Google Apps Script a API Serverless en Cloudflare Workers (Neon DB).
- **Tipado**: Integración de TypeScript estricto.
- **Offline Queue**: Sistema de cola de espera en `localStorage` para envíos retardados al perder conexión.
- **Despliegue**: Integración de CI/CD a través de GitHub Actions hacia GitHub Pages.

### Changed
- Reescritura de toda la interfaz y flujos bajo el paradigma de separación de responsabilidades (`main.ts`, `api.ts`, `scanner.ts`, `utils.ts`).
- Estandarización de toda la documentación (README, CONTRIBUTING, etc.) para igualar el nivel del proyecto central `Encuadre_2026`.

### Removed
- Eliminados los archivos monolíticos viejos (`app.js`, `sw.js`).
