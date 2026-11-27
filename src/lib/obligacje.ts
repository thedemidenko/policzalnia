// Detaliczne obligacje skarbowe – symulacja według listów emisyjnych MF.
// Wzory: wierzytelność przy wykupie W = N·Π(1+r_k) (EDO/ROS/ROD/TOS, kapitalizacja roczna), odsetki O = N·r (COI, co rok),
// O = N·r/12 (ROR/DOR, co miesiąc); przedterminowy wykup WP = N·Π(1+r_j)·(1 + r_k·a/ACT) − b, z ograniczeniem opłaty
// do narosłych odsetek (EDO, ROS, ROD, TOS; w ROR, DOR, COI tylko w 1. okresie). Kwoty na obligację zaokrąglane do grosza.
// Podatek Belki 19% od odsetek przy każdej wypłacie (art. 30a ust. 1 pkt 2 ustawy o PIT), zaokrąglany w górę (art. 63 § 1a OP).
import dane from '../data/obligacje.json';

export type Symbol = 'OTS' | 'ROR' | 'DOR' | 'TOS' | 'COI' | 'EDO' | 'ROS' | 'ROD';
export interface Typ {
  nazwa: string; mies: number; pierwsza: number; marza: number; oprocentowanie: 'stale' | 'ref' | 'inflacja';
  wyplata: 'wykup' | 'miesiecznie' | 'rocznie'; kapitalizacja: boolean; oplata: number;
  oplataTyp: 'doOdsetek' | 'pierwszyDoOdsetek' | 'bezOdsetek'; zamiana: number | null; rodzinne: boolean;
}
export const TYPY = dane.typy as Record<Symbol, Typ>;
export const SYMBOLE = Object.keys(TYPY) as Symbol[];
export const OFERTA = dane.oferta;
const N = 100;
// połówki groszy w górę – z tolerancją na błąd zapisu liczb (np. 98,375 zapisane jako 98,37499…)
const r2 = (x: number) => Math.round(x * 100 + (x >= 0 ? 1e-6 : -1e-6)) / 100;

export interface Zalozenia {
  /** inflacja w kolejnych latach oszczędzania, % (ostatnia wartość obowiązuje dalej) */
  inflacja: number[];
  /** stopa referencyjna NBP, % */
  ref: number;
  /** IKE/IKZE – bez podatku Belki */
  ike?: boolean;
}
export interface Przeplyw { mies: number; kwota: number; odsetki: number; podatek: number; oplata: number; opis: string }

const inflacjaRoku = (z: Zalozenia, rok: number) => z.inflacja.length ? z.inflacja[Math.min(rok - 1, z.inflacja.length - 1)] : 0;

/** Oprocentowanie w okresie odsetkowym k (k ≥ 1; dla ROR/DOR okres = miesiąc). */
export function stopa(sym: Symbol, k: number, z: Zalozenia): number {
  const t = TYPY[sym];
  if (k <= 1 || t.oprocentowanie === 'stale') return t.pierwsza;
  if (t.oprocentowanie === 'ref') return Math.max(0, z.ref) + t.marza;
  // inflacja ogłoszona w miesiącu przed okresem k = inflacja z (k−1). roku oszczędzania
  return Math.max(0, inflacjaRoku(z, k - 1)) + t.marza;
}

const podatek = (odsetki: number, z: Zalozenia) => (z.ike || odsetki <= 0 ? 0 : Math.ceil(r2(odsetki) * 0.19 * 100 - 1e-7) / 100);

/** Przepływy z n obligacji kupionych w miesiącu `start`, trzymanych do miesiąca H (z zamianą po wykupie, jeśli H dalej). */
export function lot(sym: Symbol, n: number, start: number, H: number, z: Zalozenia, gleb = 0): Przeplyw[] {
  const t = TYPY[sym];
  const out: Przeplyw[] = [];
  if (n <= 0 || H <= start) return out;
  const koniec = start + t.mies;
  const wyplac = (mies: number, kapital: number, odsetki: number, oplata: number, opis: string) => {
    const p = podatek(odsetki, z);
    out.push({ mies, kwota: r2(kapital + odsetki - p), odsetki: r2(odsetki), podatek: p, oplata: r2(oplata), opis });
  };

  if (H >= koniec) {
    // do terminu wykupu
    let koncowe = 0;
    if (t.wyplata === 'miesiecznie') {
      for (let k = 1; k <= t.mies; k++) {
        const o = r2((N * stopa(sym, k, z)) / 100 / 12) * n;
        if (k < t.mies) wyplac(start + k, 0, o, 0, 'odsetki');
        else { wyplac(start + k, n * N, o, 0, 'wykup'); koncowe = out.at(-1)!.kwota; }
      }
    } else if (t.wyplata === 'rocznie') {
      for (let k = 1; k <= t.mies / 12; k++) {
        const o = r2((N * stopa(sym, k, z)) / 100) * n;
        if (k < t.mies / 12) wyplac(start + 12 * k, 0, o, 0, 'odsetki');
        else { wyplac(start + 12 * k, n * N, o, 0, 'wykup'); koncowe = out.at(-1)!.kwota; }
      }
    } else {
      let w = N;
      if (t.mies < 12) w = N * (1 + (stopa(sym, 1, z) / 100) * (t.mies / 12));
      else for (let k = 1; k <= t.mies / 12; k++) w *= 1 + stopa(sym, k, z) / 100;
      const W = r2(w);
      wyplac(koniec, n * N, (W - N) * n, 0, 'wykup');
      koncowe = out.at(-1)!.kwota;
    }
    // zamiana na nową serię tej samej obligacji (zakładamy te same warunki oferty)
    if (H > koniec && t.zamiana && gleb < 60) {
      const n2 = Math.floor(koncowe / t.zamiana + 1e-9);
      if (n2 > 0) {
        out.push({ mies: koniec, kwota: -r2(n2 * t.zamiana), odsetki: 0, podatek: 0, oplata: 0, opis: `zamiana na ${n2} szt. po ${String(t.zamiana).replace('.', ',')} zł` });
        out.push(...lot(sym, n2, koniec, H, z, gleb + 1));
      }
    }
    return out;
  }

  // przedterminowy wykup w miesiącu H
  const h = H - start;
  if (t.oplataTyp === 'bezOdsetek') { out.push({ mies: H, kwota: n * N, odsetki: 0, podatek: 0, oplata: 0, opis: 'wcześniejszy wykup (bez odsetek)' }); return out; }
  const okresMies = t.wyplata === 'miesiecznie' ? 1 : 12;
  const k = Math.max(1, Math.ceil(h / okresMies));
  const frac = (h - okresMies * (k - 1)) / okresMies;
  // wypłacone już odsetki (ROR, DOR, COI) za pełne okresy przed k
  if (t.wyplata !== 'wykup') {
    for (let j = 1; j < k; j++) {
      const o = r2(t.wyplata === 'miesiecznie' ? (N * stopa(sym, j, z)) / 100 / 12 : (N * stopa(sym, j, z)) / 100) * n;
      wyplac(start + j * okresMies, 0, o, 0, 'odsetki');
    }
  }
  let baza = N;
  if (t.kapitalizacja) for (let j = 1; j < k; j++) baza *= 1 + stopa(sym, j, z) / 100;
  const okresowa = t.wyplata === 'miesiecznie' ? stopa(sym, k, z) / 100 / 12 : stopa(sym, k, z) / 100;
  const wartosc = baza * (1 + okresowa * frac);
  const narosle = wartosc - N;
  const ograniczona = t.oplataTyp === 'doOdsetek' || k === 1;
  const oplata = ograniczona ? Math.min(t.oplata, Math.max(0, narosle)) : t.oplata;
  const WP = r2(ograniczona ? Math.max(N, wartosc - oplata) : wartosc - oplata);
  // pokazujemy narosłe odsetki brutto i opłatę osobno; podatek od nadwyżki WP ponad 100 zł
  const p = podatek((WP - N) * n, z);
  const ods = r2(Math.max(0, narosle));
  out.push({ mies: H, kwota: r2(WP * n - p), odsetki: r2(ods * n), podatek: p, oplata: r2(Math.max(0, N + ods - WP) * n), opis: 'wcześniejszy wykup' });
  return out;
}

export interface DaneObligacji {
  sym: Symbol;
  kwota: number;
  /** horyzont w miesiącach */
  H: number;
  /** dokupowanie co miesiąc (zł), od 2. miesiąca do końca horyzontu */
  miesiecznie?: number;
  z: Zalozenia;
}

/** Roczna stopa zwrotu (IRR) z przepływów: ujemne = wpłaty. */
function irr(fl: { mies: number; kwota: number }[]): number {
  const npv = (r: number) => fl.reduce((s, f) => s + f.kwota / Math.pow(1 + r, f.mies / 12), 0);
  let lo = -0.99, hi = 1;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (npv(lo) * npv(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

export function oblicz(d: DaneObligacji) {
  const t = TYPY[d.sym];
  const H = Math.max(1, Math.round(d.H));
  const zakupy: { mies: number; n: number }[] = [];
  let reszta = d.kwota;
  const n0 = Math.floor(reszta / N + 1e-9);
  zakupy.push({ mies: 0, n: n0 }); reszta -= n0 * N;
  let wplaty = d.kwota;
  if ((d.miesiecznie ?? 0) > 0) for (let m = 1; m < H; m++) {
    reszta += d.miesiecznie!; wplaty += d.miesiecznie!;
    const n = Math.floor(reszta / N + 1e-9);
    if (n > 0) { zakupy.push({ mies: m, n }); reszta -= n * N; }
  }
  const przeplywy = zakupy.flatMap((p) => lot(d.sym, p.n, p.mies, H, d.z));
  const wplywy = przeplywy.filter((p) => p.kwota > 0);
  const zamiany = przeplywy.filter((p) => p.kwota < 0);
  const kupiono = zakupy.reduce((s, p) => s + p.n, 0);
  const odsetki = r2(przeplywy.reduce((s, p) => s + p.odsetki, 0));
  const pod = r2(przeplywy.reduce((s, p) => s + p.podatek, 0));
  const oplaty = r2(przeplywy.reduce((s, p) => s + p.oplata, 0));
  const koniec = r2(przeplywy.reduce((s, p) => s + p.kwota, 0) + reszta);
  const zysk = r2(koniec - wplaty);
  const stopaNetto = irr([
    ...zakupy.map((p) => ({ mies: p.mies, kwota: -p.n * N })),
    ...przeplywy.map((p) => ({ mies: p.kwota < 0 ? p.mies : Math.min(p.mies, H), kwota: p.kwota })),
  ]);
  let defl = 1;
  for (let m = 1; m <= H; m++) defl *= Math.pow(1 + inflacjaRoku(d.z, Math.ceil(m / 12)) / 100, 1 / 12);
  const realnie = r2(koniec / defl);
  const uwagi: string[] = [];
  if (H < t.mies && t.oplataTyp !== 'bezOdsetek') uwagi.push(`Obligacje ${d.sym} trwają ${t.mies >= 12 ? t.mies / 12 + ' ' + (t.mies === 12 ? 'rok' : t.mies / 12 < 5 ? 'lata' : 'lat') : t.mies + ' miesiące'} – przy wcześniejszym wykupie płacisz ${String(t.oplata.toFixed(2)).replace('.', ',')} zł od obligacji${t.oplataTyp === 'doOdsetek' ? ' (nie więcej niż narosłe odsetki)' : ''}.`);
  if (H < t.mies && t.oplataTyp === 'bezOdsetek') uwagi.push('Przy wcześniejszym wykupie OTS nie dostaniesz odsetek – tylko 100 zł za obligację.');
  if (H > t.mies && !t.zamiana) uwagi.push(`Obligacji ${d.sym} nie można zamienić na nową serię – po wykupie pieniądze czekają na koncie.`);
  if (H > t.mies && t.zamiana) uwagi.push(`Po wykupie zakładamy zamianę na nową serię ${d.sym} po ${String(t.zamiana.toFixed(2)).replace('.', ',')} zł na tych samych warunkach co dziś.`);
  if (t.wyplata !== 'wykup') uwagi.push('Odsetki wypłacane w trakcie (co miesiąc albo co rok) liczymy jako gotówkę – bez ponownego inwestowania.');
  if (t.rodzinne) uwagi.push('Obligacje rodzinne kupisz tylko jako beneficjent 800+ – do wysokości otrzymanego świadczenia.');
  if (d.kwota % N !== 0 || reszta > 0.005) uwagi.push(`Obligacja kosztuje 100 zł – ${r2(reszta).toLocaleString('pl-PL')} zł zostaje niezainwestowane.`);
  return { sym: d.sym, H, wplaty: r2(wplaty), kupiono, koniec, zysk, odsetki, podatek: pod, oplaty, stopaNetto, realnie, zyskRealny: r2(realnie - wplaty), przeplywy: [...wplywy, ...zamiany].sort((a, b) => a.mies - b.mies), uwagi };
}
export type WynikObligacji = ReturnType<typeof oblicz>;

/** Ile dostaniesz netto z 1 obligacji (100 zł) przy wykupie po kolejnych latach – tabela „wykup po kolejnych latach”. */
export function wykupPoLatach(sym: Symbol, z: Zalozenia) {
  const t = TYPY[sym];
  const lata = Math.max(1, Math.round(t.mies / 12));
  return Array.from({ length: lata }, (_, i) => {
    const H = Math.min(t.mies, (i + 1) * 12);
    const fl = lot(sym, 1, 0, H, z);
    return { rok: i + 1, stopa: stopa(sym, t.wyplata === 'miesiecznie' ? H : i + 1, z), netto: r2(fl.reduce((s, p) => s + p.kwota, 0)), oplata: r2(fl.reduce((s, p) => s + p.oplata, 0)) };
  });
}

/** Porównanie wszystkich serii na ten sam horyzont. */
export function porownaj(d: Omit<DaneObligacji, 'sym'>, rodzinne = false) {
  return SYMBOLE.filter((s) => rodzinne || !TYPY[s].rodzinne).map((s) => oblicz({ ...d, sym: s })).sort((a, b) => b.koniec - a.koniec);
}

/** „3,5; 3 / 2,5” → [3.5, 3, 2.5] */
export const parsujInflacje = (s: string) => s.split(/[;/|\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => Number.isFinite(x));
