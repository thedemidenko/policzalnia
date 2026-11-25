import { describe, expect, it } from 'vitest';
import { bruttoZNetto, obliczDzielo } from '../src/lib/dzielo';

describe('umowa o dzieło', () => {
  it('5000 zł, koszty 20%: 4520 zł netto', () => {
    const w = obliczDzielo({ brutto: 5000 });
    expect([w.koszty, w.dochod, w.podatek, w.netto]).toEqual([1000, 4000, 480, 4520]);
  });
  it('koszty autorskie 50%: 4700 zł netto', () => {
    expect(obliczDzielo({ brutto: 5000, autorskie: 1 }).netto).toBe(4700);
  });
  it('część autorska 60%', () => {
    const w = obliczDzielo({ brutto: 5000, autorskie: 0.6 });
    expect(w.koszty).toBe(1500 + 400);
    expect(w.podatek).toBe(372);
  });
  it('PIT-2: zaliczka niższa o 300 zł', () => {
    expect(obliczDzielo({ brutto: 5000, pit2: 300 }).netto).toBe(4820);
  });
  it('limit kosztów 50%', () => {
    const w = obliczDzielo({ brutto: 10000, autorskie: 1, wykorzystane50: 118000 });
    expect(w.koszty50).toBe(2000);
    expect(w.uwagi.some((u) => u.includes('Limit'))).toBe(true);
  });
  it('do 200 zł – ryczałt 12%', () => {
    const w = obliczDzielo({ brutto: 150 });
    expect(w.ryczalt).toBe(true);
    expect(w.netto).toBe(132);
  });
  it('z własnym pracodawcą – składki jak w umowie o pracę', () => {
    const w = obliczDzielo({ brutto: 5000, wlasnyPracodawca: true });
    expect(w.skladkiSpoleczne).toBe(685.5);
    expect(w.zdrowotna).toBe(388.31);
    expect(w.podatek).toBe(414);
    expect(w.netto).toBe(3512.19);
    expect(w.kosztZamawiajacego).toBe(6024);
  });
  it('netto → brutto', () => {
    expect(bruttoZNetto(4520, {})).toBe(5000);
    const b = bruttoZNetto(3000, { autorskie: 1 });
    expect(obliczDzielo({ brutto: b, autorskie: 1 }).netto).toBeGreaterThanOrEqual(3000);
    expect(obliczDzielo({ brutto: b - 0.01, autorskie: 1 }).netto).toBeLessThan(3000);
  });
});
