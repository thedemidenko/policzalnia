// Kredyt hipoteczny: harmonogram miesiąc po miesiącu, raty równe albo malejące, oprocentowanie zmienne (wskaźnik + marża)
// albo okresowo stałe (stała stopa przez N lat, potem wskaźnik + marża). Podwyższenie marży: ubezpieczenie pomostowe
// (do wpisu hipoteki) i ubezpieczenie niskiego wkładu (do spadku salda poniżej 80% wartości nieruchomości).
// RRSO jak w ustawie o kredycie hipotecznym: roczna efektywna stopa zrównująca wypłaconą kwotę (po prowizji) z ratami
// i innymi kosztami; przy stopie zmiennej przy założeniu, że wskaźnik się nie zmienia.
// Ustawa o kredycie hipotecznym (Dz.U. 2025 poz. 720): art. 39 (koszty przy wcześniejszej spłacie), art. 40 (rekompensata:
// stopa zmienna – tylko w ciągu 36 miesięcy, do 3% i do odsetek za rok; stopa stała – w okresie stałej stopy).
import dane from '../data/hipoteczny.json';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export type KluczWskaznika = keyof typeof dane.wskazniki;
export const WSKAZNIKI = dane.wskazniki as Record<KluczWskaznika, { nazwa: string; wartosc: number; data: string }>;
export const OFERTY = dane.oferty;
export const DOMYSLNE = dane.domyslne;

export type Raty = 'rowne' | 'malejace';
export interface DaneKredytu {
  /** kwota kredytu */
  kwota: number;
  /** wartość nieruchomości – do LTV i ubezpieczenia niskiego wkładu */
  wartosc?: number;
  lata: number;
  raty: Raty;
  /** 'zmienne' – wskaźnik + marża od początku; 'stale' – stała stopa przez okresStaly lat, potem wskaźnik + marża */
  typ: 'zmienne' | 'stale';
  wskaznik: number;
  marza: number;
  stala?: number;
  okresStaly?: number;
  /** prowizja w % kwoty kredytu (płatna z góry) */
  prowizja?: number;
  /** podwyższenie marży do wpisu hipoteki (pp) i liczba miesięcy */
  pomostowe?: { pp: number; miesiace: number };
  /** podwyższenie marży przy LTV ponad 80% (pp) */
  niskiWklad?: number;
  /** inne koszty miesięczne (ubezpieczenia) – do RRSO i kosztu całkowitego */
  kosztyMies?: number;
  /** zmiana wskaźnika od początku (pp) – test wzrostu stóp */
  szok?: number;
}

export interface MiesiacK { nr: number; stopa: number; rata: number; odsetki: number; kapital: number; saldo: number }
export interface WynikKredytu {
  harmonogram: MiesiacK[];
  pierwszaRata: number;
  ostatniaRata: number;
  /** rata po okresie stałej stopy (przy typie 'stale') */
  rataPoStalej: number | null;
  odsetki: number;
  prowizja: number;
  kosztyDodatkowe: number;
  /** całkowity koszt kredytu: odsetki + prowizja + inne koszty */
  koszt: number;
  /** całkowita kwota do zapłaty */
  doZaplaty: number;
  rrso: number;
  ltv: number | null;
  /** łączny koszt podwyższonej marży (pomostowe, niski wkład) w odsetkach */
  kosztUbezpieczen: number;
}

export const rataRowna = (S: number, r: number, n: number) => (n <= 0 ? S : Math.abs(r) < 1e-12 ? S / n : (S * r) / (1 - Math.pow(1 + r, -n)));

export function oblicz(x: DaneKredytu): WynikKredytu {
  const n = Math.max(1, Math.round(x.lata * 12));
  const K = r2(Math.max(0, x.kwota));
  const zmienna = Math.max(0, x.wskaznik + (x.szok ?? 0) + x.marza);
  const mStale = x.typ === 'stale' ? Math.min(n, Math.round((x.okresStaly ?? 5) * 12)) : 0;
  const prog80 = x.wartosc ? 0.8 * x.wartosc : Infinity;
  const harmonogram: MiesiacK[] = [];
  let saldo = K, rata = 0, poprzStopa = NaN, kosztUbezpieczen = 0;
  const kapitalStaly = r2(K / n);
  for (let m = 1; m <= n && saldo > 0.004; m++) {
    const baza = m <= mStale ? (x.stala ?? zmienna) : zmienna;
    let dod = 0;
    if (x.pomostowe && m <= x.pomostowe.miesiace) dod += x.pomostowe.pp;
    if (x.niskiWklad && saldo > prog80 + 0.004) dod += x.niskiWklad;
    const stopa = baza + dod;
    const r = stopa / 100 / 12;
    const odsetki = r2(saldo * r);
    kosztUbezpieczen = r2(kosztUbezpieczen + r2(saldo * dod / 100 / 12));
    let kapital: number;
    if (x.raty === 'rowne') {
      // rata przeliczana przy każdej zmianie oprocentowania na pozostały okres
      if (stopa !== poprzStopa) rata = r2(rataRowna(saldo, r, n - m + 1));
      kapital = m === n ? saldo : Math.min(saldo, r2(rata - odsetki));
    } else {
      kapital = m === n ? saldo : Math.min(saldo, kapitalStaly);
    }
    poprzStopa = stopa;
    saldo = r2(saldo - kapital);
    harmonogram.push({ nr: m, stopa, rata: r2(kapital + odsetki), odsetki, kapital, saldo });
  }
  const odsetki = r2(harmonogram.reduce((a, q) => a + q.odsetki, 0));
  const prowizja = r2(K * (x.prowizja ?? 0) / 100);
  const kosztyDodatkowe = r2((x.kosztyMies ?? 0) * harmonogram.length);
  const koszt = r2(odsetki + prowizja + kosztyDodatkowe);

  // RRSO: miesięczna stopa wewnętrzna przepływów (wypłata netto vs raty i koszty), w skali roku efektywnie
  const wyplata = K - prowizja;
  const przeplywy = harmonogram.map((q) => q.rata + (x.kosztyMies ?? 0));
  const npv = (i: number) => przeplywy.reduce((a, c, k) => a + c / Math.pow(1 + i, k + 1), 0) - wyplata;
  let lo = 0, hi = 0.05;
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; }
  const rrso = K > 0 ? Math.round((Math.pow(1 + (lo + hi) / 2, 12) - 1) * 10000) / 100 : 0;

  return {
    harmonogram, pierwszaRata: harmonogram[0]?.rata ?? 0, ostatniaRata: harmonogram.at(-1)?.rata ?? 0,
    rataPoStalej: x.typ === 'stale' && mStale < n ? harmonogram[mStale]?.rata ?? null : null,
    odsetki, prowizja, kosztyDodatkowe, koszt, doZaplaty: r2(K + koszt), rrso,
    ltv: x.wartosc ? Math.round((K / x.wartosc) * 1000) / 10 : null, kosztUbezpieczen,
  };
}

/** Lata: suma rat, odsetek i kapitału oraz saldo na koniec każdego roku. */
export function roczny(h: MiesiacK[]) {
  const lata: { rok: number; raty: number; odsetki: number; kapital: number; saldo: number }[] = [];
  h.forEach((q) => {
    const i = Math.floor((q.nr - 1) / 12);
    lata[i] ??= { rok: i + 1, raty: 0, odsetki: 0, kapital: 0, saldo: 0 };
    lata[i].raty = r2(lata[i].raty + q.rata); lata[i].odsetki = r2(lata[i].odsetki + q.odsetki); lata[i].kapital = r2(lata[i].kapital + q.kapital); lata[i].saldo = q.saldo;
  });
  return lata;
}

/** Najwyższa dopuszczalna rekompensata za wcześniejszą spłatę (art. 40) – szacunek dla spłaty w danym miesiącu. */
export function rekompensata(x: DaneKredytu, kwotaSplaty: number, miesiac: number): { mozliwa: boolean; max: number; opis: string } {
  if (x.typ === 'zmienne' || miesiac > Math.round((x.okresStaly ?? 5) * 12)) {
    if (x.typ === 'zmienne' && miesiac <= 36) {
      const stopa = x.wskaznik + x.marza;
      return { mozliwa: true, max: r2(Math.min(kwotaSplaty * 0.03, kwotaSplaty * stopa / 100)), opis: 'stopa zmienna, spłata w ciągu 36 miesięcy – najwyżej 3% kwoty i nie więcej niż odsetki za rok' };
    }
    return { mozliwa: false, max: 0, opis: 'stopa zmienna po 36 miesiącach – bez opłaty' };
  }
  return { mozliwa: true, max: NaN, opis: 'okres stałej stopy – opłata do wysokości kosztów banku związanych ze spłatą' };
}
