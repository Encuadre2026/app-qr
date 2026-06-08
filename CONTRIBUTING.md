# Guía de Contribución

¡Gracias por tu interés en contribuir a la **App QR - Encuadre 2026**! 
Este documento describe nuestras mejores prácticas y el flujo de trabajo sugerido para mantener el código limpio y organizado.

## Flujo de Trabajo (Git Flow)

1. **Clona y crea una rama:**
   Nunca trabajes directamente en la rama `main`. Por favor crea una rama a partir de `main` con el siguiente formato de nombres:
   - Para nuevas funciones: `feat/nombre-de-la-funcion`
   - Para corregir errores: `fix/descripcion-del-error`
   - Para cambios en documentación: `docs/actualizacion-readme`
   - Para refactorización: `refactor/descripcion`

   ```bash
   git checkout -b feat/mejorar-escaner
   ```

2. **Trabaja en tus cambios:**
   - Asegúrate de seguir los estándares descritos abajo.
   - Prueba siempre tus cambios localmente usando `python server.py` antes de hacer commit.

3. **Haz commits claros y descriptivos:**
   Sigue la convención de *Conventional Commits*:
   ```
   feat: agrega botón de cierre en el modal
   fix: corrige error al sincronizar en modo offline
   docs: actualiza el archivo README con instrucciones de instalación
   ```

4. **Sube tu rama y crea un Pull Request (PR):**
   - Haz push a tu rama en el repositorio remoto.
   - Abre un Pull Request dirigido a `main`.
   - Describe claramente qué soluciona tu PR y adjunta capturas de pantalla si hay cambios visuales.

## Estándares de Código

Actualmente el proyecto utiliza JavaScript nativo ("Vanilla JS") y CSS puro. Aunque no tengamos un *Linter* estricto configurado, solicitamos seguir estas reglas para mantener la legibilidad:

### JavaScript
- **Variables:** Mantén consistencia. En el estado actual del proyecto se usa `var`, pero para nuevo código sugerimos encarecidamente transicionar a `let` y `const`.
- **Nomenclatura:** Usa `camelCase` para variables y funciones. Las variables globales o constantes importantes pueden ir en `UPPER_SNAKE_CASE` (ej. `API_URL`).
- **DOM:** Las variables que guardan una referencia directa a un elemento del DOM tienen el prefijo `$` (ej. `var $btnStartCamera = ...`). Por favor respeta esta convención.
- **Comentarios:** Sé breve y conciso. Prefiere comentar el *por qué* de una decisión en lugar del *qué* está haciendo el código, a menos que sea una fórmula matemática compleja.

### CSS
- Agrupa los selectores de forma semántica.
- Reutiliza las variables CSS que se encuentran en el archivo `styles.css` bajo el bloque `:root {}` (como `--primary`, `--bg-dark`, etc.). No quemes ("hardcode") colores repetidos a lo largo de las clases.

## Pendientes a futuro (Roadmap de mejoras)
Si estás buscando en qué ayudar, aquí tienes una lista de tareas técnicas pendientes:
- [ ] Ocultar `ADMIN_SECRET` y manejar la autenticación de forma segura (BFF o SSR).
- [ ] Configurar un `package.json` para instalar un formateador como Prettier.
- [ ] Integrar un flujo de CI/CD para despliegue automatizado.
- [ ] Empaquetar y minificar (usando Vite o Webpack) para optimizar la carga inicial.

¡Cualquier ayuda o mejora es bienvenida!
