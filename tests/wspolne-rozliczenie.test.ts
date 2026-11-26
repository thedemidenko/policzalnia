import { describe, expect, it } from 'vitest';
import { kwotaUlgi, obliczWspolne } from '../src/lib/wspolne-rozliczenie';

describe('wspólne rozliczenie małżonków', () => {
  it('jeden zarabia ponad próg, drugi nic: 12 859 zł osobno, 7972 zł razem', () => {
    const w = obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 150000, koszty: 3000, spoleczne: 20565 }, b: { przychod: 0 } });
    expect([w.osoby[0].podstawa, w.osobno.podatek, w.razem.podatek, w.oszczednosc, w.mozna, w.niepewne]).toEqual([126435, 12859, 7972, 4887, true, false]);
  });
  it('różne dochody w pierwszym progu – korzyść z kwoty wolnej', () => {
    const w = obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 80000, koszty: 3000, spoleczne: 10968 }, b: { przychod: 20000, koszty: 3000, spoleczne: 2742 } });
    expect([w.osoby.map((o) => o.podatek), w.razem.podatek, w.oszczednosc]).toEqual([[4324, 0], 2435, 1889]);
  });
  it('równe dochody – brak korzyści', () => {
    const w = obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 60000 }, b: { przychod: 60000 } });
    expect([w.osobno.podatek, w.razem.podatek, w.oszczednosc]).toEqual([7200, 7200, 0]);
  });
  it('zaliczki – zwrot albo dopłata w obu wariantach', () => {
    const w = obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 150000, koszty: 3000, spoleczne: 20565, zaliczki: 12900 }, b: { przychod: 0 } });
    expect([w.osobno.saldo, w.razem.saldo]).toEqual([41, 4928]);
  });
  it('rozdzielność majątkowa i liniowy/ryczałt wykluczają', () => {
    expect(obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 1 }, b: { przychod: 1 }, rozdzielnosc: true }).mozna).toBe(false);
    expect(obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 1 }, b: { przychod: 1 }, liniowyRyczalt: true }).mozna).toBe(false);
  });
});

describe('ulga na dzieci i samotny rodzic', () => {
  it('kwoty ulgi: 1112,04 zł na 1. i 2. dziecko, 2000,04 zł na 3., 2700 zł na kolejne', () => {
    expect([kwotaUlgi(1), kwotaUlgi(2), kwotaUlgi(3), kwotaUlgi(4)]).toEqual([1112.04, 2224.08, 4224.12, 6924.12]);
  });
  it('jedno dziecko: limit 112 000 zł łącznie, 56 000 zł po ślubie w trakcie roku', () => {
    const x = { rok: 2026, tryb: 'malzonkowie' as const, a: { przychod: 70000 }, b: { przychod: 50000 }, dzieci: 1 };
    expect(obliczWspolne(x).ulga).toBe(0);
    expect(obliczWspolne({ ...x, a: { przychod: 60000 } }).ulga).toBe(1112.04);
    expect(obliczWspolne({ ...x, a: { przychod: 60000 }, slubWTrakcie: true }).ulga).toBe(0);
  });
  it('niewykorzystana ulga wraca do wysokości składek społecznych i zdrowotnej', () => {
    const w = obliczWspolne({ rok: 2026, tryb: 'malzonkowie', a: { przychod: 40000, spoleczne: 5484, zdrowotna: 3100 }, b: { przychod: 0 }, dzieci: 3 });
    // osobno: ulga pokrywa podatek 542 zł, wraca reszta; razem: podatek 0, wraca cała ulga
    expect([w.osobno.podatekPrzedUlga, w.osobno.ulgaZwrot, w.razem.podatekPrzedUlga, w.razem.ulgaZwrot, w.oszczednosc]).toEqual([542, 3682.12, 0, 4224.12, 542]);
  });
  it('samotny rodzic: 2 × podatek od połowy dochodu', () => {
    const w = obliczWspolne({ rok: 2026, tryb: 'samotny', a: { przychod: 50000 }, dzieci: 1 });
    expect([w.osoby[0].podatek, w.razem.podatekPrzedUlga, w.mozna]).toEqual([2400, 0, true]);
    expect(obliczWspolne({ rok: 2026, tryb: 'samotny', a: { przychod: 50000 } }).mozna).toBe(false);
  });
});
