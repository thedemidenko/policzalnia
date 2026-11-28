import { describe, expect, it } from 'vitest';
import { buforStala, buforZmienna, obliczZdolnosc, potrzebnyDochod, stopaRef } from '../src/lib/zdolnosc';

describe('bufor stopy procentowej – wzory Rekomendacji S (uchwała KNF 242/2023)', () => {
  it('stopa zmienna, XI 2026: stopa NBP 3,75%, stabilna → MAX(5 − 3,75; 2,5) + 0 = 2,5 pp', () => {
    expect(stopaRef('2026-11-28')).toBe(3.75);
    expect(buforZmienna('2026-11-28')).toEqual({ bufor: 2.5, ref: 3.75, sigma: 0 });
  });
  it('stopa zmienna w czasie podwyżek (VII 2022): σ = 1,5 pp, bufor 2,5 + 1,5 = 4 pp', () => {
    const b = buforZmienna('2022-07-15');
    expect(b.sigma).toBe(1.5);
    expect(b.bufor).toBe(4);
  });
  it('stopa okresowo stała: 2,5 pp × (T − x)/(T − 60)', () => {
    expect(buforStala(360, 60)).toBe(2.5);
    expect(buforStala(360, 120)).toBe(2);
    expect(buforStala(360, 360)).toBe(0);
  });
});

describe('zdolność kredytowa', () => {
  const b = { data: '2026-11-28', rok: 2026, lata: 30, oprocentowanie: 5.28, typ: 'zmienne' as const };
  it('singiel 4000 zł netto: limit raty 40% (dochód poniżej przeciętnego) = 1600 zł, rata liczona przy 7,78%', () => {
    const z = obliczZdolnosc({ ...b, dochod: 4000, kredytobiorcy: 1, osoby: 1 });
    expect(z.dsti).toBe(0.4);
    expect(z.rataMax).toBe(1600);
    expect(z.stopaTestowa).toBe(7.78);
    expect(z.kwota).toBe(222000);
  });
  it('wynik mieści się w przedziale rankingu Totalmoney z XI 2026 (singiel 4000 zł: 176,5–296,4 tys. zł; para z dzieckiem 6400 zł: 111,3–413,2 tys.)', () => {
    const s = obliczZdolnosc({ ...b, dochod: 4000, kredytobiorcy: 1, osoby: 1 }).kwota;
    expect(s).toBeGreaterThan(176500); expect(s).toBeLessThan(296400);
    const p = obliczZdolnosc({ ...b, dochod: 6400, kredytobiorcy: 2, osoby: 3 }).kwota;
    expect(p).toBeGreaterThan(111300); expect(p).toBeLessThan(413200);
  });
  it('dochód ponad przeciętne – limit 50%; inne raty i limity kart (3%) zmniejszają zdolność', () => {
    const z = obliczZdolnosc({ ...b, dochod: 9000, kredytobiorcy: 1, osoby: 1 });
    expect(z.dsti).toBe(0.5);
    const zr = obliczZdolnosc({ ...b, dochod: 9000, kredytobiorcy: 1, osoby: 1, raty: 500, limity: 10000 });
    expect(zr.zobowiazania).toBe(800);
    expect(zr.rataMax).toBe(4500 - 800);
  });
  it('rodzina: koszty utrzymania mogą ograniczać bardziej niż DStI', () => {
    const z = obliczZdolnosc({ ...b, dochod: 7000, kredytobiorcy: 2, osoby: 5, kosztPierwszej: 1500, kosztKolejnej: 1000 });
    expect(z.ogranicza).toBe('koszty');
    expect(z.rataMax).toBe(7000 - 5500);
  });
  it('stała stopa: bufor 2,5 pp od wyższej stopy – mniejsza zdolność niż przy zmiennej', () => {
    const zm = obliczZdolnosc({ ...b, dochod: 8000, kredytobiorcy: 1, osoby: 1 }).kwota;
    const st = obliczZdolnosc({ ...b, dochod: 8000, kredytobiorcy: 1, osoby: 1, typ: 'stale', oprocentowanie: 6.1, okresStaly: 5 }).kwota;
    expect(st).toBeLessThan(zm);
  });
  it('odwrotnie: dochód potrzebny na kredyt', () => {
    const d = potrzebnyDochod(500000, { ...b, kredytobiorcy: 1, osoby: 1 });
    expect(obliczZdolnosc({ ...b, dochod: d, kredytobiorcy: 1, osoby: 1 }).kwota).toBeGreaterThanOrEqual(500000);
    expect(obliczZdolnosc({ ...b, dochod: d - 50, kredytobiorcy: 1, osoby: 1 }).kwota).toBeLessThan(500000);
  });
});
