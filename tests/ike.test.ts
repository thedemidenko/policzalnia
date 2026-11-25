import { describe, expect, it } from 'vitest';
import { limit, oblicz, pozostalyLimit, warunki } from '../src/lib/ike';

const plan = { miesiecznie: 500, lata: 25, stopa: 6, pit: 12, rokStartu: 2027 } as const;

describe('IKE – limity', () => {
  it('limity z obwieszczeń 2026 i 2027, dalej rosną z płacami', () => {
    expect([limit(2026, 'ike'), limit(2027, 'ike'), limit(2026, 'ikze'), limit(2027, 'ikzeJdg')]).toEqual([28260, 30099, 11304, 18059.4]);
    expect(limit(2028, 'ike', 4)).toBeCloseTo(30099 * 1.04, 6);
  });
  it('ile jeszcze można wpłacić w tym roku', () => {
    const p = pozostalyLimit(2026, 20000, 11);
    expect([p.zostalo, p.miesiecy, p.miesiecznie, p.miesiecznyLimit]).toEqual([8260, 2, 4130, 2355]);
  });
  it('wpłaty ponad limit są obcinane', () => {
    expect(oblicz({ ...plan, miesiecznie: 3000, lata: 2 }).przekroczenie).toBe(true);
  });
});

describe('IKE – zysk z ulgi', () => {
  it('500 zł co miesiąc przez 25 lat, 6%: IKE ok. 339 790 zł', () => {
    const w = oblicz(plan);
    expect(w.wplaty).toBe(150000);
    expect(Math.round(w.ike)).toBe(339790);
  });
  it('korzyść największa przy koncie (podatek co rok), najmniejsza przy funduszu', () => {
    const k = oblicz({ ...plan, inwestycja: 'konto' }).korzysc;
    const o = oblicz({ ...plan, inwestycja: 'obligacje' }).korzysc;
    const f = oblicz({ ...plan, inwestycja: 'fundusz' }).korzysc;
    expect(k > o && o > f && f > 0).toBe(true);
  });
  it('zwrot przed 60 – podatek Belki od zysku', () => {
    const w = oblicz(plan);
    expect(w.podatekZwrot).toBeCloseTo((w.ike - w.wplaty) * 0.19, 6);
  });
  it('IKE czy IKZE: przy PIT 32% IKZE wygrywa, przy 12% prawie remis', () => {
    const a = oblicz({ ...plan, miesiecznie: 900, lata: 30, stopa: 7, pit: 32 }).ikze;
    expect(a.razem).toBeGreaterThan(a.ike * 1.1);
    const b = oblicz({ ...plan, pit: 12 }).ikze;
    expect(Math.abs(b.razem - b.ike) / b.ike).toBeLessThan(0.01);
  });
});

describe('IKE – warunki wypłaty', () => {
  it('60 lat i wpłaty w 5 latach – bez podatku', () => {
    expect(warunki(30, 60, 30).ok).toBe(true);
  });
  it('mniej niż 5 lat wpłat – ostrzeżenie', () => {
    expect(warunki(58, 60, 2).uwagi.some((u) => u.includes('5 latach'))).toBe(true);
  });
  it('wypłata przed 60 – zwrot; 55 lat tylko z uprawnieniami emerytalnymi', () => {
    expect(warunki(40, 57, 17).ok).toBe(false);
    expect(warunki(40, 57, 17, true).ok).toBe(true);
  });
});
