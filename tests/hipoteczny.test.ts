import { describe, expect, it } from 'vitest';
import { oblicz, rekompensata, roczny } from '../src/lib/hipoteczny';

const bankier = (stopa: number) => oblicz({ kwota: 592000, lata: 25, raty: 'rowne', typ: 'zmienne', wskaznik: stopa, marza: 0 }).pierwszaRata;

// Pozostałe oferty z rankingu różnią się o 2–10 zł (Pekao, VeloBank, PKO BP, ING, Alior) – banki stosują własne konwencje
// (liczenie odsetek dniami, zaokrąglenia stopy); standardowy wzór annuitetowy daje wyniki zgodne z resztą rankingu.
describe('rata równa – zgodnie z rankingami Bankier.pl (XI 2026: 592 000 zł, 25 lat)', () => {
  it.each([
    [5.06, 3481], [5.17, 3519], [5.72, 3713], [5.82, 3749], [6.31, 3927],
    [5.83, 3752], [5.92, 3785], [6.08, 3843], [6.24, 3901], [6.45, 3978],
  ])('oprocentowanie %s%% → rata ok. %s zł', (stopa, rata) => {
    expect(Math.abs(bankier(stopa) - rata)).toBeLessThan(1);
  });
});

describe('raty malejące i równe – 500 000 zł, 300 rat, 6,5% (decodethefuture.org)', () => {
  const rowne = oblicz({ kwota: 500000, lata: 25, raty: 'rowne', typ: 'zmienne', wskaznik: 6.5, marza: 0 });
  const malejace = oblicz({ kwota: 500000, lata: 25, raty: 'malejace', typ: 'zmienne', wskaznik: 6.5, marza: 0 });
  it('pierwsza rata: równa 3376 zł, malejąca 4375 zł', () => {
    expect(Math.round(rowne.pierwszaRata)).toBe(3376);
    expect(malejace.pierwszaRata).toBe(4375);
  });
  it('odsetki: równe ok. 512,8 tys. zł, malejące ok. 407,6 tys. zł', () => {
    expect(Math.round(rowne.odsetki / 100) / 10).toBe(512.8);
    expect(Math.round(malejace.odsetki / 100) / 10).toBe(407.6);
  });
  it('kredyt spłacony do zera, suma kapitału = kwota', () => {
    expect(rowne.harmonogram.at(-1)!.saldo).toBe(0);
    expect(Math.round(rowne.harmonogram.reduce((a, q) => a + q.kapital, 0) * 100) / 100).toBe(500000);
    expect(roczny(rowne.harmonogram)).toHaveLength(25);
  });
});

describe('oprocentowanie okresowo stałe, ubezpieczenia, RRSO', () => {
  it('po 5 latach stałej stopy rata przeliczana według wskaźnika i marży', () => {
    const w = oblicz({ kwota: 500000, lata: 25, raty: 'rowne', typ: 'stale', stala: 6.1, okresStaly: 5, wskaznik: 3.48, marza: 1.8 });
    expect(w.harmonogram[59].stopa).toBe(6.1);
    expect(w.harmonogram[60].stopa).toBeCloseTo(5.28, 10);
    expect(w.rataPoStalej!).toBeLessThan(w.pierwszaRata);
  });
  it('bez prowizji i kosztów RRSO = efektywna stopa roczna oprocentowania', () => {
    const w = oblicz({ kwota: 400000, lata: 20, raty: 'rowne', typ: 'zmienne', wskaznik: 6, marza: 0 });
    expect(w.rrso).toBe(Math.round((Math.pow(1 + 0.005, 12) - 1) * 10000) / 100);
  });
  it('prowizja podnosi RRSO', () => {
    const a = oblicz({ kwota: 400000, lata: 20, raty: 'rowne', typ: 'zmienne', wskaznik: 6, marza: 0 }).rrso;
    const b = oblicz({ kwota: 400000, lata: 20, raty: 'rowne', typ: 'zmienne', wskaznik: 6, marza: 0, prowizja: 2 }).rrso;
    expect(b).toBeGreaterThan(a);
  });
  it('niski wkład: wyższa marża tylko dopóki saldo przekracza 80% wartości', () => {
    const w = oblicz({ kwota: 540000, wartosc: 600000, lata: 25, raty: 'rowne', typ: 'zmienne', wskaznik: 3.48, marza: 1.8, niskiWklad: 0.25 });
    expect(w.harmonogram[0].stopa).toBeCloseTo(5.53, 10);
    const i = w.harmonogram.findIndex((q) => q.stopa < 5.5);
    expect(w.harmonogram[i - 1].saldo).toBeLessThanOrEqual(480000);
    expect(w.kosztUbezpieczen).toBeGreaterThan(0);
    expect(w.ltv).toBe(90);
  });
});

describe('wcześniejsza spłata – art. 40 ustawy o kredycie hipotecznym', () => {
  const z = { kwota: 500000, lata: 25, raty: 'rowne' as const, typ: 'zmienne' as const, wskaznik: 3.48, marza: 1.8 };
  it('stopa zmienna: w ciągu 36 miesięcy najwyżej 3%, potem bez opłaty', () => {
    expect(rekompensata(z, 100000, 12).max).toBe(3000);
    expect(rekompensata(z, 100000, 37).mozliwa).toBe(false);
  });
  it('stopa stała: opłata możliwa w okresie stałej stopy', () => {
    expect(rekompensata({ ...z, typ: 'stale', stala: 6.1, okresStaly: 5 }, 100000, 50).mozliwa).toBe(true);
    expect(rekompensata({ ...z, typ: 'stale', stala: 6.1, okresStaly: 5 }, 100000, 61).mozliwa).toBe(false);
  });
});
