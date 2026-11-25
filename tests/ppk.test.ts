import { describe, expect, it } from 'vitest';
import { obliczPPK, progDoplaty, progObnizonej, zwrot, zwrotTeraz } from '../src/lib/ppk';

describe('PPK – progi z ustawy', () => {
  it('próg dopłaty rocznej 3,5% × 6× płaca minimalna', () => {
    expect([progDoplaty(2026), progDoplaty(2027)]).toEqual([1009.26, 1039.5]);
  });
  it('próg obniżonej wpłaty 1,2× płaca minimalna', () => {
    expect([progObnizonej(2026), progObnizonej(2027)]).toEqual([5767.2, 5940]);
  });
});

describe('PPK – oszczędzanie', () => {
  const baza = { brutto: 8000, wiek: 30, rok: 2026 } as const;
  it('miesięcznie: 160 zł twojej wpłaty, 120 zł pracodawcy, 14,40 zł PIT', () => {
    const w = obliczPPK(baza);
    expect(w.mies1).toEqual({ wlasna: 160, pracodawcy: 120, pit: 14.4 });
    expect([w.naRekeMniej, w.naKontoMiesiecznie]).toEqual([174.4, 280]);
  });
  it('5 lat bez zysku: powitalna + 4 dopłaty, zwrot i tak na plusie', () => {
    const w = obliczPPK({ ...baza, stopa: 0, wzrostPlac: 0, wiekWyplaty: 35 });
    expect([w.wlasne, w.pracodawca, w.panstwo]).toEqual([9600, 7200, 1210]);
    expect(w.zwrot.naKonto).toBe(14640);
    expect(w.zwrot.doZus).toBe(2160);
    expect(w.kosztTwoj).toBe(10464);
  });
  it('30 lat, 5% i wzrost płac 3% – ok. 342 tys. zł, PPK lepsze niż samodzielne odkładanie', () => {
    const w = obliczPPK({ ...baza, stopa: 5, wzrostPlac: 3 });
    expect(Math.round(w.wartosc)).toBe(342304);
    expect(w.rata120).toBe(2139.4);
    expect(w.podatekCalosc).toBe(24971.86);
    expect(w.przewaga).toBeGreaterThan(150000);
  });
  it('bez PIT (ulga dla młodych) koszt własny = same wpłaty', () => {
    const w = obliczPPK({ ...baza, stopa: 0, wzrostPlac: 0, wiekWyplaty: 31, pit: 0 });
    expect(w.kosztTwoj).toBe(w.wlasne);
  });
  it('obniżona wpłata przy wysokiej pensji – ostrzeżenie', () => {
    expect(obliczPPK({ ...baza, wplata: 0.5 }).uwagi.length).toBe(1);
    expect(obliczPPK({ ...baza, brutto: 5000, wplata: 0.5 }).uwagi.length).toBe(0);
  });
  it('dopłata roczna nie przysługuje, gdy wpłaty są poniżej progu', () => {
    const w = obliczPPK({ brutto: 1500, wiek: 50, wiekWyplaty: 53, stopa: 0, wzrostPlac: 0, rok: 2026 });
    expect(w.panstwo).toBe(250);
  });
});

describe('PPK – zwrot', () => {
  it('30% wpłat pracodawcy do ZUS, dopłaty do Funduszu Pracy, podatek od zysku', () => {
    const z = zwrot({ wartosc: 11000, wplaty: 10000 }, { wartosc: 8250, wplaty: 7500 }, { wartosc: 800, wplaty: 730 });
    expect(z.doZus).toBe(2475);
    expect(z.podatek).toBe(r(190 + 0.19 * 0.7 * 750));
    expect(z.naKonto).toBe(r(11000 + 5775 - z.podatek));
  });
  it('zwrot teraz z wyciągu', () => {
    const z = zwrotTeraz(8000, 6000, 730, 17000);
    expect(z.naKonto).toBe(13722.88);
    expect(z.koszt).toBe(8720);
    expect(z.zyskNaZwrocie).toBeGreaterThan(5000);
  });
});

function r(x: number) { return Math.round(x * 100) / 100; }
