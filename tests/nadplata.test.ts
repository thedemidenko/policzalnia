import { describe, expect, it } from 'vitest';
import { ileRat, obliczNadplate, opisMiesiecy, rataRowna, saldoPo, symuluj } from '../src/lib/nadplata';

const kredyt = { saldo: 300000, stopa: 7, rat: 300 };

describe('nadpłata – raty równe', () => {
  it('bez nadpłat: rata 2120,34 zł, 300 rat', () => {
    const b = symuluj(kredyt, true);
    expect([b.rataPocz, b.rat]).toEqual([2120.34, 300]);
    expect(b.harm.at(-1)!.saldo).toBe(0);
  });
  it('30 000 zł nadpłaty – skrócenie okresu o 66 rat', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000 });
    expect(w.wynik.odsetki).toBe(225705.23);
    expect(w.wynik.rat).toBe(234);
    expect(w.skrocenie).toBe(66);
    expect(w.wynik.rataPo).toBe(2120.34);
  });
  it('30 000 zł nadpłaty – obniżenie raty do 1908,04 zł', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000, skutek: 'rata' });
    expect([w.wynik.odsetki, w.wynik.rat, w.wynik.rataPo]).toEqual([302625.67, 300, 1908.04]);
  });
  it('mix przy ratach równych = skrócenie okresu', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000, skutek: 'mix' });
    const [okres, , mix] = w.warianty;
    expect(mix.odsetki).toBe(okres.odsetki);
    expect(mix.rat).toBe(okres.rat);
    expect(mix.rataPo).toBe(1908.04);
  });
  it('nadpłata cykliczna 500 zł co miesiąc', () => {
    const w = obliczNadplate({ ...kredyt, cykliczna: 500 });
    expect(w.wynik.rat).toBe(190);
    expect(w.oszczednosc).toBeGreaterThan(139000);
  });
  it('cykliczna co 12 miesięcy, 3 razy', () => {
    const w = symuluj({ ...kredyt, cykliczna: 10000, coIle: 12, odMiesiaca: 6, ileRazy: 3 });
    expect(w.harm.filter((x) => x.nadplata > 0).map((x) => x.nr)).toEqual([6, 18, 30]);
    expect(w.nadplaty).toBe(30000);
  });
  it('prowizja 3% w pierwszych 12 miesiącach', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000, prowizja: 3, prowizjaMiesiecy: 12 });
    expect(w.wynik.prowizje).toBe(900);
    expect(w.oszczednosc).toBe(109494.93); // 336 100,16 − 225 705,23 − 900
  });
});

describe('nadpłata – raty malejące, zmiana stopy, inwestycja', () => {
  it('raty malejące: pierwsza rata 2750 zł, skrócenie o 30 rat', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000, raty: 'malejace' });
    expect(w.baza.rataPocz).toBe(2750);
    expect(w.baza.odsetki).toBe(263375);
    expect(w.wynik.rat).toBe(270);
  });
  it('spadek oprocentowania od 13. miesiąca – bank przelicza ratę', () => {
    const b = symuluj({ ...kredyt, nowaStopa: 5, odMiesiacaStopa: 13 }, true);
    expect(b.harm[11].rata).toBe(2120.34);
    expect(b.harm[12].rata).toBe(1763.3);
    expect(b.rat).toBe(300);
  });
  it('nadpłata przy 7% wygrywa z inwestycją na 5% z podatkiem Belki', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000 }, { stopa: 5, belka: true });
    expect(w.inwestycja!.lepsze).toBe('nadplata');
  });
  it('inwestycja na 10% bez podatku wygrywa z kredytem na 7%', () => {
    const w = obliczNadplate({ ...kredyt, jednorazowa: 30000 }, { stopa: 10, belka: false });
    expect(w.inwestycja!.lepsze).toBe('inwestycja');
  });
  it('pomocnicze: ileRat, saldoPo, opis', () => {
    expect(ileRat(300000, 0.07 / 12, rataRowna(300000, 0.07 / 12, 300))).toBe(300);
    expect(saldoPo(400000, 7, 360, 60)).toBe(376526.41);
    expect([opisMiesiecy(25), opisMiesiecy(12), opisMiesiecy(62)]).toEqual(['2 lata 1 miesiąc', '1 rok', '5 lat 2 miesiące']);
  });
});
