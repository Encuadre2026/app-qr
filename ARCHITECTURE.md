# Arquitectura de App QR

La arquitectura de la **App QR - Encuadre 2026** está diseñada para ser resiliente a fallos de red y adaptada para dispositivos móviles (PWA). A continuación se documenta el diseño de sus componentes principales.

## Client-Side Rendering (CSR) con Vite
El proyecto usa Vite como empaquetador para generar una aplicación de una sola página (SPA). Todo el renderizado y la manipulación del DOM se hacen de forma manual en `src/main.ts` reduciendo la dependencia de librerías externas.

## Módulos y Flujo de Datos

1. **`src/main.ts` (Controlador UI):** 
   Escucha eventos del DOM (botones, teclado) y delega tareas complejas al resto de los módulos.
2. **`src/api.ts` (Capa de Datos y Red):** 
   Gestiona todas las peticiones fetch hacia el *Cloudflare Worker*. También maneja la lógica de caché offline a través de `localStorage`.
3. **`src/scanner.ts` (Hardware):** 
   Implementa `html5-qrcode`. Está aislado para poder ajustar el *framerate* y reducir el uso de CPU al escanear, evitando sobrecalentamiento.
4. **`src/utils.ts` (Utilerías Puras):** 
   Contiene funciones que no dependen del estado (por ejemplo, formatear fechas o limpiar cadenas de texto), lo que facilita su prueba mediante tests unitarios.

## Resiliencia Offline (Offline Queue)
Uno de los pilares de la arquitectura es su capacidad offline. Si el dispositivo pierde conexión al marcar una asistencia:
- El ID del asistente se almacena en el arreglo `OfflineQueueItem[]` en `localStorage`.
- Se muestra un icono indicador (⏳) al operador en la UI.
- Un evento `window.addEventListener('online')` se mantiene activo. En cuanto se detecta conexión, la función `syncOfflineQueue` procesa secuencialmente todas las asistencias pendientes hacia la base de datos de Neon.
