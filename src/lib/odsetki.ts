// Odsetki ustawowe (KC) i w transakcjach handlowych.
// Od 1.01.2016: kapitałowe = ref + 3,5 pp (art. 359 § 2 KC), za opóźnienie = ref + 5,5 pp (art. 481 § 2 KC).
// Do 31.12.2015: jedna stawka odsetek ustawowych z rozporządzenia Rady Ministrów.
// Transakcje handlowe (art. 4 pkt 3 ustawy o przeciwdziałaniu nadmiernym opóźnieniom): ref z 1.01 / 1.07 danego półrocza
// + 8 pp (2016–2019) albo + 10 pp (od 2020; dłużnik będący podmiotem leczniczym: + 8 pp).
// Rok = 365 dni. Odsetki liczone od dnia następującego po terminie płatności do dnia zapłaty włącznie.
import stopy from '../data/stopy-nbp.json';
import { r2 } from './format';

export type RodzajOdsetek = 'opoznienie' | 'kapitalowe' | 'handlowe';

export const NAZWY: Record<RodzajOdsetek, string> = {
  opoznienie: 'ustawowe za opóźnienie',
  kapitalowe: 'ustawowe (kapitałowe)',
  handlowe: 'w transakcjach handlowych',
};

export const OD_KIEDY: Record<RodzajOdsetek, string> = {
  opoznienie: '2005-10-15',
  kapitalowe: '2005-10-15',
  handlowe: '2016-01-01',
};

const NOWE_PRZEPISY = '2016-01-01';
const DZIEN = 86_400_000;

/** Data ISO (YYYY-MM-DD) → liczba dni od epoki (UTC, bez stref czasowych). */
export const dzien = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DZIEN);
export const iso = (d: number) => new Date(d * DZIEN).toISOString().slice(0, 10);

/** Stopa referencyjna obowiązująca w danym dniu (ISO). */
export function stopaRef(data: string): number {
  let ref = NaN;
  for (const z of stopy.zmiany) if (z.od <= data) ref = z.ref;
  return ref;
}

/** Roczna stopa odsetek (w %) obowiązująca w danym dniu. */
export function stopaOdsetek(rodzaj: RodzajOdsetek, data: string, leczniczy = false): number {
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

/** Dni (ISO), od których zmienia się stopa danego rodzaju odsetek. */
function zmianyStopy(rodzaj: RodzajOdsetek): string[] {
  const d = new Set<string>([...stopy.odsetki_ustawowe_do_2015.map((z) => z.od), NOWE_PRZEPISY]);
  if (rodzaj === 'handlowe') {
    for (let r = 2016; r <= 2100; r++) { d.add(`${r}-01-01`); d.add(`${r}-07-01`); }
  } else {
    for (const z of stopy.zmiany) if (z.od > NOWE_PRZEPISY) d.add(z.od);
  }
  return [...d].sort();
}

export interface Okres { od: string; do: string; dni: number; stopa: number; odsetki: number }
export interface WynikOdsetek { dni: number; okresy: Okres[]; odsetki: number; razem: number; blad?: string }

/**
 * @param kwota należność główna
 * @param termin termin płatności (ostatni dzień na zapłatę) – odsetki od dnia następnego
 * @param zaplata dzień zapłaty (włącznie)
 */
export function obliczOdsetki(kwota: number, termin: string, zaplata: string, rodzaj: RodzajOdsetek, leczniczy = false): WynikOdsetek {
  const pusty = (blad?: string): WynikOdsetek => ({ dni: 0, okresy: [], odsetki: 0, razem: r2(kwota), blad });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(termin) || !/^\d{4}-\d{2}-\d{2}$/.test(zaplata)) return pusty('Podaj obie daty.');
  const start = dzien(termin) + 1; // pierwszy dzień opóźnienia
  const koniec = dzien(zaplata);
  if (koniec < start) return pusty('Data zapłaty musi być późniejsza niż termin płatności.');
  if (iso(start) < OD_KIEDY[rodzaj]) return pusty(`Kalkulator liczy te odsetki za okresy od ${OD_KIEDY[rodzaj].split('-').reverse().join('.')}.`);

  const granice = zmianyStopy(rodzaj).map(dzien).filter((g) => g > start && g <= koniec);
  const punkty = [start, ...granice, koniec + 1];
  const okresy: Okres[] = [];
  for (let i = 0; i < punkty.length - 1; i++) {
    const a = punkty[i], b = punkty[i + 1] - 1;
    const dni = b - a + 1;
    const stopa = stopaOdsetek(rodzaj, iso(a), leczniczy);
    okresy.push({ od: iso(a), do: iso(b), dni, stopa, odsetki: r2((kwota * stopa * dni) / 36500) });
  }
  // scal sąsiednie okresy z tą samą stopą (np. 1.07 bez zmiany ref w transakcjach handlowych)
  const scalone: Okres[] = [];
  for (const o of okresy) {
    const p = scalone[scalone.length - 1];
    if (p && p.stopa === o.stopa) { p.do = o.do; p.dni += o.dni; p.odsetki = r2((kwota * p.stopa * p.dni) / 36500); }
    else scalone.push({ ...o });
  }
  const odsetki = r2(scalone.reduce((s, o) => s + o.odsetki, 0));
  return { dni: koniec - start + 1, okresy: scalone, odsetki, razem: r2(kwota + odsetki) };
}
