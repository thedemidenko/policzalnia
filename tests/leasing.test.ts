import { describe, expect, it } from 'vitest';
import { obliczLeasing, rataAnnuitetowa, stopaZRaty } from '../src/lib/leasing';

const baza = { wplata: 10, okres: 48, wykup: 10, stopa: 6.89 } as const;

describe('leasing – rata i suma opłat', () => {
  it('konsumencki 150 000 zł brutto, 10%/10%, 48 mies., 6,89%', () => {
    const w = obliczLeasing({ kto: 'prywatnie', cena: 150000, brutto: true, ...baza });
    expect(w.rataBrutto).toBe(2953.55);
    expect(w.sumaProc).toBeCloseTo(114.51, 2);
    expect(Math.round(w.kosztFinansowania * 1.23)).toBe(21770);
  });
  it('100 000 zł brutto → ok. 1969 zł', () => {
    expect(Math.round(obliczLeasing({ kto: 'prywatnie', cena: 100000, brutto: true, ...baza }).rataBrutto)).toBe(1969);
  });
  it('harmonogram schodzi do wykupu, odsetki = raty − kapitał', () => {
    const w = obliczLeasing({ kto: 'firma', cena: 100000, ...baza });
    expect(w.harmonogram.at(-1)!.saldo).toBe(w.wykup);
    expect(w.odsetki).toBeCloseTo(w.sumaRat - (w.finansowanie - w.wykup), 2);
  });
  it('oprocentowanie 0% – rata = (finansowanie − wykup) / n', () => {
    expect(rataAnnuitetowa(90000, 10000, 40, 0)).toBe(2000);
  });
  it('oprocentowanie z sumy opłat 115% → 7,11%', () => {
    expect(obliczLeasing({ kto: 'prywatnie', cena: 150000, wplata: 10, okres: 48, wykup: 10, tryb: 'suma', suma: 115 }).stopa).toBeCloseTo(7.11, 2);
  });
  it('oprocentowanie z raty wraca do stopy wejściowej', () => {
    const R = rataAnnuitetowa(135000, 15000, 48, 0.0689 / 12);
    expect(stopaZRaty(135000, 15000, 48, R) * 1200).toBeCloseTo(6.89, 6);
    const w = obliczLeasing({ kto: 'firma', cena: 150000, wplata: 10, okres: 48, wykup: 10, tryb: 'rata', rata: R });
    expect(w.stopa).toBeCloseTo(6.89, 2);
  });
  it('suma opłat poniżej 100% → ujemne oprocentowanie i uwaga', () => {
    const w = obliczLeasing({ kto: 'prywatnie', cena: 100000, wplata: 10, okres: 36, wykup: 10, tryb: 'suma', suma: 98 });
    expect(w.stopa).toBeLessThan(0);
    expect(w.uwagi.some((u) => u.includes('ujemne'))).toBe(true);
  });
});

describe('leasing – podatki w firmie', () => {
  const firma = { kto: 'firma', cena: 150000, ...baza, naped: 'spalinowy', vatowiec: true } as const;
  it('limit 100 000 zł: wartość z połową VAT 167 250 zł, proporcja 59,79%', () => {
    const w = obliczLeasing({ ...firma, podatek: 'liniowy' });
    expect(w.wartoscDoLimitu).toBe(167250);
    expect(w.proporcja).toBeCloseTo(0.5979, 4);
  });
  it('odsetki w całości w kosztach, kapitał proporcjonalnie (art. 23 ust. 5c)', () => {
    const w = obliczLeasing({ ...firma, podatek: 'liniowy', wykupDoFirmy: false });
    const kapital = w.wplata + w.sumaRat - w.odsetki;
    expect(w.kupLeasing).toBeCloseTo(kapital * 1.115 * w.proporcja + w.odsetki * 1.115, 1);
    expect(w.kupUtracony).toBeCloseTo(kapital * 1.115 * (1 - w.proporcja), 1);
  });
  it('rata po VAT i podatkach – skala 12%, 32%, ryczałt', () => {
    const p = obliczLeasing({ ...firma, podatek: 'liniowy' }).porownanie;
    const r = Object.fromEntries(p.map((x) => [x.podatek, Math.round(x.rataPoPodatkach)]));
    expect(r).toMatchObject({ skala12: 2837, skala32: 2403, ryczalt: 3293, liniowy: 2794 });
  });
  it('ryczałt: zero kosztów, tylko VAT', () => {
    const w = obliczLeasing({ ...firma, podatek: 'ryczalt' });
    expect([w.kup, w.oszczednosc]).toEqual([0, 0]);
    expect(w.vatOdliczony).toBeGreaterThan(0);
  });
  it('auto poniżej limitu – proporcja 100%', () => {
    expect(obliczLeasing({ ...firma, cena: 80000, podatek: 'liniowy' }).proporcja).toBe(1);
  });
  it('elektryk 225 000 zł, ciężarowy bez limitu i ze 100% VAT', () => {
    expect(obliczLeasing({ ...firma, cena: 250000, naped: 'elektryczny' }).proporcja).toBeCloseTo(225000 / 278750, 6);
    const c = obliczLeasing({ ...firma, cena: 250000, naped: 'ciezarowy' });
    expect([c.proporcja, c.vatOdl]).toEqual([1, 1]);
  });
  it('nievatowiec: limit liczony od brutto, brak odliczenia VAT', () => {
    const w = obliczLeasing({ ...firma, vatowiec: false, podatek: 'skala12' });
    expect(w.wartoscDoLimitu).toBe(184500);
    expect(w.vatOdliczony).toBe(0);
  });
  it('auto tylko firmowe: 100% VAT, limit od netto', () => {
    const w = obliczLeasing({ ...firma, tylkoFirma: true });
    expect([w.vatOdl, w.wartoscDoLimitu]).toEqual([1, 150000]);
  });
  it('umowa krótsza niż 24 mies. – raty nie są kosztem', () => {
    const w = obliczLeasing({ ...firma, okres: 18, wykupDoFirmy: false });
    expect(w.kupLeasing).toBe(0);
    expect(w.uwagi.some((u) => u.includes('24'))).toBe(true);
  });
  it('wykup do 10 000 zł jednorazowo w kosztach', () => {
    const w = obliczLeasing({ ...firma, cena: 80000, wykup: 1 });
    expect(w.wykupJednorazowo).toBe(true);
    expect(w.kupWykup).toBe(892);
  });
  it('eksploatacja: 50% VAT i 75% kosztów przy użytku mieszanym', () => {
    const bez = obliczLeasing({ ...firma, podatek: 'liniowy' });
    const z = obliczLeasing({ ...firma, podatek: 'liniowy', eksploatacja: 1230 });
    expect(r(z.vatOdliczony - bez.vatOdliczony)).toBe(48 * 115);
    expect(r(z.kupEksploatacja)).toBe(r(48 * (1230 - 115) * 0.75));
  });
  it('lata umowy sumują się do całości', () => {
    const w = obliczLeasing({ ...firma, podatek: 'skala32', eksploatacja: 500 });
    expect(w.lata).toHaveLength(4);
    expect(w.lata.reduce((s, l) => s + l.kup, 0)).toBeCloseTo(w.kup, 1);
    expect(w.lata.reduce((s, l) => s + l.oplaty, 0)).toBeCloseTo(w.sumaOplat, 1);
  });
});

const r = (x: number) => Math.round(x * 100) / 100;
