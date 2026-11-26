import { describe, expect, it } from 'vitest';
import { DZIALALNOSCI, STAWKI, obliczRyczalt, zdrowotnaRyczalt, zusMiesiecznie } from '../src/lib/ryczalt';

describe('ryczałt od przychodów ewidencjonowanych', () => {
  it('składka zdrowotna 2026: 498,35 / 830,58 / 1495,04 zł miesięcznie', () => {
    expect([zdrowotnaRyczalt(2026, 60000).mies, zdrowotnaRyczalt(2026, 60000.01).mies, zdrowotnaRyczalt(2026, 300001).mies]).toEqual([498.35, 830.58, 1495.04]);
    expect(zdrowotnaRyczalt(2027, 100000).niepewne).toBe(true);
  });
  it('ZUS 2026: pełny 1788,29 + FP 138,47 zł, preferencyjny 456,18 zł bez FP', () => {
    expect(zusMiesiecznie(2026, 'pelny')).toEqual({ spoleczne: 1788.29, fp: 138.47 });
    expect(zusMiesiecznie(2026, 'pref')).toEqual({ spoleczne: 456.18, fp: 0 });
    expect(zusMiesiecznie(2026, 'start')).toEqual({ spoleczne: 0, fp: 0 });
  });
  it('8000 zł miesięcznie, 8,5% i 17%, pełny ZUS – na rękę ok. 4750 i 4257 zł (jak finwire)', () => {
    const a = obliczRyczalt({ rok: 2026, przychody: [{ stawka: '8.5', kwota: 96000 }], zus: 'pelny' });
    expect([a.podstawa, a.podatek, a.naReke]).toEqual([69557, 5912, 56999.92]); // finwire: 4749,96 zł × 12
    const b = obliczRyczalt({ rok: 2026, przychody: [{ stawka: '17', kwota: 96000 }], zus: 'pelny' });
    expect([b.podatek, b.naReke]).toEqual([11825, 51086.92]); // finwire: 4257,27 zł × 12
  });
  it('kilka stawek – odliczenia proporcjonalnie do przychodów', () => {
    const w = obliczRyczalt({ rok: 2026, przychody: [{ stawka: '12', kwota: 120000 }, { stawka: '8.5', kwota: 60000 }], zus: 'pelny' });
    expect(w.pozycje.map((p) => p.odliczenia)).toEqual([17628.64, 8814.32]);
    expect(w.podatek).toBe(Math.round(102371 * 0.12 + 51186 * 0.085));
  });
  it('najem: 8,5% do 100 000 zł, 12,5% od nadwyżki', () => {
    const w = obliczRyczalt({ rok: 2026, przychody: [{ stawka: 'najem', kwota: 150000 }], zus: 'start' });
    const p = w.pozycje[0];
    expect(p.podatek).toBe(Math.round((100000 * 8.5 + (p.podstawa - 100000) * 12.5)) / 100);
  });
  it('porównanie z liniowym i skalą przy kosztach', () => {
    const w = obliczRyczalt({ rok: 2026, przychody: [{ stawka: '12', kwota: 180000 }], zus: 'pelny', koszty: 20000 });
    expect(w.porownanie?.map((f) => f.nazwa)).toEqual(['Ryczałt', 'Podatek liniowy 19%', 'Skala 12% / 32%']);
    const [r, l] = w.porownanie!;
    expect(r.naReke).toBe(108484.92);
    expect(l.zdrowotna).toBe(6707.07); // 4,9% × (180 000 − 21 661,64 − 21 459,48)
  });
  it('lista stawek i działalności', () => {
    expect(STAWKI.map((s) => s.stawka)).toEqual([17, 15, 14, 12, 10, 8.5, 8.5, 5.5, 3, 2]);
    expect(DZIALALNOSCI.find((d) => d.n.startsWith('programista'))?.s).toBe('12');
    expect(DZIALALNOSCI.every((d) => STAWKI.some((s) => s.id === d.s))).toBe(true);
  });
});
