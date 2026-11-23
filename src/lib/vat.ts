import { r2 } from './format';

export const STAWKI_VAT = [23, 8, 5, 0] as const;

export function obliczVat(kwota: number, stawkaProc: number, tryb: 'netto' | 'brutto') {
  const s = stawkaProc / 100;
  if (tryb === 'netto') {
    const netto = r2(kwota);
    const vat = r2(netto * s);
    return { netto, vat, brutto: r2(netto + vat) };
  }
  const brutto = r2(kwota);
  const netto = r2(brutto / (1 + s));
  return { netto, vat: r2(brutto - netto), brutto };
}
