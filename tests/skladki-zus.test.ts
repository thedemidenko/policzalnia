import { describe, expect, it } from 'vitest';
import { obliczZus } from '../src/lib/skladki-zus';

const b = { rok: 2026, forma: 'skala' as const, dochod: 0 };

describe('składki ZUS przedsiębiorcy – kwoty 2026 (zgodne z e-pity, Fakturownią, Infor)', () => {
  it('pełny ZUS z chorobową: 1103,27 + 452,16 + 138,47 + 94,39 = 1788,29 zł, z FP 1926,76 zł', () => {
    const t = obliczZus({ ...b, etap: 'pelny' }).typowy;
    expect([t.emerytalna, t.rentowa, t.chorobowa, t.wypadkowa, t.fp]).toEqual([1103.27, 452.16, 138.47, 94.39, 138.47]);
    expect(t.spoleczne).toBe(1788.29);
    expect(r2(t.spoleczne + t.fp)).toBe(1926.76);
  });
  it('preferencyjny: 281,44 + 115,34 + 35,32 + 24,08 = 456,18 zł, bez FP', () => {
    const t = obliczZus({ ...b, etap: 'pref' }).typowy;
    expect([t.emerytalna, t.rentowa, t.chorobowa, t.wypadkowa, t.fp]).toEqual([281.44, 115.34, 35.32, 24.08, 0]);
    expect(t.spoleczne).toBe(456.18);
  });
  it('ulga na start i etat: tylko zdrowotna', () => {
    expect(obliczZus({ ...b, etap: 'start' }).typowy.spoleczne).toBe(0);
    expect(obliczZus({ ...b, etap: 'pelny', sytuacja: 'etat' }).typowy.razem).toBe(432.54);
  });
  it('emeryt: bez Funduszu Pracy', () => {
    expect(obliczZus({ ...b, etap: 'pelny', sytuacja: 'emeryt' }).typowy.fp).toBe(0);
  });
});

describe('składka zdrowotna JDG', () => {
  it('skala: minimum 432,54 zł od lutego, w styczniu 2026 – 314,96 zł (rok składkowy 2025)', () => {
    const r = obliczZus({ ...b, etap: 'pelny' });
    expect(r.miesiace[0].zdrowotna).toBe(314.96);
    expect(r.miesiace[1].zdrowotna).toBe(432.54);
  });
  it('skala: 9% dochodu po składkach społecznych', () => {
    expect(obliczZus({ ...b, etap: 'pelny', dochod: 10000 }).typowy.zdrowotna).toBe(739.05);
  });
  it('liniowy: 4,9% dochodu, minimum jak na skali; odliczenie do limitu 14 100 zł', () => {
    const r = obliczZus({ ...b, forma: 'liniowy', etap: 'pelny', dochod: 20000 });
    expect(r.typowy.zdrowotna).toBe(892.37);
    expect(obliczZus({ ...b, forma: 'liniowy', etap: 'pelny', dochod: 5000 }).typowy.zdrowotna).toBe(432.54);
    expect(obliczZus({ ...b, forma: 'liniowy', etap: 'pelny', dochod: 40000 }).odliczenieZdrowotnej).toBe(14100);
  });
  it('ryczałt 2026: 498,35 / 830,58 / 1495,04 zł przez cały rok kalendarzowy, także w styczniu (art. 81 ust. 2f)', () => {
    const maly = obliczZus({ rok: 2026, forma: 'ryczalt', etap: 'pelny', przychod: 3000 });
    expect(maly.miesiace[0].zdrowotna).toBe(498.35);
    expect(maly.typowy.zdrowotna).toBe(498.35);
    const sredni = obliczZus({ rok: 2026, forma: 'ryczalt', etap: 'pelny', przychod: 70000 });
    expect(sredni.miesiace[0].zdrowotna).toBe(830.58);
    const duzy = obliczZus({ rok: 2026, forma: 'ryczalt', etap: 'pelny', przychod: 400000 });
    expect(duzy.miesiace[0].zdrowotna).toBe(1495.04);
  });
  it('karta podatkowa: 9% płacy minimalnej z 1 stycznia – 432,54 zł także w styczniu (art. 81 ust. 2z)', () => {
    expect(obliczZus({ rok: 2026, forma: 'karta', etap: 'pelny' }).miesiace[0].zdrowotna).toBe(432.54);
  });
  it('2027: minimum na skali 445,50 zł od lutego, w styczniu 2027 – 432,54 zł', () => {
    const r = obliczZus({ rok: 2027, forma: 'skala', etap: 'pelny' });
    expect(r.miesiace[0].zdrowotna).toBe(432.54);
    expect(r.miesiace[1].zdrowotna).toBe(445.5);
  });
  it('ryczałt: próg liczony narastająco – 10 000 zł miesięcznie przekracza 60 000 zł w lipcu', () => {
    const r = obliczZus({ rok: 2026, forma: 'ryczalt', etap: 'pelny', przychod: 10000 + 1788.29 });
    expect(r.miesiace[5].zdrowotna).toBe(498.35);
    expect(r.miesiace[6].zdrowotna).toBe(830.58);
    expect(r.odliczenieZdrowotnej).toBe(r2(r.rok.zdrowotna / 2));
    // roczne rozliczenie: 12 × 830,58 zł minus zapłacone 6 × 498,35 + 6 × 830,58 zł
    expect(r.doplataZdrowotnej).toBe(r2(6 * (830.58 - 498.35)));
  });
});

describe('wakacje składkowe', () => {
  it('w wybranym miesiącu bez składek społecznych i FP, zdrowotna zostaje', () => {
    const r = obliczZus({ ...b, etap: 'pelny', wakacje: 7 });
    expect(r.miesiace[7].spoleczne + r.miesiace[7].fp).toBe(0);
    expect(r.miesiace[7].zdrowotna).toBe(432.54);
    expect(r.rok.spoleczne).toBe(r2(11 * 1788.29));
  });
  it('przy wyższej zadeklarowanej podstawie nadwyżkę ponad najniższą płaci się samodzielnie', () => {
    const r = obliczZus({ ...b, etap: 'wlasna', podstawa: 8000, wakacje: 0 });
    expect(r.miesiace[0].emerytalna).toBe(r2(r2(8000 * 0.1952) - 1103.27));
  });
});

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
