import { describe, expect, it } from 'vitest';
import { bruttoZKosztu, bruttoZNetto, obliczMiesiac, obliczRok } from '../src/lib/wynagrodzenie';

const baza = { rok: 2026, pit2: 300 };

describe('wynagrodzenie z umowy o pracę – miesiąc', () => {
  it('7000 zł brutto: 5101,67 zł netto, koszt pracodawcy 8433,60 zł (zgodnie z kalkulatorami rynkowymi)', () => {
    const m = obliczMiesiac({ ...baza, brutto: 7000 });
    expect(m.spoleczne).toBe(959.7);
    expect(m.zdrowotna).toBe(543.63);
    expect(m.podstawa).toBe(5790);
    expect(m.zaliczka).toBe(395);
    expect(m.netto).toBe(5101.67);
    expect(m.kosztPracodawcy).toBe(8433.6);
  });
  it('płaca minimalna 2026 (4806 zł): 3605,85 zł netto i 5790,28 zł kosztu', () => {
    const m = obliczMiesiac({ ...baza, brutto: 4806 });
    expect(m.netto).toBe(3605.85);
    expect(m.kosztPracodawcy).toBe(5790.28);
  });
  it('10 000 zł brutto: 7147,39 zł netto', () => {
    expect(obliczMiesiac({ ...baza, brutto: 10000 }).netto).toBe(7147.39);
  });
  it('podwyższone koszty 300 zł obniżają zaliczkę o 6 zł', () => {
    expect(obliczMiesiac({ ...baza, brutto: 7000, podwyzszoneKoszty: true }).zaliczka).toBe(389);
  });
  it('bez PIT-2 zaliczka wyższa o 300 zł', () => {
    expect(obliczMiesiac({ rok: 2026, brutto: 7000, pit2: 0 }).zaliczka).toBe(695);
  });
  it('PPK: wpłata pracodawcy zwiększa podstawę opodatkowania, wpłata pracownika obniża netto', () => {
    const m = obliczMiesiac({ ...baza, brutto: 7000, ppk: true });
    expect(m.ppkPracodawcy).toBe(105);
    expect(m.ppkPracownika).toBe(140);
    expect(m.zaliczka).toBe(407);
    expect(m.netto).toBe(4949.67);
    expect(m.kosztPracodawcy).toBe(8538.6);
  });
  it('koszty autorskie 50% od części autorskiej po składkach + 250 zł od reszty', () => {
    const m = obliczMiesiac({ ...baza, brutto: 10000, autorskie: 0.5 });
    // (10000 − 1371) × 0,5 × 0,5 = 2157,25; + 250
    expect(m.koszty).toBe(2407.25);
  });
  it('bez Funduszu Pracy poniżej płacy minimalnej i dla 55/60+', () => {
    expect(obliczMiesiac({ ...baza, brutto: 3000 }).skladkiPracodawcy.fp).toBe(0);
    const s = obliczMiesiac({ ...baza, brutto: 7000, bezFp: true }).skladkiPracodawcy;
    expect(s.fp + s.fgsp).toBe(0);
  });
});

describe('wynagrodzenie – cały rok', () => {
  it('ulga dla młodych: przy 5000 zł miesięcznie zero PIT przez cały rok, składki w całości', () => {
    const r = obliczRok({ ...baza, brutto: 5000, zwolnienie: 'mlodzi' });
    expect(r.suma.zaliczka).toBe(0);
    expect(r.miesiace[0].netto).toBe(r2(5000 - r.miesiace[0].spoleczne - r.miesiace[0].zdrowotna));
  });
  it('ulga dla młodych: przy 10 000 zł limit 85 528 zł kończy się we wrześniu', () => {
    const r = obliczRok({ ...baza, brutto: 10000, zwolnienie: 'mlodzi' });
    expect(r.miesiacKoncaUlgi).toBe(8);
    expect(r.miesiace[7].zaliczka).toBe(0);
    expect(r.miesiace[8].zaliczka).toBeGreaterThan(0);
    expect(r.suma.zwolniony).toBe(85528);
  });
  it('próg 120 000 zł: od miesiąca przekroczenia zaliczka 32% od nadwyżki', () => {
    const r = obliczRok({ ...baza, brutto: 15000 });
    const przed = r.miesiace.slice(0, r.miesiacProgu).reduce((a, m) => a + m.podstawa, 0);
    expect(przed).toBeLessThanOrEqual(120000);
    expect(przed + r.miesiace[r.miesiacProgu].podstawa).toBeGreaterThan(120000);
    expect(r.miesiace[11].netto).toBeLessThan(r.miesiace[0].netto);
  });
  it('limit 30-krotności 2026 (282 600 zł): przy 30 000 zł przekroczony w październiku', () => {
    const r = obliczRok({ ...baza, brutto: 30000 });
    expect(r.miesiacLimitu).toBe(9);
    expect(r.miesiace[9].emerytalna).toBe(r2((282600 - 9 * 30000) * 0.0976));
    expect(r.miesiace[10].emerytalna).toBe(0);
    expect(r.miesiace[10].chorobowa).toBe(735);
    expect(r.suma.emerytalna).toBe(r2(282600 * 0.0976));
  });
  it('2027: limit 30-krotności 300 990 zł i płaca minimalna 4950 zł dla FP', () => {
    const r = obliczRok({ rok: 2027, pit2: 300, brutto: 30000 });
    expect(r.miesiacLimitu).toBe(10);
    expect(obliczMiesiac({ rok: 2027, pit2: 300, brutto: 4900 }).skladkiPracodawcy.fp).toBe(0);
  });
  it('PIT-37: z PIT-2 zaliczki prawie równe podatkowi, bez PIT-2 ok. 3600 zł zwrotu', () => {
    expect(Math.abs(obliczRok({ ...baza, brutto: 7000 }).pit37.roznica)).toBeLessThan(10);
    const bez = obliczRok({ rok: 2026, brutto: 7000, pit2: 0 }).pit37.roznica;
    expect(bez).toBeGreaterThan(3590);
    expect(bez).toBeLessThan(3610);
  });
});

describe('odwrotnie', () => {
  it('netto → brutto', () => {
    expect(bruttoZNetto(5101.67, baza)).toBe(7000);
    expect(bruttoZNetto(3605.85, baza)).toBe(4806);
  });
  it('koszt pracodawcy → brutto', () => {
    expect(bruttoZKosztu(8433.6, baza)).toBe(7000);
  });
});

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
