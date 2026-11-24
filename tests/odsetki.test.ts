import { describe, expect, it } from 'vitest';
import { obliczOdsetki, stopaOdsetek } from '../src/lib/odsetki';

// Przykłady przeliczone ręcznie: kwota × stopa × dni / 365, zaokrąglenie do groszy w każdym okresie.
describe('stopy odsetek', () => {
  it('stan na 24.11.2026 (ref 3,75%)', () => {
    expect(stopaOdsetek('opoznienie', '2026-11-24')).toBe(9.25);
    expect(stopaOdsetek('kapitalowe', '2026-11-24')).toBe(7.25);
    expect(stopaOdsetek('handlowe', '2026-11-24')).toBe(13.75);
    expect(stopaOdsetek('handlowe', '2026-11-24', true)).toBe(11.75);
  });
  it('transakcje handlowe: stopa z 1.01 / 1.07, nie z dnia zmiany', () => {
    expect(stopaOdsetek('handlowe', '2025-07-10')).toBe(15.25); // ref 5,25 na 1.07.2025 (obniżka 3.07 bez wpływu)
    expect(stopaOdsetek('handlowe', '2019-03-01')).toBe(9.5); // 2016–2019: ref + 8 pp
  });
  it('do 2015: rozporządzenia Rady Ministrów', () => {
    expect(stopaOdsetek('opoznienie', '2010-05-01')).toBe(13);
    expect(stopaOdsetek('kapitalowe', '2015-06-30')).toBe(8);
    expect(stopaOdsetek('opoznienie', '2016-01-01')).toBe(7);
    expect(stopaOdsetek('kapitalowe', '2016-01-01')).toBe(5);
  });
  it('maks. stopa za opóźnienie w 2023 r. = 12,25%', () => expect(stopaOdsetek('opoznienie', '2023-01-15')).toBe(12.25));
});

describe('obliczOdsetki', () => {
  it('za opóźnienie przez zmianę stopy 5.03.2026', () => {
    const w = obliczOdsetki(10000, '2026-01-31', '2026-04-30', 'opoznienie');
    expect(w.dni).toBe(89);
    expect(w.okresy).toEqual([
      { od: '2026-02-01', do: '2026-03-04', dni: 32, stopa: 9.5, odsetki: 83.29 },
      { od: '2026-03-05', do: '2026-04-30', dni: 57, stopa: 9.25, odsetki: 144.45 },
    ]);
    expect(w.odsetki).toBe(227.74);
    expect(w.razem).toBe(10227.74);
  });
  it('kapitałowe, jeden okres', () => expect(obliczOdsetki(5000, '2026-06-30', '2026-07-30', 'kapitalowe').odsetki).toBe(29.79));
  it('handlowe przez półrocza', () => {
    const w = obliczOdsetki(20000, '2025-06-15', '2025-08-14', 'handlowe');
    expect(w.okresy.map((o) => [o.dni, o.stopa, o.odsetki])).toEqual([[15, 15.75, 129.45], [45, 15.25, 376.03]]);
    expect(w.odsetki).toBe(505.48);
  });
  it('przełom 2015/2016', () => {
    const w = obliczOdsetki(1000, '2015-12-21', '2016-01-10', 'opoznienie');
    expect(w.okresy.map((o) => [o.dni, o.stopa, o.odsetki])).toEqual([[10, 8, 2.19], [10, 7, 1.92]]);
    expect(w.odsetki).toBe(4.11);
  });
  it('zmiana rozporządzenia 15.12.2008', () => expect(obliczOdsetki(1000, '2008-12-10', '2008-12-20', 'kapitalowe').odsetki).toBe(3.4));
  it('zapłata w dniu terminu = brak odsetek i komunikat', () => {
    const w = obliczOdsetki(1000, '2026-05-10', '2026-05-10', 'opoznienie');
    expect(w.odsetki).toBe(0);
    expect(w.blad).toBeTruthy();
  });
  it('zapłata dzień po terminie = 1 dzień', () => expect(obliczOdsetki(36500, '2026-05-10', '2026-05-11', 'opoznienie').odsetki).toBe(9.25));
  it('handlowe przed 2016 – komunikat', () => expect(obliczOdsetki(1000, '2015-05-01', '2016-05-01', 'handlowe').blad).toMatch('01.01.2016'));
  it('długi okres: suma dni = suma okresów', () => {
    const w = obliczOdsetki(1000, '2019-12-31', '2026-11-24', 'opoznienie');
    expect(w.okresy.reduce((s, o) => s + o.dni, 0)).toBe(w.dni);
    expect(w.okresy.every((o, i, a) => i === 0 || o.stopa !== a[i - 1].stopa)).toBe(true);
  });
});
