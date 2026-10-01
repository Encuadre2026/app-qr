import { describe, it, expect, vi } from 'vitest';
import { buscarConRecarga, MINIMO_ENTRE_RECARGAS_MS, tocaRecargar } from '../src/padron';

describe('padron.ts', () => {
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
