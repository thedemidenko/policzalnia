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
  it('zgodność z Sedlak & Sedlak (wynagrodzenia.pl), 30 000 zł: każdy miesiąc netto i koszt pracodawcy', () => {
    const r = obliczRok({ ...baza, brutto: 30000 });
    expect(r.miesiace.map((m) => m.netto)).toEqual([20781.17, 20781.17, 20781.17, 20781.17, 19144.17, 15653.17, 15653.17, 15653.17, 15653.17, 16809.08, 17646.15, 17646.15]);
    expect(r.miesiace.map((m) => m.zaliczka)).toEqual([2776, 2776, 2776, 2776, 4413, 7904, 7904, 7904, 7904, 8531, 8985, 8985]);
    expect(r.suma.netto).toBe(216982.91);
    expect(r.miesiace[9].kosztPracodawcy).toBe(33314.76);
    expect(r.miesiace[10].kosztPracodawcy).toBe(31266);
    expect(r.suma.kosztPracodawcy).toBe(421142.76);
  });
  it('zgodność z Sedlak & Sedlak, 15 000 zł: październik 9167,58 zł, grudzień 8016,58 zł, koszt roczny 216 864 zł', () => {
    const r = obliczRok({ ...baza, brutto: 15000 });
    expect(r.miesiace[9].netto).toBe(9167.58);
    expect(r.miesiace[11].netto).toBe(8016.58);
    expect(r.suma.kosztPracodawcy).toBe(216864);
  });
  it('FP i FGŚP bez limitu 30-krotności (art. 259 ust. 1 ustawy o rynku pracy, art. 29 ust. 1 ustawy o FGŚP)', () => {
    const s = obliczRok({ ...baza, brutto: 30000 }).miesiace[11].skladkiPracodawcy;
    expect(s.emerytalna + s.rentowa).toBe(0);
    expect(s.fp).toBe(735);
    expect(s.fgsp).toBe(30);
  });
  it('ulga: koszty 250 zł za 12 miesięcy w zeznaniu, najwyżej do przychodu opodatkowanego (art. 22 ust. 3b, objaśnienia MF)', () => {
    // 20 000 zł: limit 85 528 zł kończy się w maju; opodatkowane 154 472 zł, składki odliczane 1984,11 + 7 × 2742 zł
    const r = obliczRok({ ...baza, brutto: 20000, zwolnienie: 'mlodzi' });
    expect(r.miesiacKoncaUlgi).toBe(4);
    expect(r.pit37.dochod).toBe(130294);
    expect(r.pit37.podatek).toBe(14094);
  });
  it('ulga + koszty autorskie: wspólny limit 120 000 zł (art. 22 ust. 9aa)', () => {
    const r = obliczRok({ ...baza, brutto: 20000, autorskie: 1, zwolnienie: 'mlodzi' });
    expect(r.suma.koszty).toBe(120000 - 85528);
  });
  it('oświadczenie o wspólnym rozliczeniu: 12% przez cały rok (art. 32 ust. 3)', () => {
    const r = obliczRok({ ...baza, brutto: 30000, wspolne: 'nizszy' });
    expect(r.miesiacProgu).toBe(-1);
    expect(r.miesiace[5].zaliczka).toBe(2776);
    expect(r.miesiace[11].zaliczka).toBe(3182);
    // małżonek bez dochodów i dochód do 120 000 zł – dodatkowo 1/12 kwoty zmniejszającej
    expect(obliczMiesiac({ ...baza, brutto: 7000, wspolne: 'bezDochodow' }).zaliczka).toBe(95);
    // powyżej 120 000 zł dodatkowego obniżenia nie ma (art. 32 ust. 3 pkt 2)
    expect(obliczMiesiac({ ...baza, brutto: 15000, wspolne: 'bezDochodow' }).zaliczka).toBe(1223);
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
