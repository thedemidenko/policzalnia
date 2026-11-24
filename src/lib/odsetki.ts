// Odsetki ustawowe (KC), w transakcjach handlowych i umowne.
// Od 1.01.2016: kapitałowe = ref + 3,5 pp (art. 359 § 2 KC), za opóźnienie = ref + 5,5 pp (art. 481 § 2 KC),
// maksymalne za opóźnienie = 2 × ustawowe za opóźnienie (art. 481 § 2¹ KC).
// Do 31.12.2015: jedna stawka odsetek ustawowych z rozporządzeń Rady Ministrów.
// Transakcje handlowe (art. 4 pkt 3 ustawy o przeciwdziałaniu nadmiernym opóźnieniom): ref z 1.01 / 1.07 danego półrocza
// + 8 pp (2016–2019) albo + 10 pp (od 2020; dłużnik będący podmiotem leczniczym: + 8 pp).
// Rok = 365 dni. Odsetki od dnia następującego po terminie płatności do dnia zapłaty włącznie.
// Wpłaty częściowe: najpierw na zaległe odsetki, potem na należność główną (art. 451 § 1 KC).
import stopy from '../data/stopy-nbp.json';
import { r2 } from './format';
import { terminRoboczy } from './kalendarz';

export type RodzajOdsetek = 'opoznienie' | 'kapitalowe' | 'handlowe' | 'umowne';

export const NAZWY: Record<RodzajOdsetek, string> = {
  opoznienie: 'ustawowe za opóźnienie',
  kapitalowe: 'ustawowe kapitałowe',
  handlowe: 'w transakcjach handlowych',
  umowne: 'umowne',
};

export const OD_KIEDY: Record<RodzajOdsetek, string> = {
  opoznienie: stopy.odsetki_ustawowe_do_2015[0].od,
  kapitalowe: stopy.odsetki_ustawowe_do_2015[0].od,
  handlowe: '2016-01-01',
  umowne: stopy.odsetki_ustawowe_do_2015[0].od,
};

const NOWE_PRZEPISY = '2016-01-01';
const DZIEN = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Data ISO (YYYY-MM-DD) → liczba dni od epoki (UTC). */
export const dzien = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DZIEN);
export const iso = (d: number) => new Date(d * DZIEN).toISOString().slice(0, 10);
const pl = (iso: string) => iso.split('-').reverse().join('.');

/** Stopa referencyjna NBP obowiązująca w danym dniu. */
export function stopaRef(data: string): number {
  let ref = NaN;
  for (const z of stopy.zmiany) if (z.od <= data) ref = z.ref;
  return ref;
}

/** Odsetki maksymalne za opóźnienie w danym dniu (od 2016 r.; wcześniej brak w kalkulatorze). */
export const stopaMaksymalna = (data: string) => (data < NOWE_PRZEPISY ? Infinity : r2(2 * (stopaRef(data) + 5.5)));

/** Roczna stopa odsetek ustawowych (w %) obowiązująca w danym dniu. */
export function stopaOdsetek(rodzaj: Exclude<RodzajOdsetek, 'umowne'>, data: string, leczniczy = false): number {
  if (data < NOWE_PRZEPISY) {
    if (rodzaj === 'handlowe') return NaN;
    let s = NaN;
    for (const z of stopy.odsetki_ustawowe_do_2015) if (z.od <= data) s = z.stopa;
    return s;
  }
  if (rodzaj === 'kapitalowe') return r2(stopaRef(data) + 3.5);
  if (rodzaj === 'opoznienie') return r2(stopaRef(data) + 5.5);
  const polrocze = `${data.slice(0, 4)}-${data.slice(5, 7) < '07' ? '01' : '07'}-01`;
  const marza = data < '2020-01-01' || leczniczy ? 8 : 10;
  return r2(stopaRef(polrocze) + marza);
}

/** Dni, od których może zmienić się stopa. */
function zmianyStopy(rodzaj: RodzajOdsetek): string[] {
  const d = new Set<string>([...stopy.odsetki_ustawowe_do_2015.map((z) => z.od), NOWE_PRZEPISY]);
  if (rodzaj === 'handlowe') for (let r = 2016; r <= 2100; r++) { d.add(`${r}-01-01`); d.add(`${r}-07-01`); }
  else for (const z of stopy.zmiany) if (z.od > NOWE_PRZEPISY) d.add(z.od);
  return [...d].sort();
}

export interface Wplata { data: string; kwota: number }
export interface Opcje {
  leczniczy?: boolean;
  /** stawka roczna w % dla rodzaju „umowne” */
  stawkaUmowna?: number;
  /** art. 115 KC – przesuń termin z soboty / dnia wolnego na najbliższy dzień roboczy */
  przesunTermin?: boolean;
  wplaty?: Wplata[];
}
export interface Okres { od: string; do: string; dni: number; kapital: number; stopa: number; odsetki: number; ograniczona?: boolean }
export interface RozliczonaWplata { data: string; kwota: number; naOdsetki: number; naKapital: number; nadplata: number }
export interface WynikOdsetek {
  terminEfektywny: string;
  dni: number;
  okresy: Okres[];
  wplaty: RozliczonaWplata[];
  /** odsetki naliczone łącznie */
  odsetki: number;
  /** pozostało do zapłaty na dzień zapłaty / obliczenia */
  odsetkiDoZaplaty: number;
  kapitalDoZaplaty: number;
  razem: number;
  ograniczonoDoMaksymalnych: boolean;
  blad?: string;
  uwagi: string[];
}

/**
 * @param kwota należność główna
 * @param termin termin płatności – odsetki od dnia następnego
 * @param zaplata dzień zapłaty lub obliczenia (włącznie)
 */
export function obliczOdsetki(kwota: number, termin: string, zaplata: string, rodzaj: RodzajOdsetek, opcje: Opcje = {}): WynikOdsetek {
  const { leczniczy = false, stawkaUmowna = 0, przesunTermin = false } = opcje;
  const uwagi: string[] = [];
  const pusty = (blad?: string, t = termin): WynikOdsetek => ({
    terminEfektywny: t, dni: 0, okresy: [], wplaty: [], odsetki: 0, odsetkiDoZaplaty: 0, kapitalDoZaplaty: r2(kwota), razem: r2(kwota), ograniczonoDoMaksymalnych: false, blad, uwagi,
  });
  if (!ISO.test(termin) || !ISO.test(zaplata)) return pusty('Podaj obie daty.');
  if (rodzaj === 'umowne' && !(stawkaUmowna > 0)) return pusty('Podaj stawkę odsetek umownych.');

  const t = przesunTermin ? terminRoboczy(termin) : termin;
  if (t !== termin) uwagi.push(`Termin ${pl(termin)} przypadał w dzień wolny – przesunięto go na ${pl(t)} (art. 115 KC).`);
  const start = dzien(t) + 1;
  const koniec = dzien(zaplata);
  if (koniec < start) return pusty('Data zapłaty musi być późniejsza niż termin płatności.', t);
  if (iso(start) < OD_KIEDY[rodzaj]) return pusty(`Kalkulator liczy te odsetki za okresy od ${pl(OD_KIEDY[rodzaj])}.`, t);
  if (rodzaj === 'umowne' && iso(start) < NOWE_PRZEPISY) uwagi.push('Dla okresów sprzed 2016 r. kalkulator nie sprawdza limitu odsetek maksymalnych.');

  const wplaty = (opcje.wplaty ?? []).filter((w) => ISO.test(w.data) && w.kwota > 0).sort((a, b) => a.data.localeCompare(b.data));
  if (wplaty.some((w) => dzien(w.data) > koniec)) uwagi.push('Wpłaty późniejsze niż data zapłaty pominięto.');

  let K = r2(kwota), Z = 0, naliczone = 0, ograniczono = false;
  const rozliczone: RozliczonaWplata[] = [];
  const zaksieguj = (w: Wplata) => {
    const naOdsetki = r2(Math.min(w.kwota, Z));
    const naKapital = r2(Math.min(w.kwota - naOdsetki, K));
    Z = r2(Z - naOdsetki); K = r2(K - naKapital);
    rozliczone.push({ data: w.data, kwota: w.kwota, naOdsetki, naKapital, nadplata: r2(w.kwota - naOdsetki - naKapital) });
  };
  for (const w of wplaty) if (dzien(w.data) < start) zaksieguj(w); // wpłaty w terminie zmniejszają należność

  const wTrakcie = wplaty.filter((w) => dzien(w.data) >= start && dzien(w.data) <= koniec);
  const granice = new Set<number>([start, koniec + 1]);
  for (const g of zmianyStopy(rodzaj).map(dzien)) if (g > start && g <= koniec) granice.add(g);
  for (const w of wTrakcie) if (dzien(w.data) < koniec) granice.add(dzien(w.data) + 1);
  const punkty = [...granice].sort((a, b) => a - b);

  const okresy: Okres[] = [];
  for (let i = 0; i < punkty.length - 1; i++) {
    const a = punkty[i], b = punkty[i + 1] - 1, dni = b - a + 1, dataA = iso(a);
    let stopa: number, ograniczona = false;
    if (rodzaj === 'umowne') {
      const max = stopaMaksymalna(dataA);
      stopa = Math.min(stawkaUmowna, max);
      ograniczona = stawkaUmowna > max;
    } else stopa = stopaOdsetek(rodzaj, dataA, leczniczy);
    if (K > 0) {
      const odsetki = r2((K * stopa * dni) / 36500);
      const p = okresy[okresy.length - 1];
      if (p && p.stopa === stopa && p.kapital === K && dzien(p.do) === a - 1) {
        p.do = iso(b); p.dni += dni; Z = r2(Z - p.odsetki); naliczone = r2(naliczone - p.odsetki);
        p.odsetki = r2((K * stopa * p.dni) / 36500); Z = r2(Z + p.odsetki); naliczone = r2(naliczone + p.odsetki);
      } else {
        okresy.push({ od: dataA, do: iso(b), dni, kapital: K, stopa, odsetki, ...(ograniczona ? { ograniczona } : {}) });
        Z = r2(Z + odsetki); naliczone = r2(naliczone + odsetki);
      }
      if (ograniczona) ograniczono = true;
    }
    for (const w of wTrakcie) if (dzien(w.data) === b) zaksieguj(w);
  }
  if (ograniczono) uwagi.push('Stawka umowna przekraczała odsetki maksymalne – w tych okresach kalkulator przyjął stawkę maksymalną (art. 481 § 2² KC).');

  return {
    terminEfektywny: t, dni: koniec - start + 1, okresy, wplaty: rozliczone, odsetki: naliczone,
    odsetkiDoZaplaty: Z, kapitalDoZaplaty: K, razem: r2(K + Z), ograniczonoDoMaksymalnych: ograniczono, uwagi,
  };
}

/** Rekompensata za koszty odzyskiwania należności (art. 10 ust. 1 ustawy o transakcjach handlowych), w euro. */
export const rekompensataEur = (kwota: number) => (kwota <= 5000 ? 40 : kwota < 50000 ? 70 : 100);

/** Okres, z którego bierze się kurs EUR: ostatni dzień roboczy miesiąca poprzedzającego miesiąc wymagalności. */
export function miesiacKursu(termin: string): { od: string; do: string } {
  const r = +termin.slice(0, 4), m = +termin.slice(5, 7);
  const pr = m === 1 ? r - 1 : r, pm = m === 1 ? 12 : m - 1;
  const ostatni = new Date(Date.UTC(pr, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, '0');
  return { od: `${pr}-${mm}-01`, do: `${pr}-${mm}-${ostatni}` };
}
