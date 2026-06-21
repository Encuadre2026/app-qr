# Solución de Problemas (Troubleshooting)

Esta guía ayuda a solucionar los problemas más frecuentes que podrían surgir al operar o desarrollar la App QR.

## 1. La cámara no abre o se queda en negro
- **Causa:** El navegador no tiene permisos, estás en HTTP en lugar de HTTPS (fuera de localhost), o el hardware de la cámara está en uso por otra app.
- **Solución:** Revisa los permisos del navegador en el icono del candado en la barra de direcciones. Asegúrate de estar accediendo a la versión segura `https://`. Si falla, cierra y vuelve a abrir el navegador.

## 2. No descarga la lista de participantes ("Cargando...")
- **Causa:** El secreto administrativo en `.env` es incorrecto o falta en los secretos de GitHub Actions. También podría deberse a una caída de la red en ese instante preciso.
- **Solución (Desarrollador):** Verifica que tienes `VITE_ADMIN_SECRET` con el valor exacto en el archivo `.env`. Si es la versión en producción, verifica los *Repository Secrets*.

## 3. La interfaz se congeló en una versión anterior (PWA)
- **Causa:** El Service Worker está reteniendo agresivamente la versión vieja del sitio en caché.
- **Solución:** En móviles: Cierra por completo la PWA y ábrela de nuevo (suele disparar el autoUpdate). En Chrome de Escritorio: Abre DevTools (F12) > Application > Service Workers > "Update" o "Unregister" y recarga la página.

## 4. Las asistencias marcadas offline no se sincronizaron
- **Causa:** Se perdió la sesión, la pestaña se cerró forzosamente antes de recuperar la señal, o los datos de LocalStorage se corrompieron.
- **Solución:** Abre la pestaña en una zona con Wi-Fi estable. Revisa el contador naranja en la esquina superior; debería desaparecer cuando termine de enviar los datos encolados. Nunca borres el caché del celular si tienes asistencias pendientes de sincronizar.
