// Kalkulator inwestycyjny: (1) historia – „co by było, gdybym inwestował” na prawdziwych danych (S&P 500 z dywidendami,
// złoto, w USD i PLN), (2) prognoza – symulacja Monte Carlo (percentyle wyniku, szansa straty), (3) stopa zwrotu – ROI, CAGR.
// Dane: R. Shiller (S&P 500, CPI USA), Bank Światowy (złoto), NBP (USD/PLN), GUS (inflacja w Polsce – lib/inflacja).
import dane from '../data/inwestycje.json';
import { poziom } from './inflacja';

export type Instrument = 'spx-pln' | 'spx-usd' | 'zloto-pln' | 'zloto-usd';
export const INSTRUMENTY: Record<Instrument, { nazwa: string; waluta: 'PLN' | 'USD' }> = {
  'spx-pln': { nazwa: 'S&P 500 w złotych', waluta: 'PLN' },
  'spx-usd': { nazwa: 'S&P 500 w dolarach', waluta: 'USD' },
  'zloto-pln': { nazwa: 'złoto w złotych', waluta: 'PLN' },
  'zloto-usd': { nazwa: 'złoto w dolarach', waluta: 'USD' },
};
const BELKA = 0.19;

type Seria = { od: string; v: number[] };
const S = dane as unknown as Record<'spx' | 'cpiUS' | 'zloto' | 'usdpln', Seria>;
const idx = (ym: string) => +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1;
export const ym = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const wart = (s: Seria, m: string) => { const i = idx(m) - idx(s.od); return i >= 0 && i < s.v.length ? s.v[i] : null; };
const koniec = (s: Seria) => ym(idx(s.od) + s.v.length - 1);

export function cena(ins: Instrument, m: string): number | null {
  const baza = ins.startsWith('spx') ? wart(S.spx, m) : wart(S.zloto, m);
  if (baza == null) return null;
  if (ins.endsWith('usd')) return baza;
  const k = wart(S.usdpln, m);
  return k == null ? null : baza * k;
}
export function zakres(ins: Instrument): [string, string] {
  const s = ins.startsWith('spx') ? S.spx : S.zloto;
  const od = ins.endsWith('pln') ? (s.od > S.usdpln.od ? s.od : S.usdpln.od) : s.od;
  const kon = ins.endsWith('pln') ? [koniec(s), koniec(S.usdpln)].sort()[0] : koniec(s);
  return [od, kon];
}
/** Poziom cen konsumpcyjnych (do wyniku realnego). */
function cpi(waluta: 'PLN' | 'USD', m: string): number | null {
  if (waluta === 'USD') return wart(S.cpiUS, m) ?? wart(S.cpiUS, koniec(S.cpiUS));
  return poziom({ rok: +m.slice(0, 4), mies: +m.slice(5, 7) }) ?? null;
}

/** Roczna stopa zwrotu (IRR) z przepływów miesięcznych. */
export function irr(przeplywy: number[]): number {
  const npv = (r: number) => przeplywy.reduce((s, x, i) => s + x / Math.pow(1 + r, i), 0);
  let lo = -0.99, hi = 1;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (npv(lo) * npv(m) <= 0) hi = m; else lo = m; }
  return Math.pow(1 + (lo + hi) / 2, 12) - 1;
}

export interface DaneHistorii {
  ins: Instrument; od: string; do: string; kwota: number; miesiecznie?: number;
  /** prowizja od zakupu, % */
  prowizja?: number;
  /** roczna opłata za zarządzanie (TER), % */
  oplata?: number;
  ike?: boolean;
}

export function historia(d: DaneHistorii) {
  const { waluta } = INSTRUMENTY[d.ins];
  const a = idx(d.od), b = idx(d.do);
  if (b <= a) return null;
  if (cena(d.ins, d.od) == null || cena(d.ins, d.do) == null) return null;
  let jednostki = 0, wplaty = 0, wplatyRealne = 0, szczytCeny = 0, spadekCeny = 0;
  const cpiB = cpi(waluta, d.do) ?? cpi(waluta, ym(b - 1));
  const przeplywy: number[] = [];
  const lata: { rok: number; wplaty: number; wartosc: number }[] = [];
  for (let i = a; i <= b; i++) {
    const m = ym(i), p = cena(d.ins, m)!;
    if (i > a) jednostki *= 1 - (d.oplata ?? 0) / 100 / 12;
    let x = 0;
    if (i < b) { x = (i === a ? d.kwota : 0) + (d.miesiecznie ?? 0); }
    if (x > 0) {
      jednostki += (x * (1 - (d.prowizja ?? 0) / 100)) / p; wplaty += x;
      const c = cpi(waluta, m); wplatyRealne += cpiB && c ? x * cpiB / c : x;
    }
    przeplywy.push(-x);
    const v = jednostki * p;
    szczytCeny = Math.max(szczytCeny, p); spadekCeny = Math.max(spadekCeny, 1 - p / szczytCeny);
    if (m.endsWith('-12') || i === b) lata.push({ rok: +m.slice(0, 4), wplaty, wartosc: v });
  }
  const wartosc = jednostki * cena(d.ins, d.do)!;
  przeplywy[przeplywy.length - 1] += wartosc;
  const zysk = wartosc - wplaty;
  const podatek = d.ike || zysk <= 0 ? 0 : zysk * BELKA;
  const netto = wartosc - podatek;
  const stopa = irr(przeplywy.map((x, i) => (i === przeplywy.length - 1 ? x - podatek : x)));
  // najgorszy i najlepszy rok kalendarzowy instrumentu w okresie (grudzień do grudnia)
  let najgorszy: { rok: number; zmiana: number } | null = null, najlepszy: { rok: number; zmiana: number } | null = null;
  for (let r = +d.od.slice(0, 4) + 1; r <= +d.do.slice(0, 4); r++) {
    const p0 = cena(d.ins, `${r - 1}-12`), p1 = cena(d.ins, `${r}-12`);
    if (p0 == null || p1 == null || idx(`${r - 1}-12`) < a || idx(`${r}-12`) > b) continue;
    const z = p1 / p0 - 1;
    if (!najgorszy || z < najgorszy.zmiana) najgorszy = { rok: r, zmiana: z };
    if (!najlepszy || z > najlepszy.zmiana) najlepszy = { rok: r, zmiana: z };
  }
  return {
    waluta, wplaty, wartosc, zysk, podatek, netto, stopa, wplatyRealne, zyskRealny: netto - wplatyRealne,
    spadekCeny, najgorszy, najlepszy, lata, miesiecy: b - a,
  };
}
export type WynikHistorii = NonNullable<ReturnType<typeof historia>>;

// ---------- prognoza (Monte Carlo) ----------
export const PROFILE: Record<string, { nazwa: string; stopa: number; zmiennosc: number }> = {
  akcje: { nazwa: 'akcje światowe (ETF)', stopa: 7, zmiennosc: 16 },
  sp500: { nazwa: 'S&P 500', stopa: 8, zmiennosc: 16 },
  mieszany: { nazwa: 'portfel 60/40 (akcje/obligacje)', stopa: 6, zmiennosc: 10 },
  obligacje: { nazwa: 'obligacje', stopa: 4.5, zmiennosc: 4 },
  zloto: { nazwa: 'złoto', stopa: 5, zmiennosc: 15 },
  lokata: { nazwa: 'lokata / konto', stopa: 4, zmiennosc: 0 },
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface DanePrognozy { kwota: number; miesiecznie: number; lata: number; stopa: number; zmiennosc: number; koszty?: number; ike?: boolean; inflacja?: number; sciezek?: number }

export function prognoza(d: DanePrognozy) {
  const n = Math.max(1, Math.round(d.lata * 12));
  const N = d.sciezek ?? 2000;
  const mu = Math.log(1 + d.stopa / 100) - Math.log(1 + (d.koszty ?? 0) / 100);
  const sd = d.zmiennosc / 100;
  const dryf = (mu - (sd * sd) / 2) / 12, vol = sd / Math.sqrt(12);
  const los = rng(12345);
  const lataN = Math.ceil(n / 12);
  const roczne: number[][] = Array.from({ length: lataN }, () => []);
  const konce: number[] = [];
  const wplaty = d.kwota + d.miesiecznie * n;
  for (let s = 0; s < N; s++) {
    let v = d.kwota;
    for (let m = 1; m <= n; m++) {
      v += d.miesiecznie;
      const u1 = los() || 1e-12, u2 = los();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v *= Math.exp(dryf + vol * z);
      if (m % 12 === 0 || m === n) roczne[Math.ceil(m / 12) - 1].push(v);
    }
    konce.push(v);
  }
  const netto = (v: number) => v - (d.ike ? 0 : Math.max(0, v - wplaty) * BELKA);
  const pct = (arr: number[], p: number) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const defl = Math.pow(1 + (d.inflacja ?? 0) / 100, n / 12);
  const wplatyDoRoku = (r: number) => d.kwota + d.miesiecznie * Math.min(n, r * 12);
  return {
    wplaty,
    p10: netto(pct(konce, 0.1)), p50: netto(pct(konce, 0.5)), p90: netto(pct(konce, 0.9)),
    szansaStraty: konce.filter((v) => netto(v) < wplaty).length / N,
    realnieP50: netto(pct(konce, 0.5)) / defl,
    sciezka: roczne.map((r, i) => ({ rok: i + 1, wplaty: wplatyDoRoku(i + 1), p10: pct(r, 0.1), p50: pct(r, 0.5), p90: pct(r, 0.9) })),
  };
}

// ---------- stopa zwrotu ----------
export interface DaneZwrotu { zainwestowano: number; wartosc: number; dochody?: number; prowizje?: number; od: string; do: string; ike?: boolean }
export function stopaZwrotu(d: DaneZwrotu) {
  const lata = (idx(d.do) - idx(d.od)) / 12;
  const koszt = d.zainwestowano + (d.prowizje ?? 0);
  const koncowa = d.wartosc + (d.dochody ?? 0);
  const zysk = koncowa - koszt;
  const podatek = d.ike || d.wartosc - koszt <= 0 ? 0 : (d.wartosc - koszt) * BELKA; // dochody (dywidendy) zwykle już opodatkowane
  const roi = koszt > 0 ? zysk / koszt : 0;
  const cagr = lata > 0 && koszt > 0 && koncowa > 0 ? Math.pow(koncowa / koszt, 1 / lata) - 1 : NaN;
  const cagrNetto = lata > 0 && koszt > 0 ? Math.pow((koncowa - podatek) / koszt, 1 / lata) - 1 : NaN;
  const a = poziom({ rok: +d.od.slice(0, 4), mies: +d.od.slice(5, 7) }), b = poziom({ rok: +d.do.slice(0, 4), mies: +d.do.slice(5, 7) });
  const inflacja = a && b ? b / a - 1 : null;
  const cagrRealny = inflacja != null && lata > 0 ? Math.pow((koncowa - podatek) / koszt / (1 + inflacja), 1 / lata) - 1 : null;
  return { lata, zysk, roi, cagr, podatek, netto: koncowa - podatek, cagrNetto, inflacja, cagrRealny };
}
