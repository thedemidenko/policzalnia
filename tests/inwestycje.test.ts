import { describe, expect, it } from 'vitest';
import { cena, historia, irr, prognoza, stopaZwrotu, zakres } from '../src/lib/inwestycje';

describe('inwestycje – dane', () => {
  it('zakresy danych', () => {
    expect(zakres('spx-usd')[0]).toBe('1950-01');
    expect(zakres('spx-pln')[0]).toBe('2002-01');
    expect(zakres('zloto-usd')[0]).toBe('1960-01');
    expect(cena('zloto-usd', '2026-10')).toBe(4105);
  });
  it('złoto w PLN = USD × kurs NBP', () => {
    expect(cena('zloto-pln', '2026-10')).toBeCloseTo(4105 * 3.9102, 6);
  });
  it('IRR: 100 → 110 po 12 miesiącach = 10%', () => {
    expect(irr([-100, ...Array(11).fill(0), 110])).toBeCloseTo(0.1, 6);
  });
});

describe('inwestycje – historia', () => {
  it('10 000 zł w S&P 500 od 2002 r. – kilkukrotny wzrost, spadek w 2008', () => {
    const w = historia({ ins: 'spx-pln', od: '2002-01', do: '2026-10', kwota: 10000 })!;
    expect(w.wartosc).toBeGreaterThan(90000);
    expect(w.najgorszy!.rok).toBe(2008);
    expect(w.podatek).toBeCloseTo((w.wartosc - 10000) * 0.19, 6);
  });
  it('IKE – bez podatku, prowizja i opłata zmniejszają wynik', () => {
    const a = historia({ ins: 'spx-pln', od: '2010-01', do: '2026-10', kwota: 10000, ike: true })!;
    expect(a.podatek).toBe(0);
    const b = historia({ ins: 'spx-pln', od: '2010-01', do: '2026-10', kwota: 10000, ike: true, prowizja: 0.5, oplata: 0.5 })!;
    expect(b.wartosc).toBeLessThan(a.wartosc);
  });
  it('regularne wpłaty: wpłacone = liczba miesięcy × wpłata', () => {
    const w = historia({ ins: 'zloto-pln', od: '2016-01', do: '2026-01', kwota: 0, miesiecznie: 500 })!;
    expect(w.wplaty).toBe(120 * 500);
    expect(w.wplatyRealne).toBeGreaterThan(w.wplaty);
  });
  it('kryzys 2007–2009 – strata', () => {
    const w = historia({ ins: 'spx-usd', od: '2007-10', do: '2009-02', kwota: 10000 })!;
    expect(w.zysk).toBeLessThan(0);
    expect(w.spadekCeny).toBeGreaterThan(0.4);
  });
  it('poza zakresem danych – null', () => {
    expect(historia({ ins: 'spx-pln', od: '1995-01', do: '2026-10', kwota: 100 })).toBeNull();
  });
});

describe('inwestycje – prognoza i stopa zwrotu', () => {
  it('bez zmienności – wszystkie percentyle równe', () => {
    const p = prognoza({ kwota: 10000, miesiecznie: 500, lata: 20, stopa: 4, zmiennosc: 0 });
    expect(p.p10).toBeCloseTo(p.p90, 6);
    expect(p.szansaStraty).toBe(0);
  });
  it('z ryzykiem: p10 < p50 < p90, szansa straty maleje z czasem', () => {
    const k = prognoza({ kwota: 10000, miesiecznie: 500, lata: 5, stopa: 7, zmiennosc: 16 });
    const d = prognoza({ kwota: 10000, miesiecznie: 500, lata: 25, stopa: 7, zmiennosc: 16 });
    expect(k.p10 < k.p50 && k.p50 < k.p90).toBe(true);
    expect(d.szansaStraty).toBeLessThan(k.szansaStraty);
    expect(prognoza({ kwota: 10000, miesiecznie: 500, lata: 5, stopa: 7, zmiennosc: 16 }).p50).toBe(k.p50); // powtarzalność
  });
  it('stopa zwrotu: 10 000 → 15 000 zł w 6 lat i 9 mies.', () => {
    const s = stopaZwrotu({ zainwestowano: 10000, wartosc: 15000, od: '2020-01', do: '2026-10' });
    expect(s.roi).toBeCloseTo(0.5, 9);
    expect(s.cagr).toBeCloseTo(Math.pow(1.5, 1 / 6.75) - 1, 9);
    expect(s.podatek).toBe(950);
    expect(s.cagrRealny!).toBeLessThan(0);
  });
});
