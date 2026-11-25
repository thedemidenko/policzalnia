import { describe, expect, it } from 'vitest';
import { obliczL4 } from '../src/lib/l4';

describe('obliczL4', () => {
  it('6000 zł, 14 dni, 80%: 138,06 zł dziennie', () => {
    const w = obliczL4({ forma: 'uop', brutto: 6000, dni: 14 });
    expect(w.podstawa).toBe(5177.4);
    expect(w.stawkaDzienna).toBe(138.06);
    expect(w.razem).toBe(1932.84);
    expect(w.dniPracodawca).toBe(14);
  });
  it('podział pracodawca / ZUS przy 33 dniach', () => {
    const w = obliczL4({ forma: 'uop', brutto: 7000, dni: 20, wczesniej: 25 });
    expect([w.dniPracodawca, w.dniZus]).toEqual([8, 12]);
  });
  it('50+: 14 dni u pracodawcy', () => {
    const w = obliczL4({ forma: 'uop', brutto: 7000, dni: 20, po50: true });
    expect([w.dniPracodawca, w.dniZus]).toEqual([14, 6]);
  });
  it('ciąża 100%, okres zasiłkowy 270 dni', () => {
    const w = obliczL4({ forma: 'uop', brutto: 7000, dni: 30, przyczyna: 'ciaza', wczesniej: 250 });
    expect(w.procent).toBe(100);
    expect(w.stawkaDzienna).toBe(201.34);
    expect(w.dniBez).toBe(10);
  });
  it('okres zasiłkowy 182 dni', () => {
    expect(obliczL4({ forma: 'uop', brutto: 7000, dni: 30, wczesniej: 170 }).dniBez).toBe(18);
  });
  it('JDG – ZUS od pierwszego dnia; minimalna podstawa 2026', () => {
    const w = obliczL4({ forma: 'jdg', brutto: 5652, dni: 10 });
    expect(w.dniPracodawca).toBe(0);
    expect(w.dniZus).toBe(10);
    expect(w.stawkaDzienna).toBe(130.06); // 4877,11 / 30 = 162,57 × 80%
  });
  it('okres wyczekiwania, wyjątek wypadek w drodze', () => {
    expect(obliczL4({ forma: 'zlecenie', brutto: 5000, dni: 5, krotko: true }).razem).toBe(0);
    expect(obliczL4({ forma: 'zlecenie', brutto: 5000, dni: 5, krotko: true, przyczyna: 'wypadek' }).razem).toBeGreaterThan(0);
  });
  it('ile mniej niż pensja', () => {
    const w = obliczL4({ forma: 'uop', brutto: 7000, dni: 30 });
    expect(w.razem).toBe(4832.1);
    expect(w.mniejNizPensja).toBe(2167.9);
  });
  it('błędy', () => {
    expect(obliczL4({ forma: 'uop', brutto: 0, dni: 5 }).blad).toBeTruthy();
    expect(obliczL4({ forma: 'uop', brutto: 5000, dni: 0 }).blad).toBeTruthy();
  });
});
