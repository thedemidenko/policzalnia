import { describe, expect, it } from 'vitest';
import { bruttoZNettoZlecenia, obliczZlecenie } from '../src/lib/zlecenie';

describe('umowa zlecenia', () => {
  it('jedyny tytuł, z chorobowym: 5000 → 3512,19', () => {
    const w = obliczZlecenie({ rok: 2026, brutto: 5000, sytuacja: 'brak', chorobowe: true });
    expect([w.spoleczne, w.zdrowotna, w.koszty, w.podatek, w.netto]).toEqual([685.5, 388.31, 862.9, 414, 3512.19]);
    expect(w.kosztZleceniodawcy).toBe(6024);
  });
  it('jedyny tytuł, bez chorobowego', () => {
    const w = obliczZlecenie({ rok: 2026, brutto: 5000, sytuacja: 'brak' });
    expect([w.spoleczne, w.zdrowotna, w.podatek, w.netto]).toEqual([563, 399.33, 426, 3611.67]);
  });
  it('student do 26 lat: netto = brutto, koszt = brutto', () => {
    const w = obliczZlecenie({ rok: 2026, brutto: 5000, sytuacja: 'student' });
    expect([w.netto, w.kosztZleceniodawcy]).toEqual([5000, 5000]);
  });
  it('etat u innego pracodawcy: tylko zdrowotna', () => {
    const w = obliczZlecenie({ rok: 2026, brutto: 5000, sytuacja: 'etat' });
    expect([w.zdrowotna, w.podatek, w.netto, w.kosztZleceniodawcy]).toEqual([450, 480, 4070, 5000]);
  });
  it('ulga dla młodych (nie student): bez PIT, ze składkami', () => {
    expect(obliczZlecenie({ rok: 2026, brutto: 5000, sytuacja: 'brak', chorobowe: true, ulgaMlodych: true }).netto).toBe(3926.19);
  });
  it('FP tylko od podstawy ≥ płacy minimalnej', () => {
    expect(obliczZlecenie({ rok: 2026, brutto: 3000, sytuacja: 'brak' }).skladkiZleceniodawcy).toBe(Math.round((292.8 + 195 + 50.1 + 3) * 100) / 100);
  });
  it('minimalna stawka godzinowa', () => {
    expect(obliczZlecenie({ rok: 2026, brutto: 3000, sytuacja: 'brak', godziny: 100 }).uwagi.some((u) => u.includes('31,4'))).toBe(true);
    expect(obliczZlecenie({ rok: 2027, brutto: 3200, sytuacja: 'brak', godziny: 100 }).uwagi.some((u) => u.includes('32,3'))).toBe(true);
  });
  it('do 200 zł – ryczałt', () => {
    expect(obliczZlecenie({ rok: 2026, brutto: 150, sytuacja: 'etat' }).podatek).toBe(18);
  });
  it('netto → brutto', () => {
    const b = bruttoZNettoZlecenia(3512.19, { rok: 2026, sytuacja: 'brak', chorobowe: true });
    expect(obliczZlecenie({ rok: 2026, brutto: b, sytuacja: 'brak', chorobowe: true }).netto).toBeGreaterThanOrEqual(3512.19);
    expect(b).toBeLessThanOrEqual(5000);
  });
});
