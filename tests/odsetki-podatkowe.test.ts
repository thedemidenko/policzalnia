import { describe, expect, it } from 'vitest';
import { doZlotych, obliczOdsetkiPodatkowe, plusMiesiace, sprawdzObnizona, stawkaPodatkowa } from '../src/lib/odsetki-podatkowe';

// Przykłady przeliczone ręcznie: kwota × dni × stawka / 365 dla każdego okresu (do groszy), suma do pełnych złotych.
describe('stawki odsetek za zwłokę', () => {
  it('od 5.03.2026 (lombard 4,25%): 10,50 / 5,25 / 15,75', () => {
    expect(stawkaPodatkowa('2026-11-24')).toBe(10.5);
    expect(stawkaPodatkowa('2026-11-24', 'obnizona')).toBe(5.25);
    expect(stawkaPodatkowa('2026-11-24', 'podwyzszona')).toBe(15.75);
  });
  it('zgodne z obwieszczeniami MF', () => {
    expect(stawkaPodatkowa('2026-03-04')).toBe(11);
    expect(stawkaPodatkowa('2025-07-03')).toBe(13);
    expect(stawkaPodatkowa('2023-10-05')).toBe(14.5);
    expect(stawkaPodatkowa('2022-09-08')).toBe(16.5);
    expect(stawkaPodatkowa('2022-02-09')).toBe(8.5);
    expect(stawkaPodatkowa('2020-06-01')).toBe(8); // minimum 8%
    expect(stawkaPodatkowa('2016-01-01', 'obnizona')).toBe(4);
    expect(stawkaPodatkowa('2016-01-01', 'podwyzszona')).toBe(12);
  });
  it('przed 2016: tabela MF, tylko stawka podstawowa', () => {
    expect(stawkaPodatkowa('2015-12-31')).toBe(8);
    expect(stawkaPodatkowa('2013-07-10')).toBe(10);
    expect(stawkaPodatkowa('2008-07-01')).toBe(15);
    expect(stawkaPodatkowa('1998-01-01')).toBe(54);
    expect(stawkaPodatkowa('2015-06-01', 'obnizona')).toBeNaN();
  });
  it('zaokrąglenie do złotych (art. 63 § 1)', () => {
    expect(doZlotych(8.49)).toBe(8);
    expect(doZlotych(8.5)).toBe(9);
    expect(doZlotych(156.31)).toBe(156);
  });
});

describe('obliczOdsetkiPodatkowe', () => {
  it('VAT 10 000 zł, termin 25.02.2026, zapłata 20.04.2026 → 156 zł (zmiana stawki 5.03)', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2026-02-25' }], '2026-04-20');
    const z = w.pozycje[0];
    expect(z.okresy).toEqual([
      { od: '2026-02-26', do: '2026-03-04', dni: 7, kwota: 10000, stawka: 11, odsetki: 21.1 },
      { od: '2026-03-05', do: '2026-04-20', dni: 47, kwota: 10000, stawka: 10.5, odsetki: 135.21 },
    ]);
    expect(z.dni).toBe(54);
    expect(z.odsetkiPrzedZaokr).toBe(156.31);
    expect(w.odsetki).toBe(156);
    expect(w.razem).toBe(10156);
  });
  it('stawka obniżona i podwyższona', () => {
    expect(obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2026-02-25' }], '2026-04-20', { stawka: 'obnizona' }).odsetki).toBe(78); // 10,55 + 67,60
    expect(obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2026-02-25' }], '2026-04-20', { stawka: 'podwyzszona' }).odsetki).toBe(234); // 31,64 + 202,81
  });
  it('próg 8,70 zł: drobne odsetki się nie płaci', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 1000, termin: '2026-06-22' }], '2026-06-30');
    expect(w.pozycje[0].odsetkiPrzedZaokr).toBe(2.3);
    expect(w.odsetki).toBe(0);
    expect(w.pozycje[0].ponizejProgu).toBe(true);
    expect(w.razem).toBe(1000);
  });
  it('8,50–8,70 zł przed zaokrągleniem → 9 zł z ostrzeżeniem', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 1000, termin: '2026-05-29' }], '2026-06-28');
    expect(w.pozycje[0].odsetkiPrzedZaokr).toBe(8.63);
    expect(w.odsetki).toBe(9);
    expect(w.uwagi.some((u) => u.includes('bezpieczniej'))).toBe(true);
  });
  it('termin w sobotę przesuwa się na poniedziałek (art. 12 § 5)', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2026-04-25' }], '2026-05-27');
    expect(w.pozycje[0].terminEfektywny).toBe('2026-04-27');
    expect(w.pozycje[0].okresy[0].od).toBe('2026-04-28');
    expect(w.pozycje[0].dni).toBe(30);
    const bez = obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2026-04-25' }], '2026-05-27', { przesunTermin: false });
    expect(bez.pozycje[0].dni).toBe(32);
  });
  it('przełom 2015/2016: jedna stawka 8% → jeden okres', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2015-12-21' }], '2016-01-10');
    expect(w.pozycje[0].okresy).toEqual([{ od: '2015-12-22', do: '2016-01-10', dni: 20, kwota: 10000, stawka: 8, odsetki: 43.84 }]);
    expect(w.odsetki).toBe(44);
  });
  it('zapłata samego podatku bez odsetek: wpłata dzielona proporcjonalnie (art. 55 § 2)', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 10000, termin: '2026-03-25' }], '2026-05-25', { wplaty: [{ data: '2026-04-24', kwota: 10000 }] });
    const z = w.pozycje[0];
    expect(z.wplaty).toEqual([{ data: '2026-04-24', kwota: 10000, naPodatek: 9914.44, naOdsetki: 85.56 }]);
    expect(z.podatek).toBe(85.56);
    expect(z.okresy.at(-1)).toEqual({ od: '2026-04-25', do: '2026-05-25', dni: 31, kwota: 85.56, stawka: 10.5, odsetki: 0.76 });
    expect(z.odsetkiPrzedZaokr).toBe(1.5);
    expect(w.odsetki).toBe(2); // po wpłacie częściowej próg 8,70 zł już nie zeruje odsetek
    expect(w.razem).toBe(87.56);
  });
  it('kilka zaległości: wpłata najpierw na najwcześniejszą (art. 62 § 1)', () => {
    const w = obliczOdsetkiPodatkowe(
      [{ kwota: 3000, termin: '2026-03-20' }, { kwota: 2000, termin: '2026-02-20' }],
      '2026-04-30',
      { wplaty: [{ data: '2026-03-31', kwota: 2100 }] },
    );
    const [b, a] = w.pozycje;
    expect(a.wplaty).toEqual([{ data: '2026-03-31', kwota: 2023, naPodatek: 2000, naOdsetki: 23 }]);
    expect(a.splaconaWplata).toBe('2026-03-31');
    expect(a.dni).toBe(39);
    expect(a.odsetki).toBe(0);
    expect(b.wplaty).toEqual([{ data: '2026-03-31', kwota: 77, naPodatek: 76.76, naOdsetki: 0.24 }]);
    expect(b.podatek).toBe(2923.24);
    expect(b.odsetkiPrzedZaokr).toBe(34.48);
    expect(w.odsetki).toBe(34);
    expect(w.podatek).toBe(2923.24);
    expect(w.wplacono).toBe(2100);
  });
  it('wpłata przed terminem zmniejsza podatek i nie wyłącza progu', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 1500, termin: '2026-06-22' }], '2026-06-30', { wplaty: [{ data: '2026-06-01', kwota: 500 }] });
    expect(w.pozycje[0].okresy[0].kwota).toBe(1000);
    expect(w.odsetki).toBe(0);
  });
  it('nadpłata', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 1000, termin: '2026-06-22' }], '2026-07-31', { wplaty: [{ data: '2026-06-30', kwota: 1100 }] });
    expect(w.nadplata).toBe(100);
    expect(w.razem).toBe(0);
  });
  it('zaliczka: odsetki tylko do dnia złożenia zeznania', () => {
    const w = obliczOdsetkiPodatkowe([{ kwota: 5000, termin: '2026-01-20' }], '2026-06-01', { zeznanie: '2026-04-15' });
    expect(w.pozycje[0].okresy.map((o) => [o.do, o.odsetki])).toEqual([['2026-03-04', 64.79], ['2026-04-15', 60.41]]);
    expect(w.pozycje[0].dni).toBe(85);
    expect(w.odsetki).toBe(125);
  });
  it('błędy i pominięcia', () => {
    expect(obliczOdsetkiPodatkowe([{ kwota: 100, termin: '2026-01-01' }], '').blad).toBeTruthy();
    expect(obliczOdsetkiPodatkowe([{ kwota: 0, termin: '2026-01-01' }], '2026-02-01').blad).toBeTruthy();
    expect(obliczOdsetkiPodatkowe([{ kwota: 100, termin: '2015-05-01' }], '2016-02-01', { stawka: 'obnizona' }).blad).toMatch(/2016/);
    const przed = obliczOdsetkiPodatkowe([{ kwota: 100, termin: '2026-12-01' }], '2026-11-24');
    expect(przed.odsetki).toBe(0);
    expect(przed.pozycje[0].dni).toBe(0);
  });
});

describe('stawka obniżona – warunki (art. 56a)', () => {
  it('6 miesięcy od terminu deklaracji i 7 dni od korekty', () => {
    expect(plusMiesiace('2026-03-25', 6)).toBe('2026-09-25');
    expect(plusMiesiace('2026-08-31', 6)).toBe('2027-03-01'); // 28.02.2027 to niedziela
    expect(sprawdzObnizona('2026-03-25', '2026-09-25', '2026-10-02')).toEqual([]);
    expect(sprawdzObnizona('2026-03-25', '2026-09-28', '2026-10-06')).toHaveLength(2);
  });
});
