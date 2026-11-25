import { describe, expect, it } from 'vitest';
import { miesiecyDoCelu, oblicz, stopaEfektywna, wplataNaCel } from '../src/lib/procent';

const plan = { kapital: 10000, wplata: 500, stopa: 6, lata: 20, poczatek: true } as const;

describe('procent składany', () => {
  it('10 000 zł + 500 zł/mies., 6%, 20 lat, Belka przy każdej kapitalizacji – 229 427 zł', () => {
    const w = oblicz(plan);
    expect(Math.round(w.koncowy)).toBe(229427);
    expect(w.wplaty).toBe(130000);
    expect(Math.round(w.podatek)).toBe(23322);
  });
  it('wpłaty na końcu miesiąca dają mniej', () => {
    expect(oblicz({ ...plan, poczatek: false }).koncowy).toBeLessThan(oblicz(plan).koncowy);
  });
  it('jednorazowo 10 000 zł przez 10 lat: 5% / 7% / 10%', () => {
    expect([5, 7, 10].map((s) => Math.round(oblicz({ kapital: 10000, stopa: s, lata: 10 }).koncowy))).toEqual([14983, 17606, 22418]);
  });
  it('podatek na koniec (fundusz, ETF) daje więcej niż od każdej kapitalizacji, IKE najwięcej', () => {
    const a = oblicz(plan).koncowy, b = oblicz({ ...plan, podatek: 'koniec' }).koncowy, c = oblicz({ ...plan, podatek: 'brak' }).koncowy;
    expect(Math.round(b)).toBe(239575);
    expect(Math.round(c)).toBe(265278);
    expect(a < b && b < c).toBe(true);
  });
  it('IKZE: 10% od całości na koniec', () => {
    const c = oblicz({ ...plan, podatek: 'brak' }).koncowy;
    expect(oblicz({ ...plan, podatek: 'ikze' }).koncowy).toBeCloseTo(c * 0.9, 6);
  });
  it('kapitalizacja roczna: 1000 zł na 10% = 1100 zł', () => {
    expect(oblicz({ kapital: 1000, stopa: 10, lata: 1, kapitalizacja: 'roczna', podatek: 'brak' }).koncowy).toBeCloseTo(1100, 9);
  });
  it('stopa efektywna rośnie z częstotliwością kapitalizacji', () => {
    const e = ['roczna', 'miesieczna', 'dzienna', 'ciagla'].map((k) => stopaEfektywna(6, k as never));
    expect(e[0]).toBeCloseTo(0.06, 9);
    expect(e[1]).toBeCloseTo(0.061678, 6);
    expect(e[3]).toBeCloseTo(Math.exp(0.06) - 1, 9);
    expect(e[0] < e[1] && e[1] < e[2] && e[2] < e[3]).toBe(true);
  });
  it('inflacja – wartość realna', () => {
    const w = oblicz({ ...plan, podatek: 'brak', inflacja: 3.5 });
    expect(w.realnie).toBeCloseTo(w.koncowy / Math.pow(1.035, 20), 6);
  });
  it('wzrost wpłat podnosi wynik, wypłaty zmniejszają', () => {
    expect(oblicz({ ...plan, wzrostWplat: 3 }).wplaty).toBeGreaterThan(130000);
    const w = oblicz({ kapital: 100000, wplata: -2000, stopa: 5, lata: 10 });
    expect(w.wyplacono).toBeGreaterThan(100000);
    expect(w.wyplacono).toBeLessThan(120000);
    expect(w.uwagi.some((u) => u.includes('wyczerpały'))).toBe(true);
  });
  it('cel: ile wpłacać, żeby mieć 1 mln zł w 30 lat przy 7%', () => {
    const x = wplataNaCel(1000000, { kapital: 0, stopa: 7, lata: 30, podatek: 'koniec' });
    expect(oblicz({ kapital: 0, wplata: x, stopa: 7, lata: 30, podatek: 'koniec' }).koncowy).toBeGreaterThanOrEqual(1000000);
    expect(Math.round(x)).toBe(946);
  });
  it('cel: po ilu miesiącach', () => {
    expect(miesiecyDoCelu(1000000, { kapital: 0, wplata: 1000, stopa: 7, podatek: 'koniec' })).toBe(352);
    expect(miesiecyDoCelu(1e9, { kapital: 0, wplata: 1, stopa: 1 })).toBeNull();
  });
});
