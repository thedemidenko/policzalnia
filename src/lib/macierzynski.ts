// Urlop macierzyński, rodzicielski, ojcowski i zasiłek macierzyński.
// Kodeks pracy: art. 180 (20/31/33/35/37 tyg., do 6 tyg. przed porodem), 180² (uzupełniający dla wcześniaków), 182¹a
// (rodzicielski 41/43 tyg., po 9 tyg. wyłącznie dla każdego rodzica), 182¹c (do końca roku 6. urodzin), 182³ (ojcowski 2 tyg.
// do 12. miesiąca życia). Ustawa zasiłkowa (Dz.U. 2026 poz. 854): art. 30a (wniosek do 21 dni po porodzie), art. 31 (100% /
// 70% / 81,5%; 9 tyg. drugiego rodzica zawsze 70%; nie mniej niż świadczenie rodzicielskie 1000 zł), art. 3 pkt 4 (13,71%).
import { dodajDni } from './kalendarz';

export type Wariant = '815' | '10070';
export const MACIERZYNSKI = { 1: 20, 2: 31, 3: 33, 4: 35, 5: 37 } as const;
export const ODLICZENIE = 0.1371;
export const SWIADCZENIE_RODZICIELSKIE = 1000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const rodzicielskiRazem = (dzieci: number) => (dzieci > 1 ? 43 : 41);
/** maks. tygodni rodzicielskiego dla jednego rodzica (bez 9 tyg. drugiego) */
export const rodzicielskiMaks = (dzieci: number) => rodzicielskiRazem(dzieci) - 9;
/** podstawa wymiaru zasiłku z wynagrodzenia brutto lub podstawy składek */
export const podstawaZasilku = (brutto: number) => r2(Math.max(0, brutto) * (1 - ODLICZENIE));

export interface DaneMacierzynski {
  porod: string;
  dzieci: 1 | 2 | 3 | 4 | 5;
  wariant: Wariant;
  podstawaMamy: number;
  /** tygodnie macierzyńskiego przed porodem (0–6) */
  przed?: number;
  /** tygodnie uzupełniającego urlopu macierzyńskiego (wcześniaki, 0–15) */
  uzupelniajacy?: number;
  /** tygodnie rodzicielskiego mamy (domyślnie maksimum) */
  rodzicielskiMamy?: number;
  /** tygodnie z części wspólnej, które bierze tata */
  tataWspolne?: number;
  /** tata bierze swoje 9 tygodni */
  tata9?: boolean;
  /** tata bierze urlop ojcowski (2 tygodnie) */
  ojcowski?: boolean;
  podstawaTaty?: number;
  pit2?: boolean;
}
export interface Okres {
  kto: 'mama' | 'tata';
  nazwa: string;
  od: string;
  do: string;
  tygodnie: number;
  procent: number;
  miesiecznie: number;
  miesiecznieNetto: number;
  razem: number;
  razemNetto: number;
  podwyzszono: boolean;
}
export interface WynikMacierzynski {
  okresy: Okres[];
  razem: number;
  razemNetto: number;
  porownanie: { wariant815: number; wariant10070: number };
  terminy: { nazwa: string; data: string }[];
  uwagi: string[];
  blad?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pl = (d: string) => d.split('-').reverse().join('.');
function plusMiesiace(d: string, n: number) {
  const m = +d.slice(5, 7) - 1 + n, r = +d.slice(0, 4) + Math.floor(m / 12), mm = (m % 12) + 1;
  const ost = new Date(Date.UTC(r, mm, 0)).getUTCDate();
  return `${r}-${String(mm).padStart(2, '0')}-${String(Math.min(+d.slice(8, 10), ost)).padStart(2, '0')}`;
}

/** Zasiłek miesięczny brutto i netto (zaliczka PIT 12%, z PIT-2 minus 300 zł), nie mniej niż 1000 zł netto. */
export function miesiecznie(podstawa: number, procent: number, pit2 = false) {
  let brutto = r2((podstawa * procent) / 100);
  const zaliczka = (b: number) => Math.max(0, Math.round(b * 0.12) - (pit2 ? 300 : 0));
  let netto = r2(brutto - zaliczka(brutto));
  let podwyzszono = false;
  if (netto < SWIADCZENIE_RODZICIELSKIE) {
    podwyzszono = true;
    netto = SWIADCZENIE_RODZICIELSKIE;
    // brutto, przy którym netto = 1000 zł
    let b = SWIADCZENIE_RODZICIELSKIE;
    while (r2(b - zaliczka(b)) < SWIADCZENIE_RODZICIELSKIE) b = r2(b + 0.01);
    brutto = Math.max(brutto, b);
  }
  return { brutto, netto, podwyzszono };
}

function plan(d: DaneMacierzynski, wariant: Wariant) {
  const okresy: Okres[] = [];
  const dzieci = d.dzieci;
  const maks = rodzicielskiMaks(dzieci), wspolnaMaks = maks - 9;
  const tataW = Math.min(Math.max(0, Math.floor(d.tataWspolne ?? 0)), wspolnaMaks);
  const mamaR = Math.min(Math.max(0, Math.floor(d.rodzicielskiMamy ?? maks)), maks - tataW);
  const przed = Math.min(6, Math.max(0, Math.floor(d.przed ?? 0)));
  const uzup = Math.min(15, Math.max(0, Math.floor(d.uzupelniajacy ?? 0)));
  const bezRodzicielskiego = mamaR + tataW === 0;
  let start = dodajDni(d.porod, -7 * przed);
  const dodaj = (kto: Okres['kto'], nazwa: string, tyg: number, procent: number, podstawa: number, od = start) => {
    if (tyg <= 0) return;
    const dni = tyg * 7, m = miesiecznie(podstawa, procent, d.pit2);
    const doD = dodajDni(od, dni - 1);
    okresy.push({ kto, nazwa, od, do: doD, tygodnie: tyg, procent, miesiecznie: m.brutto, miesiecznieNetto: m.netto,
      razem: r2((m.brutto * dni) / 30), razemNetto: r2((m.netto * dni) / 30), podwyzszono: m.podwyzszono });
    if (od === start) start = dodajDni(doD, 1);
  };
  const pctMac = wariant === '815' && !bezRodzicielskiego ? 81.5 : 100;
  const pctRodz = wariant === '815' ? 81.5 : 70;
  const pTaty = d.podstawaTaty ?? 0;
  dodaj('mama', 'Urlop macierzyński', MACIERZYNSKI[dzieci], pctMac, d.podstawaMamy);
  dodaj('mama', 'Uzupełniający urlop macierzyński', uzup, 100, d.podstawaMamy);
  dodaj('mama', 'Urlop rodzicielski', mamaR, pctRodz, d.podstawaMamy);
  if (pTaty > 0) {
    dodaj('tata', 'Urlop rodzicielski (część wspólna)', tataW, pctRodz, pTaty);
    if (d.tata9) dodaj('tata', 'Urlop rodzicielski – 9 tygodni taty', 9, 70, pTaty);
    if (d.ojcowski) dodaj('tata', 'Urlop ojcowski', 2, 100, pTaty, d.porod);
  }
  return { okresy, tataW, bezRodzicielskiego };
}

export function obliczMacierzynski(d: DaneMacierzynski): WynikMacierzynski {
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikMacierzynski => ({ okresy: [], razem: 0, razemNetto: 0, porownanie: { wariant815: 0, wariant10070: 0 }, terminy: [], uwagi, blad });
  if (!ISO.test(d.porod)) return pusty('Podaj datę porodu (albo przewidywaną).');
  if (!(d.podstawaMamy > 0)) return pusty('Podaj wynagrodzenie albo podstawę składek.');

  const { okresy, tataW, bezRodzicielskiego } = plan(d, d.wariant);
  const suma = (o: Okres[]) => r2(o.reduce((s, x) => s + x.razem, 0));
  const razem = suma(okresy), razemNetto = r2(okresy.reduce((s, x) => s + x.razemNetto, 0));
  const porownanie = { wariant815: suma(plan(d, '815').okresy), wariant10070: suma(plan(d, '10070').okresy) };

  const maks = rodzicielskiMaks(d.dzieci);
  if ((d.rodzicielskiMamy ?? maks) + (d.tataWspolne ?? 0) > maks) uwagi.push(`Mama i tata razem mogą wziąć z puli mamy najwyżej ${maks} tygodni rodzicielskiego – resztę obcięliśmy.`);
  if (d.wariant === '815' && bezRodzicielskiego) uwagi.push('Bez urlopu rodzicielskiego w 1. roku życia dziecka ZUS wyrówna zasiłek za macierzyński do 100% (na wniosek) – policzyliśmy 100%.');
  if (okresy.some((o) => o.podwyzszono)) uwagi.push('Zasiłek nie może być niższy niż 1000 zł na rękę (świadczenie rodzicielskie) – ZUS go podwyższa.');
  if (tataW > 0 && !(d.podstawaTaty! > 0)) uwagi.push('Podaj wynagrodzenie taty, żeby policzyć jego część urlopu.');
  if (d.tata9 && !(d.podstawaTaty! > 0)) uwagi.push('9 tygodni taty liczymy dopiero po wpisaniu jego wynagrodzenia.');
  if (d.wariant === '815' && (d.tata9 && d.podstawaTaty)) uwagi.push('9 tygodni zarezerwowanych dla taty jest zawsze płatnych 70% – także przy wniosku o 81,5%.');

  const szosty = `${+d.porod.slice(0, 4) + 6}-12-31`;
  const terminy = [
    { nazwa: 'Wniosek o zasiłek 81,5% za cały urlop', data: dodajDni(d.porod, 21) },
    { nazwa: 'Urlop ojcowski – najpóźniej do', data: dodajDni(plusMiesiace(d.porod, 12), -1) },
    { nazwa: 'Urlop rodzicielski – najpóźniej do', data: szosty },
  ];
  return { okresy, razem, razemNetto, porownanie, terminy, uwagi };
}

export const opisTerminu = (t: { nazwa: string; data: string }) => `${t.nazwa}: ${pl(t.data)}`;
