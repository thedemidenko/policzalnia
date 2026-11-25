import { describe, expect, it } from 'vitest';
import { faktura, kwotaSlownie, liczbaSlownie, obliczVat } from '../src/lib/vat';

describe('VAT', () => {
  it('netto → brutto 23%', () => expect(obliczVat(1000, 23, 'netto')).toEqual({ netto: 1000, vat: 230, brutto: 1230 }));
  it('brutto → netto 23%', () => expect(obliczVat(1230, 23, 'brutto')).toEqual({ netto: 1000, vat: 230, brutto: 1230 }));
  it('brutto → netto 8%, zaokrąglenie', () => expect(obliczVat(100, 8, 'brutto')).toEqual({ netto: 92.59, vat: 7.41, brutto: 100 }));
  it('0%', () => expect(obliczVat(500, 0, 'netto')).toEqual({ netto: 500, vat: 0, brutto: 500 }));
  it('znam kwotę VAT', () => expect(obliczVat(230, 23, 'vat')).toEqual({ netto: 1000, vat: 230, brutto: 1230 }));
});

describe('faktura', () => {
  const p = [{ cena: 0.99, ilosc: 1, stawka: '23' as const }, { cena: 0.99, ilosc: 1, stawka: '23' as const }, { cena: 0.99, ilosc: 1, stawka: '23' as const }];
  it('VAT od sumy vs przy pozycjach – różnica grosza', () => {
    expect(faktura(p, 'netto', 'suma').razem).toEqual({ netto: 2.97, vat: 0.68, brutto: 3.65 });
    expect(faktura(p, 'netto', 'pozycje').razem).toEqual({ netto: 2.97, vat: 0.69, brutto: 3.66 });
  });
  it('kilka stawek, ilości, zw', () => {
    const w = faktura([{ cena: 100, ilosc: 3, stawka: '23' }, { cena: 50, ilosc: 2, stawka: '8' }, { cena: 200, ilosc: 1, stawka: 'zw' }], 'netto');
    expect(w.sumy.map((s) => [s.stawka, s.netto, s.vat, s.brutto])).toEqual([['23', 300, 69, 369], ['8', 100, 8, 108], ['zw', 200, 0, 200]]);
    expect(w.razem).toEqual({ netto: 600, vat: 77, brutto: 677 });
  });
  it('ceny brutto (paragon)', () => {
    expect(faktura([{ cena: 123, ilosc: 2, stawka: '23' }], 'brutto').razem).toEqual({ netto: 200, vat: 46, brutto: 246 });
  });
});

describe('słownie', () => {
  it('liczby', () => {
    expect(liczbaSlownie(1230)).toBe('tysiąc dwieście trzydzieści');
    expect(liczbaSlownie(2022)).toBe('dwa tysiące dwadzieścia dwa');
    expect(liczbaSlownie(15000)).toBe('piętnaście tysięcy');
    expect(liczbaSlownie(1_000_001)).toBe('milion jeden');
    expect(liczbaSlownie(112)).toBe('sto dwanaście');
  });
  it('kwoty', () => {
    expect(kwotaSlownie(1230)).toBe('tysiąc dwieście trzydzieści złotych 00/100');
    expect(kwotaSlownie(1)).toBe('jeden złoty 00/100');
    expect(kwotaSlownie(22.5)).toBe('dwadzieścia dwa złote 50/100');
    expect(kwotaSlownie(0.99)).toBe('zero złotych 99/100');
  });
});
