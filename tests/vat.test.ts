import { describe, expect, it } from 'vitest';
import { obliczVat } from '../src/lib/vat';

describe('VAT', () => {
  it('netto → brutto 23%', () => expect(obliczVat(1000, 23, 'netto')).toEqual({ netto: 1000, vat: 230, brutto: 1230 }));
  it('brutto → netto 23%', () => expect(obliczVat(1230, 23, 'brutto')).toEqual({ netto: 1000, vat: 230, brutto: 1230 }));
  it('brutto → netto 8%, zaokrąglenie', () => expect(obliczVat(100, 8, 'brutto')).toEqual({ netto: 92.59, vat: 7.41, brutto: 100 }));
  it('0%', () => expect(obliczVat(500, 0, 'netto')).toEqual({ netto: 500, vat: 0, brutto: 500 }));
});
