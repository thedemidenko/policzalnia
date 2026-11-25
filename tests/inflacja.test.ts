import { describe, expect, it } from 'vitest';
import { inflacjaRoczna, inflacjaRr, OSTATNI, poziom, przelicz, przyszlosc, realnaZmiana } from '../src/lib/inflacja';

describe('inflacja – dane GUS', () => {
  it('ostatni miesiąc i inflacja r/r', () => {
    expect(OSTATNI).toBe('2026-10');
    expect(inflacjaRr(2026, 10)).toBeCloseTo(3.5, 9);
  });
  it('inflacja średnioroczna', () => {
    expect(inflacjaRoczna(2023)).toBeCloseTo(11.4, 9);
    expect(inflacjaRoczna(2025)).toBeCloseTo(3.6, 9);
  });
  it('łańcuch roczny zgodny z GUS', () => {
    expect(poziom({ rok: 2024 })! / poziom({ rok: 2023 })!).toBeCloseTo(1.036, 6);
    expect(poziom({ rok: 1951 })! / poziom({ rok: 1950 })!).toBeCloseTo(1.096, 6);
  });
});

describe('inflacja – przeliczanie', () => {
  it('grudzień do grudnia 2025: 2,4%', () => {
    expect(przelicz({ kwota: 100, od: { rok: 2024, mies: 12 }, do: { rok: 2025, mies: 12 } })!.skumulowana).toBeCloseTo(0.024, 9);
  });
  it('ten sam miesiąc – wskaźnik r/r GUS (październik 2026: 3,5%)', () => {
    expect(przelicz({ kwota: 100, od: { rok: 2025, mies: 10 }, do: { rok: 2026, mies: 10 } })!.wartosc).toBeCloseTo(103.5, 9);
  });
  it('1000 zł z 2000 r. to w 2025 r. ok. 2222 zł', () => {
    const w = przelicz({ kwota: 1000, od: { rok: 2000 }, do: { rok: 2025 } })!;
    expect(Math.round(w.wartosc)).toBe(2222);
    expect(w.silaNabywcza).toBeCloseTo(1000 / w.wspolczynnik, 9);
  });
  it('denominacja: 1 000 000 starych zł z 1990 r.', () => {
    const w = przelicz({ kwota: 1000000, od: { rok: 1990 }, do: { rok: 2025 } })!;
    expect(w.denominacja).toBe(true);
    expect(Math.round(w.wartosc)).toBe(2251);
    expect(przelicz({ kwota: 1000000, od: { rok: 1990 }, do: { rok: 2025 }, stareZlote: false })!.wartosc).toBeCloseTo(w.wartosc * 10000, 4);
  });
  it('przeliczanie wstecz – odwrotność', () => {
    const a = przelicz({ kwota: 100, od: { rok: 2010, mies: 3 }, do: { rok: 2020, mies: 8 } })!;
    const b = przelicz({ kwota: a.wartosc, od: { rok: 2020, mies: 8 }, do: { rok: 2010, mies: 3 } })!;
    expect(b.wartosc).toBeCloseTo(100, 9);
  });
  it('brak danych – null', () => {
    expect(przelicz({ kwota: 100, od: { rok: 1900 }, do: { rok: 2025 } })).toBeNull();
    expect(przelicz({ kwota: 100, od: { rok: 2026, mies: 12 }, do: { rok: 2025 } })).toBeNull();
  });
});

describe('inflacja – pensja i przyszłość', () => {
  it('pensja 6000 → 8000 zł (01.2020 → 10.2026) realnie spadła', () => {
    const r = realnaZmiana(6000, 8000, { rok: 2020, mies: 1 }, { rok: 2026, mies: 10 })!;
    expect(r.nominalna).toBeCloseTo(1 / 3, 9);
    expect(r.realna).toBeLessThan(0);
    expect(r.potrzebna).toBeGreaterThan(9000);
  });
  it('100 000 zł za 20 lat przy inflacji 3%', () => {
    const f = przyszlosc(100000, 20, 3);
    expect(Math.round(f.realnie)).toBe(55368);
    expect(Math.round(f.potrzebna)).toBe(180611);
  });
});
