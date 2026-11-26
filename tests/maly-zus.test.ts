import { describe, expect, it } from 'vitest';
import { obliczMalyZus, okresUlgi, parametry, type WynikMZP } from '../src/lib/maly-zus';

const w = (x: Parameters<typeof obliczMalyZus>[0]) => obliczMalyZus(x) as WynikMZP;

describe('Mały ZUS Plus – podstawa i składki', () => {
  it('granice podstawy 2026 i 2027: 30% płacy minimalnej – 60% prognozowanego wynagrodzenia', () => {
    expect([parametry(2026)?.min, parametry(2026)?.max, parametry(2027)?.min, parametry(2027)?.max]).toEqual([1441.8, 5652, 1485, 6019.8]);
  });
  it('dochód 67 500 zł za cały 2025 r. – podstawa 2773,98 zł, składki 877,69 zł (przykład z poradnika)', () => {
    const a = w({ rok: 2026, forma: 'skala', przychodOgolne: 100000, dochodOgolne: 67500 });
    expect([a.mozna, a.przecietny, a.podstawa, a.maly.razem, a.maly.fp, a.pelny.razem]).toEqual([true, 5547.95, 2773.98, 877.69, 0, 1926.76]);
    expect([a.oszczednoscMies, a.zasilekMaly, a.zdrowotna]).toEqual([1049.07, 1914.93, 432.54]);
  });
  it('ryczałt: dochód = 50% przychodu', () => {
    const a = w({ rok: 2027, forma: 'ryczalt', przychodRyczalt: 90000 });
    expect([a.dochod, a.podstawa, a.maly.razem]).toEqual([45000, 1849.32, 585.13]);
  });
  it('składki w kosztach doliczane do dochodu; strata – podstawa minimalna', () => {
    expect(w({ rok: 2026, forma: 'liniowy', przychodOgolne: 80000, dochodOgolne: 40000, skladkiWKosztach: 5000 }).dochod).toBe(45000);
    expect(w({ rok: 2026, forma: 'skala', przychodOgolne: 30000, dochodOgolne: -2000 }).podstawa).toBe(1441.8);
  });
  it('Fundusz Pracy tylko przy podstawie co najmniej równej płacy minimalnej, nie dla 55/60+', () => {
    const a = w({ rok: 2026, forma: 'skala', przychodOgolne: 119000, dochodOgolne: 118000 });
    expect(a.podstawa).toBe(4849.32);
    expect(a.maly.fp).toBe(118.81);
    expect(w({ rok: 2026, forma: 'skala', przychodOgolne: 119000, dochodOgolne: 118000, bezFP: true }).maly.fp).toBe(0);
  });
  it('niepełny rok: limit przychodu proporcjonalny, przeciętny dochód z dni działalności', () => {
    const a = w({ rok: 2026, forma: 'skala', przychodOgolne: 70000, dochodOgolne: 30000, dni: 200 });
    expect(a.limit).toBe(65753.42);
    expect(a.mozna).toBe(false);
    expect(a.przecietny).toBe(4500);
  });
  it('wykluczenia: mniej niż 60 dni, karta ze zwolnieniem z VAT, preferencyjny ZUS, były pracodawca', () => {
    expect(w({ rok: 2026, forma: 'skala', przychodOgolne: 5000, dochodOgolne: 3000, dni: 59 }).mozna).toBe(false);
    expect(w({ rok: 2026, forma: 'karta', przychodKarta: 50000, kartaZwolnionaVat: true }).mozna).toBe(false);
    expect(w({ rok: 2026, forma: 'skala', przychodOgolne: 5000, dochodOgolne: 3000, preferencyjny: true }).powody).toHaveLength(1);
    expect(w({ rok: 2026, forma: 'skala', przychodOgolne: 5000, dochodOgolne: 3000, bylyPracodawca: true }).mozna).toBe(false);
  });
  it('wysoki dochód – podstawa maksymalna, ulga nic nie daje', () => {
    const a = w({ rok: 2026, forma: 'mieszana', przychodOgolne: 60000, dochodOgolne: 59000, przychodRyczalt: 59000 });
    expect(a.dochod).toBe(88500);
    expect(w({ rok: 2026, forma: 'skala', przychodOgolne: 119999, dochodOgolne: 119999, dni: 300 }).podstawa).toBe(5652);
  });
});

describe('okres ulgi od 2026 r.: 36 miesięcy w 60 miesiącach działalności', () => {
  it('ciągle od stycznia 2026', () => {
    expect(okresUlgi('2026-01')).toEqual({ koniecUlgi: '2028-12', koniecOkresu: '2030-12', kolejnyOd: '2031-01' });
  });
  it('zawieszenie wydłuża oba okresy, rezygnacja – tylko ulgę', () => {
    expect(okresUlgi('2026-01', 3, 2)).toEqual({ koniecUlgi: '2029-05', koniecOkresu: '2031-03', kolejnyOd: '2031-04' });
  });
});
