import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Revisa el paquete compilado en busca de credenciales.
 *
 * Esta app se autenticaba con `VITE_ADMIN_SECRET`, y Vite incrusta las
 * variables `VITE_*` en el paquete que descarga el navegador. El resultado fue
 * que durante meses el archivo publicado en encuadre2026.github.io/app-qr
 * —accesible sin autenticación— contenía un literal de 23 caracteres detrás de
 * `Authorization: Bearer`, y con él quedaban abiertos el padrón completo con
 * CURP y teléfono, la aprobación de pagos y el borrado de registros.
 *
 * Nadie lo vio porque no había nada que mirase. El código fuente parecía
 * correcto —leía una variable de entorno, que es lo que uno hace— y el fallo
 * solo era visible en el resultado de la compilación.
 *
 * Por eso esta comprobación mira el paquete y no el fuente: es el único sitio
 * donde el problema se manifiesta. Basta con que alguien vuelva a escribir
 * `import.meta.env.VITE_ALGO` en una cabecera de autorización para que el
 * agujero reaparezca, y entonces esto falla antes de publicar.
 */

const DIRECTORIO = 'dist/assets';

/** Una cabecera Bearer cuyo valor no se interpola en ejecución. */
const BEARER_LITERAL = /Bearer\s*([^"'`,)\s;}]{4,120})/g;

/** Nombres de variables que Vite incrustaría en el paquete si alguien las usara. */
const VARIABLES_PELIGROSAS = /VITE_[A-Z0-9_]*(SECRET|TOKEN|KEY|PASS|PIN)[A-Z0-9_]*/g;

function esInterpolado(literal) {
  // En el paquete minificado un token en ejecución aparece como `Bearer ${x}`.
  return literal.startsWith('${');
}

const problemas = [];
let revisados = 0;

let archivos;
try {
  archivos = readdirSync(DIRECTORIO).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No se encontró ${DIRECTORIO}. ¿Se ejecutó "npm run build" antes?`);
  process.exit(1);
}

if (archivos.length === 0) {
  console.error(`No hay ningún .js en ${DIRECTORIO}: algo falló en la compilación.`);
  process.exit(1);
}

for (const archivo of archivos) {
  const contenido = readFileSync(join(DIRECTORIO, archivo), 'utf8');
  revisados++;

  for (const coincidencia of contenido.matchAll(BEARER_LITERAL)) {
    if (!esInterpolado(coincidencia[1])) {
      problemas.push(
        `${archivo}: hay una cabecera Authorization con un valor fijo de ` +
          `${coincidencia[1].length} caracteres. Una credencial en el paquete es pública.`
      );
    }
  }

  for (const coincidencia of contenido.matchAll(VARIABLES_PELIGROSAS)) {
    problemas.push(
      `${archivo}: aparece ${coincidencia[0]}. Vite incrusta las variables VITE_* ` +
        `en el paquete del navegador, así que su valor sería público.`
    );
  }
}

if (problemas.length > 0) {
  console.error('\nEl paquete contiene credenciales:\n');
  for (const p of problemas) console.error(`  · ${p}`);
  console.error(
    '\nLa app se autentica tecleando el PIN, que el Worker canjea por un token\n' +
      'temporal. Ninguna credencial debe llegar al build.\n'
  );
  process.exit(1);
}

console.log(`Paquete limpio: ${revisados} archivo(s) revisado(s), sin credenciales incrustadas.`);
