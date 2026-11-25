import { describe, expect, it } from 'vitest';
import { dodajDniRobocze, rokPracy, zakres } from '../src/lib/dni-robocze';

describe('dni robocze', () => {
  it('rok 2026: 253 dni pn–pt bez świąt, wymiar 251 dni / 2008 h', () => {
    const z = zakres('2026-01-01', '2026-12-31');
    expect(z.dniRobocze).toBe(253);
    expect(z.swietaWSoboty).toBe(2);
    expect(z.wymiarGodzin).toBe(2008);
    expect(z.swieta).toHaveLength(14);
  });
  it('styczeń 2026: 20 dni (Nowy Rok, Trzech Króli)', () => {
    expect(zakres('2026-01-01', '2026-01-31').dniRobocze).toBe(20);
  });
  it('wymiar miesięczny: lipiec 184 h, sierpień (15.08 w sobotę) 160 h', () => {
    const r = rokPracy(2026);
    expect(r.godziny).toBe(2008);
    expect(r.miesiace[6].godziny).toBe(184);
    expect(r.miesiace[7].godziny).toBe(160);
    expect(r.miesiace[11].godziny).toBe(160); // 23 dni pn–pt − 24 i 25.12 − 26.12 w sobotę
  });
  it('dodawanie dni roboczych przez weekend i święto', () => {
    expect(dodajDniRobocze('2026-12-23', 1)).toBe('2026-12-28');
    expect(dodajDniRobocze('2026-11-06', 3)).toBe('2026-11-12'); // 11.11 środa
    expect(dodajDniRobocze('2026-11-12', -3)).toBe('2026-11-06');
  });
  it('błędy', () => {
    expect(zakres('2026-02-01', '2026-01-01').blad).toBeTruthy();
  });
});
