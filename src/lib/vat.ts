// VAT: przeliczenia netto ↔ brutto, kwota VAT (metoda „w stu”: brutto × s / (100 + s)), faktura z pozycjami
// (VAT od sumy wartości netto/brutto w każdej stawce – art. 106e ust. 1 pkt 14 – albo przy każdej pozycji),
// zaokrąglanie do grosza (art. 106e ust. 11), kwota słownie.
import { r2 } from './format';

export const STAWKI_VAT = [23, 8, 5, 0] as const;
export type StawkaVat = '23' | '8' | '5' | '0' | 'zw' | 'np';
export const procent = (s: StawkaVat) => (s === 'zw' || s === 'np' ? 0 : +s);

export function obliczVat(kwota: number, stawkaProc: number, tryb: 'netto' | 'brutto' | 'vat') {
  const s = stawkaProc / 100;
  if (tryb === 'netto') {
    const netto = r2(kwota);
    const vat = r2(netto * s);
    return { netto, vat, brutto: r2(netto + vat) };
  }
  if (tryb === 'vat') {
    const vat = r2(kwota);
    const netto = s > 0 ? r2(vat / s) : 0;
    return { netto, vat, brutto: r2(netto + vat) };
  }
  const brutto = r2(kwota);
  const netto = r2(brutto / (1 + s));
  return { netto, vat: r2(brutto - netto), brutto };
}

export interface Pozycja { cena: number; ilosc: number; stawka: StawkaVat }
export interface Suma { stawka: StawkaVat; netto: number; vat: number; brutto: number }
/** Podsumowanie faktury w podziale na stawki. tryb – czy ceny są netto czy brutto; metoda – VAT od sumy w stawce albo przy każdej pozycji. */
export function faktura(pozycje: Pozycja[], tryb: 'netto' | 'brutto', metoda: 'suma' | 'pozycje' = 'suma') {
  const grupy = new Map<StawkaVat, Suma>();
  for (const p of pozycje) {
    if (!(p.cena > 0) || !(p.ilosc > 0)) continue;
    const wartosc = r2(p.cena * p.ilosc);
    const g = grupy.get(p.stawka) ?? { stawka: p.stawka, netto: 0, vat: 0, brutto: 0 };
    if (metoda === 'pozycje') {
      const w = obliczVat(wartosc, procent(p.stawka), tryb);
      g.netto = r2(g.netto + w.netto); g.vat = r2(g.vat + w.vat); g.brutto = r2(g.brutto + w.brutto);
    } else if (tryb === 'netto') g.netto = r2(g.netto + wartosc);
    else g.brutto = r2(g.brutto + wartosc);
    grupy.set(p.stawka, g);
  }
  const sumy = [...grupy.values()].map((g) => (metoda === 'suma' ? { ...obliczVat(tryb === 'netto' ? g.netto : g.brutto, procent(g.stawka), tryb), stawka: g.stawka } : g));
  const kolej: StawkaVat[] = ['23', '8', '5', '0', 'zw', 'np'];
  sumy.sort((a, b) => kolej.indexOf(a.stawka) - kolej.indexOf(b.stawka));
  const razem = sumy.reduce((a, s) => ({ netto: r2(a.netto + s.netto), vat: r2(a.vat + s.vat), brutto: r2(a.brutto + s.brutto) }), { netto: 0, vat: 0, brutto: 0 });
  return { sumy, razem };
}

// --- kwota słownie
const JEDN = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const DZIES = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const SETKI = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];
const RZEDY: [string, string, string][] = [['', '', ''], ['tysiąc', 'tysiące', 'tysięcy'], ['milion', 'miliony', 'milionów'], ['miliard', 'miliardy', 'miliardów']];
export const odmiana = (n: number, f: [string, string, string]) => {
  if (n === 1) return f[0];
  const j = n % 10, d = n % 100;
  return j >= 2 && j <= 4 && (d < 12 || d > 14) ? f[1] : f[2];
};
function trojka(n: number): string {
  const s = Math.floor(n / 100), r = n % 100;
  return [SETKI[s], r < 20 ? JEDN[r] : `${DZIES[Math.floor(r / 10)]} ${JEDN[r % 10]}`.trim()].filter(Boolean).join(' ');
}
export function liczbaSlownie(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const czesci: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const t = n % 1000;
    if (t === 0) continue;
    if (i === 0) czesci.unshift(trojka(t));
    else czesci.unshift(t === 1 ? RZEDY[i][0] : `${trojka(t)} ${odmiana(t, RZEDY[i])}`);
  }
  return czesci.join(' ');
}
/** „tysiąc dwieście trzydzieści złotych 00/100” */
export function kwotaSlownie(kwota: number): string {
  const zl = Math.floor(r2(Math.abs(kwota))), gr = Math.round((r2(Math.abs(kwota)) - zl) * 100);
  return `${liczbaSlownie(zl)} ${odmiana(zl, ['złoty', 'złote', 'złotych'])} ${String(gr).padStart(2, '0')}/100`;
}
