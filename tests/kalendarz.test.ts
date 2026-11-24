import { describe, expect, it } from 'vitest';
import { czyRoboczy, swieta, terminRoboczy, wielkanoc } from '../src/lib/kalendarz';

describe('kalendarz', () => {
  it('Wielkanoc', () => {
    expect(wielkanoc(2024)).toBe('2024-03-31');
    expect(wielkanoc(2025)).toBe('2025-04-20');
    expect(wielkanoc(2026)).toBe('2026-04-05');
    expect(wielkanoc(2027)).toBe('2027-03-28');
  });
  it('Boże Ciało 2026 = 4.06', () => expect(swieta(2026).get('2026-06-04')).toBe('Boże Ciało'));
  it('liczba świąt: 13 do 2024, 14 od 2025 (Wigilia)', () => {
    expect(swieta(2024).size).toBe(13);
    expect(swieta(2026).size).toBe(14);
    expect(swieta(2010).has('2010-01-06')).toBe(false);
  });
  it('dni robocze', () => {
    expect(czyRoboczy('2026-11-24')).toBe(true); // wtorek
    expect(czyRoboczy('2026-11-11')).toBe(false); // święto
    expect(czyRoboczy('2026-11-28')).toBe(false); // sobota
  });
  it('art. 115 KC: termin w sobotę → poniedziałek; przed świętami → po świętach', () => {
    expect(terminRoboczy('2026-05-30')).toBe('2026-06-01'); // sobota
    expect(terminRoboczy('2026-04-05')).toBe('2026-04-07'); // Wielkanoc + poniedziałek
    expect(terminRoboczy('2026-12-24')).toBe('2026-12-28'); // Wigilia, święta, weekend
    expect(terminRoboczy('2026-11-24')).toBe('2026-11-24');
  });
});
