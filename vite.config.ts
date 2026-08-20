// `defineConfig` viene de `vitest/config`, no de `vite`: el de vite no conoce
// la clave `test` y el typecheck la rechaza.
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// La versión visible en la app. Sirve para saber de un vistazo —y por teléfono,
// preguntándoselo a quien está en la puerta— si un dispositivo quedó con una
// versión vieja en caché, que es exactamente lo que costó una tarde averiguar.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
const SELLO = `${version}+${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  base: '/app-qr/',
  define: {
    __VERSION_APP__: JSON.stringify(SELLO),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Asistencia QR Encuadre',
        short_name: 'Asistencia',
        description: 'App de registro de asistencia por QR para Encuadre 2026',
        theme_color: '#050508',
        background_color: '#050508',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
