# Guía de Contribución

¡Gracias por tu interés en contribuir a la **App QR - Encuadre 2026**! 

El proyecto debe mantener los mismos estándares de código, seguridad y calidad que el backend central `Encuadre_2026`. Este documento describe las convenciones de trabajo para mantener la integridad del ecosistema.

## Flujo de Trabajo (Git Flow)

1. **Clona y crea una rama:**
   Nunca trabajes directamente en la rama `main`. Usa la siguiente nomenclatura:
   - Nuevas funciones: `feat/nombre-de-la-funcion`
   - Corrección de errores: `fix/descripcion-del-error`
   - Documentación: `docs/actualizacion-readme`
   - Tareas técnicas (tests/build): `chore/actualizacion-dependencias` o `test/nuevas-pruebas`

   ```bash
   git checkout -b feat/mejorar-feedback-haptico
   ```

2. **Trabaja en tus cambios:**
   - Asegúrate de tener el entorno ejecutándose mediante `npm run dev`.
   - Verifica tus tipos. **Está prohibido** el uso de `// @ts-nocheck` o tipos `any`.
   - Si creas utilidades nuevas, añade su prueba unitaria correspondiente en `tests/`.

3. **Haz commits claros (Conventional Commits):**
   ```text
   feat: agrega validación de curp al buscar participante
   fix: corrige sincronización de cola offline al reconectar
   docs: estandariza README con el proyecto central
   test: agrega cobertura para formatearFecha en utils
   ```

4. **Sube tu rama y crea un Pull Request (PR):**
   - Corre `npm run verificar` antes de empujar. Es lo mismo que ejecuta CI:
     tipos, pruebas, compilación y revisión del paquete compilado.
   - Ese último paso comprueba que no haya credenciales dentro del JavaScript
     publicado. Si falla, la solución no es silenciarlo ni renombrar la
     variable: es no mandar secretos al build.
   - Abre el PR hacia la rama `main`.
   - GitHub Actions se ejecutará para validar tu código y construir el proyecto.

---

## Estándares de Código y Arquitectura

### 1. TypeScript Estricto
La aplicación requiere validación de nulos y verificación de tipos en cada paso. Cuando interactúes con el DOM en `src/main.ts`, siempre realiza *castings* seguros (`as HTMLDivElement`) y asume que el elemento podría no existir o requerir verificación.

### 2. Estructura de Módulos (Separación de Responsabilidades)
- `src/types.ts`: Interfaces puras.
- `src/api.ts`: Cualquier lógica asíncrona, red, o caché persistente (localStorage).
- `src/scanner.ts`: Exclusivamente para interactuar con la cámara.
- `src/utils.ts`: Funciones puras (sin estado) para formato y transformaciones (ideales para pruebas unitarias).
- `src/main.ts`: Únicamente eventos DOM y orquestación de UI.

### 3. Pruebas Unitarias (Vitest)
El proyecto usa **Vitest**. Cualquier adición a `src/utils.ts` o la lógica de Offline Queue en `src/api.ts` debe venir acompañada de un archivo de prueba correspondiente en el directorio `tests/` (ej. `tests/utils.test.ts`).

### 4. ESLint y Prettier
Se aplican las mismas reglas de formateo que en el backend central. Tu IDE debe estar configurado para formatear al guardar. No alteres manualmente las reglas en `.prettierrc` sin discutirlas con el equipo.

---

## Próximos Desafíos (Roadmap)

- [ ] **Hooks de Husky:** Bloquear commits si `npm run verificar` falla.
- [ ] **Manejo de Estado Global:** Si la PWA crece más, implementar *Zustand* u otra alternativa ultraligera.
- [ ] **E2E Testing:** Explorar Playwright para pruebas de la PWA emulando un móvil.
