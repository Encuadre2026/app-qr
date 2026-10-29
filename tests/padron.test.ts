import { describe, it, expect, vi } from 'vitest';
import {
  buscarConRecarga,
  buscarEnPadron,
  MAXIMO_RESULTADOS,
  MINIMO_ENTRE_RECARGAS_MS,
  participanteDesdeLaApi,
  tocaRecargar,
} from '../src/padron';
import { Participante, RegistroAPI } from '../src/types';

/** Una fila del padrón con lo mínimo, para no repetirla en cada prueba. */
function fila(extra: Partial<RegistroAPI> = {}): RegistroAPI {
  return {
    id_participante: 'ENC-001',
    nombre: 'Persona',
    taller: 'Un taller',
    institucion: 'Una escuela',
    perfil: 'Estudiante',
    pago_aprobado: true,
    asistio: false,
    fecha_asistencia: null,
    ...extra,
  };
}

describe('padron.ts', () => {
  describe('participanteDesdeLaApi', () => {
    it('guarda el recuento que manda el Worker', () => {
      const p = participanteDesdeLaApi(
        fila({
          asistio: true,
          fecha_asistencia: '2026-10-29 15:00:00',
          asistencias: 3,
          dias_asistidos: 3,
          ultima_asistencia: '2026-10-31 15:00:00',
        })
      );

      expect(p.asistencias).toBe(3);
      // La que se enseña es la última, no la primera: es la que dice cuánta
      // espera queda para que la siguiente cuente.
      expect(p.ultima).toBe('2026-10-31 15:00:00');
    });

    // Los minutos en que conviven el Worker anterior y la app nueva.
    it('sin el recuento, la marca de haber entrado vale por una asistencia', () => {
      const p = participanteDesdeLaApi(
        fila({ asistio: true, fecha_asistencia: '2026-10-29 15:00:00' })
      );

      expect(p.asistencias).toBe(1);
      expect(p.ultima).toBe('2026-10-29 15:00:00');
      expect(p.asistencia).not.toBeNull();
    });

    it('quien no ha entrado queda en cero y sin fecha', () => {
      const p = participanteDesdeLaApi(fila());

      expect(p.asistencias).toBe(0);
      expect(p.ultima).toBeNull();
      expect(p.asistencia).toBeNull();
    });

    it('una fecha ilegible no borra la asistencia: consta sin hora', () => {
      const p = participanteDesdeLaApi(fila({ asistio: true, fecha_asistencia: 'ayer' }));

      expect(p.asistencias).toBe(1);
      expect(p.asistencia).toBe('sí');
    });
  });

  describe('buscarEnPadron', () => {
    /** Alguien del padrón, tal como lo guarda la app. */
    const persona = (id: string, nombre: string): Participante =>
      participanteDesdeLaApi(fila({ id_participante: id, nombre }));

    const padron = [
      persona('ENC-001', 'José Pérez Muñoz'),
      persona('ENC-002', 'Jose Ramirez'),
      persona('ENC-003', 'María Ángeles Argüelles'),
    ];

    // El defecto que se arregló: sin la tilde, el nombre no aparecía.
    it('encuentra un nombre con tilde escrito sin ella', () => {
      expect(buscarEnPadron(padron, 'jose perez').map((p) => p.id)).toEqual(['ENC-001']);
      expect(buscarEnPadron(padron, 'munoz').map((p) => p.id)).toEqual(['ENC-001']);
      expect(buscarEnPadron(padron, 'maria angeles').map((p) => p.id)).toEqual(['ENC-003']);
    });

    it('y uno escrito sin tilde buscándolo con ella', () => {
      expect(buscarEnPadron(padron, 'Ramírez').map((p) => p.id)).toEqual(['ENC-002']);
    });

    it('con o sin tilde, salen los dos cuando los dos casan', () => {
      expect(buscarEnPadron(padron, 'JOSE').map((p) => p.id)).toEqual(['ENC-001', 'ENC-002']);
    });

    it('sigue encontrando por id, en cualquier caja', () => {
      expect(buscarEnPadron(padron, 'enc-002').map((p) => p.id)).toEqual(['ENC-002']);
    });

    it('no enseña más de los que caben', () => {
      const muchos = Array.from({ length: MAXIMO_RESULTADOS + 5 }, (_, i) =>
        persona(`ENC-${i}`, 'Pérez')
      );
      expect(buscarEnPadron(muchos, 'perez')).toHaveLength(MAXIMO_RESULTADOS);
    });

    it('a quien no está, no lo inventa', () => {
      expect(buscarEnPadron(padron, 'zzz')).toEqual([]);
    });

    it('un texto que solo son espacios no casa con todo el padrón', () => {
      expect(buscarEnPadron(padron, '   ')).toEqual([]);
    });
  });

  describe('tocaRecargar', () => {
    it('recarga si nunca se cargó', () => {
      expect(tocaRecargar(null, 1000)).toBe(true);
    });

    it('no recarga antes de un minuto', () => {
      expect(tocaRecargar(10_000, 10_000 + MINIMO_ENTRE_RECARGAS_MS - 1)).toBe(false);
    });

    it('recarga a partir del minuto', () => {
      expect(tocaRecargar(10_000, 10_000 + MINIMO_ENTRE_RECARGAS_MS)).toBe(true);
    });
  });

  describe('buscarConRecarga', () => {
    it('si ya está en el padrón, no lo pide otra vez', async () => {
      const recargar = vi.fn(async () => true);
      expect(await buscarConRecarga(() => 'ENC-001', recargar)).toBe('ENC-001');
      expect(recargar).not.toHaveBeenCalled();
    });

    // Quien se inscribió después de teclear el PIN.
    it('si no está, lo pide una vez y vuelve a buscar', async () => {
      let padron: string[] = [];
      const recargar = vi.fn(async () => {
        padron = ['ENC-300'];
        return true;
      });
      const buscar = () => (padron.includes('ENC-300') ? 'ENC-300' : null);

      expect(await buscarConRecarga(buscar, recargar)).toBe('ENC-300');
      expect(recargar).toHaveBeenCalledTimes(1);
    });

    it('si después de pedirlo sigue sin estar, no existe', async () => {
      const recargar = vi.fn(async () => true);
      expect(await buscarConRecarga(() => null, recargar)).toBeNull();
      expect(recargar).toHaveBeenCalledTimes(1);
    });

    it('si la recarga falla, no busca en la misma lista otra vez', async () => {
      const buscar = vi.fn(() => null);
      expect(await buscarConRecarga(buscar, async () => false)).toBeNull();
      expect(buscar).toHaveBeenCalledTimes(1);
    });
  });
});
