import { describe, it, expect } from 'vitest';
import { formatearFecha, getInitials, esc } from '../src/utils';

describe('utils.ts', () => {
  describe('formatearFecha', () => {
    it('debe formatear una fecha ISO correctamente', () => {
      // Configuramos una fecha fija en UTC y comprobamos si asume el timezone local o si simplemente funciona.
      // 2026-06-20T10:00:00Z
      const date = new Date('2026-06-20T10:00:00Z');
      const formatted = formatearFecha(date.toISOString());
      
      const pad = (n: number) => (n < 10 ? '0' : '') + n;
      const expected = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      
      expect(formatted).toBe(expected);
    });

    it('debe retornar null si la fecha es vacía o nula', () => {
      expect(formatearFecha(null)).toBeNull();
      expect(formatearFecha('')).toBeNull();
    });
  });

  describe('getInitials', () => {
    it('debe obtener las iniciales de un nombre compuesto', () => {
      expect(getInitials('Carlos Arenas')).toBe('CA');
      expect(getInitials('María López García')).toBe('ML');
    });

    it('debe obtener la inicial de un solo nombre', () => {
      expect(getInitials('Carlos')).toBe('C');
    });

    it('debe manejar casos nulos o indefinidos', () => {
      expect(getInitials(null)).toBe('?');
      expect(getInitials(undefined)).toBe('?');
      expect(getInitials('')).toBe('?');
    });
  });

  describe('esc (Escape de HTML)', () => {
    it('debe escapar etiquetas HTML peligrosas', () => {
      const xssStr = '<script>alert("xss")</script>';
      const escaped = esc(xssStr);
      // jsdom convierte a entidades
      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('debe manejar nulos o vacíos', () => {
      expect(esc(null)).toBe('');
      expect(esc(undefined)).toBe('');
    });
  });
});
