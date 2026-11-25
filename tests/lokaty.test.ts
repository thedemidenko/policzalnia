import { describe, expect, it } from 'vitest';
import { dniMiedzy, kwotaNaCel, obliczLokate, plusMiesiecy, podatekBelki } from '../src/lib/lokaty';

const baza = { kwota: 10000, stopa: 6, okres: 3, jednostka: 'miesiace', start: '2026-11-25' } as const;

describe('lokata – podstawy', () => {
  it('10 000 zł, 6%, 3 miesiące: 150 zł odsetek, 28,50 zł podatku', () => {
    const w = obliczLokate(baza);
    expect([w.odsetki, w.podatek, w.netto, w.koncowa]).toEqual([150, 28.5, 121.5, 10121.5]);
  });
  it('podatek Belki zaokrąglany w górę do grosza (art. 63 § 1a)', () => {
    expect(podatekBelki(100.01)).toBe(19.01);
    expect(podatekBelki(126.03)).toBe(23.95);
    expect(podatekBelki(0.01)).toBe(0.01);
    expect(podatekBelki(100)).toBe(19);
  });
  it('liczenie za dni rzeczywiste / 365', () => {
    const w = obliczLokate({ ...baza, stopa: 5, baza: '365' });
    expect(w.dni).toBe(92);
    expect([w.odsetki, w.podatek, w.netto]).toEqual([126.03, 23.95, 102.08]);
  });
  it('baza 360 daje więcej odsetek', () => {
    expect(obliczLokate({ ...baza, baza: '360' }).odsetki).toBe(153.33);
  });
  it('okres w dniach', () => {
    const w = obliczLokate({ kwota: 50000, stopa: 4, okres: 30, jednostka: 'dni', baza: '365' });
    expect(w.odsetki).toBe(164.38);
  });
  it('dodawanie miesięcy i dni', () => {
    expect(plusMiesiecy('2026-01-31', 1)).toBe('2026-02-28');
    expect(dniMiedzy('2027-11-25', plusMiesiecy('2027-11-25', 3))).toBe(92);
  });
});

describe('lokata – kapitalizacja, odnawianie, rentierska', () => {
  it('kapitalizacja miesięczna daje więcej niż na koniec', () => {
    const roczna = { kwota: 10000, stopa: 6, okres: 12, jednostka: 'miesiace' } as const;
    const koniec = obliczLokate(roczna);
    const mies = obliczLokate({ ...roczna, kapitalizacja: 'miesieczna' });
    expect(koniec.netto).toBe(486);
    expect(mies.netto).toBeGreaterThan(koniec.netto);
    expect(mies.okresy).toHaveLength(1);
  });
  it('lokata 3-miesięczna odnawiana 3 razy = rok z procentem składanym', () => {
    const w = obliczLokate({ ...baza, odnowienia: 3 });
    expect(w.okresy).toHaveLength(4);
    expect(w.okresy[0].saldo).toBe(10121.5);
    expect(w.okresy[1].odsetki).toBe(151.82);
    expect(w.lata).toBe(1);
  });
  it('rentierska: 100 000 zł, 6% – 405 zł miesięcznie na rękę', () => {
    const w = obliczLokate({ kwota: 100000, stopa: 6, okres: 12, jednostka: 'miesiace', kapitalizacja: 'wyplata' });
    expect(w.wyplacone).toBe(4860);
    expect(w.koncowa).toBe(104860);
  });
});

describe('lokata – podatki, inflacja, cel', () => {
  it('OKI: zamiast Belki 0,71% od nadwyżki ponad 25 000 zł', () => {
    const w = obliczLokate({ kwota: 100000, stopa: 6, okres: 12, jednostka: 'miesiace', podatek: 'oki' });
    expect([w.podatek, w.podatekOki, w.zysk, w.belkaGdyby]).toEqual([0, 532.5, 5467.5, 1140]);
  });
  it('OKI do 25 000 zł – zysk bez podatku', () => {
    expect(obliczLokate({ kwota: 20000, stopa: 5, okres: 6, jednostka: 'miesiace', podatek: 'oki' }).zysk).toBe(500);
  });
  it('bez podatku (IKE) i lokata firmowa – odsetki brutto', () => {
    expect(obliczLokate({ ...baza, podatek: 'brak' }).zysk).toBe(150);
    expect(obliczLokate({ ...baza, podatek: 'firma' }).uwagi.some((u) => u.includes('przychodem'))).toBe(true);
  });
  it('realny zysk po inflacji i stopa netto', () => {
    const w = obliczLokate({ kwota: 10000, stopa: 4, okres: 12, jednostka: 'miesiace', inflacja: 3.5 });
    expect(w.stopaNetto).toBeCloseTo(3.24, 2);
    expect(w.zyskRealny).toBeLessThan(0);
    expect(w.uwagi.some((u) => u.includes('inflacji'))).toBe(true);
  });
  it('próg BFG', () => {
    expect(obliczLokate({ kwota: 500000, stopa: 5, okres: 3, jednostka: 'miesiace' }).uwagi.some((u) => u.includes('BFG'))).toBe(true);
  });
  it('ile wpłacić, żeby zarobić 1000 zł netto w rok przy 5%', () => {
    const k = kwotaNaCel(1000, { stopa: 5, okres: 12, jednostka: 'miesiace' });
    expect(obliczLokate({ kwota: k, stopa: 5, okres: 12, jednostka: 'miesiace' }).zysk).toBeGreaterThanOrEqual(1000);
    expect(obliczLokate({ kwota: k - 1, stopa: 5, okres: 12, jednostka: 'miesiace' }).zysk).toBeLessThan(1000);
    expect(Math.abs(k - 24692)).toBeLessThan(3);
  });
  it('rentierska – ile mieć, żeby dostawać 1000 zł miesięcznie', () => {
    const k = kwotaNaCel(1000, { stopa: 5, okres: 12, jednostka: 'miesiace', kapitalizacja: 'wyplata' });
    expect(Math.abs(k - 296297)).toBeLessThan(30);
  });
});
