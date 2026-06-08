# Guía de Contribución 🤝

¡Gracias por tu interés en contribuir a la **App QR - Encuadre 2026**! 

Este proyecto se ha migrado a un estándar Enterprise riguroso. Este documento describe las convenciones, las reglas de arquitectura y el flujo de trabajo sugerido para mantener el código base sólido y altamente tipado.

## 🌿 Flujo de Trabajo (Git Flow)

1. **Clona y crea una rama:**
   Nunca trabajes directamente en la rama `main`. Crea una rama desde `main` usando la convención de Git Flow:
   - Nuevas funciones: `feat/nombre-de-la-funcion`
   - Corrección de errores: `fix/descripcion-del-error`
   - Documentación: `docs/actualizacion-readme`
   - Tareas técnicas: `chore/actualizacion-dependencias` o `refactor/modularizacion`

   ```bash
   git checkout -b feat/mejorar-escaner
   ```

2. **Trabaja en tus cambios:**
   - Asegúrate de tener el entorno en modo desarrollo corriendo mediante `npm run dev`.
   - Revisa que tus tipos e interfaces TypeScript estén correctos.
   - **IMPORTANTE:** Nunca uses `// @ts-nocheck` ni tipos `any` a menos que sea estrictamente necesario (y si lo haces, documenta exhaustivamente el por qué).

3. **Haz commits claros y descriptivos:**
   El proyecto requiere *Conventional Commits*:
   ```text
   feat: agrega botón de cierre en el modal de detalle
   fix: corrige error de tipado al sincronizar modo offline
   refactor: mueve lógica de formato de fecha a utils.ts
   ```

4. **Sube tu rama y crea un Pull Request (PR):**
   - Haz push de la rama.
   - Abre un Pull Request dirigido a `main`.
   - El pipeline de GitHub Actions se ejecutará automáticamente para verificar que el empaquetado (Build) y el Linter (ESLint) pasen correctamente. Si el *Action* falla, tu PR no podrá ser aprobado.

---

## 🛠️ Estándares de Código y Arquitectura

### 1. TypeScript Estricto
La aplicación usa `"strict": true` en `tsconfig.json`. Todas las referencias al DOM deben ser casteadas explícitamente y comprobadas (ej. `const btn = document.getElementById('btn') as HTMLButtonElement;`).

### 2. Estructura de Módulos
Para mantener la escalabilidad, la lógica ya no vive en un único archivo. 
- Las variables e interfaces de datos deben definirse en `src/types.ts`.
- Las llamadas a APIs y lógica de red pertenecen a `src/api.ts`.
- La manipulación directa de la interfaz gráfica y los Event Listeners se manejan en `src/main.ts`.
- Si agregas una librería pesada o especializada (como se hizo con `html5-qrcode`), considera envolverla en su propio módulo (ej. `src/scanner.ts`).

### 3. ESLint y Prettier
El proyecto cuenta con un Linter estricto. Antes de crear un PR, asegúrate de que tu código cumpla con el formato. Tu editor de código (VS Code, WebStorm) debe estar configurado para formatear automáticamente usando el archivo `.prettierrc` del proyecto.

### 4. Nomenclatura DOM
Se conserva la convención de prefijar con `$` las variables que almacenan una referencia directa a un elemento del DOM para distinguirlas fácilmente del resto de la lógica de negocio.
```typescript
const $modalParticipante = document.getElementById('modal') as HTMLDivElement;
```

---

## 🚀 Próximos Desafíos (Roadmap)
Si buscas en qué ayudar, aquí tienes los hitos técnicos pendientes para la siguiente etapa de evolución:

- [ ] **Implementar Husky y Lint-Staged:** Prevenir *commits* que no cumplan con el formato de Prettier o que arrojen errores de ESLint.
- [ ] **Migrar UI a Web Components o Framework:** Actualmente el DOM se maneja de forma manual (*Vanilla TS*). Se podría evaluar la migración a *Lit*, *Preact* o *Svelte* si la complejidad de la interfaz crece.
- [ ] **Tests Unitarios:** Añadir *Vitest* para someter a prueba las funciones puras de `utils.ts` y la cola offline de `api.ts`.

¡Cualquier mejora u optimización técnica será muy bienvenida!
