// Dieta i należności z tytułu zagranicznej podróży służbowej (rozporządzenie MPiPS z 29.01.2013, tekst jedn. Dz.U. 2023 poz. 2190,
// stawki z Dz.U. 2022 poz. 2302 od 29.11.2022). Czas za granicą: od przekroczenia granicy / startu samolotu z ostatniego lotniska
// w kraju do powrotu (§ 12). Dieta (§ 13): za każdą dobę 100%, niepełna doba: do 8 h – 1/3, ponad 8 do 12 h – 50%, ponad 12 h – 100%;
// przy kilku państwach docelowych – osobno za czas w każdym z nich. Posiłki (§ 14): śniadanie 15%, obiad 30%, kolacja 30% diety.
// Nocleg (§ 16): rachunek do limitu, bez rachunku ryczałt 25% limitu (nie za czas przejazdu). Ryczałty (§ 17): dojazd z/do dworca
// lub lotniska – 1 dieta w miejscowości docelowej i każdej innej z noclegiem (50% w jedną stronę), komunikacja miejscowa – 10% diety
// za każdą rozpoczętą dobę; nie przysługują przy podróży samochodem. Odcinki w kraju – jak podróż krajowa (§ 21); według MRPiPS
// i GIP odcinek przed granicą i po powrocie to dwie odrębne podróże krajowe (bez sumowania).
import dane from '../data/diety-zagraniczne.json';
import { stawkaDiety } from './delegacja';

export interface Kraj { id: string; nazwa: string; waluta: string; dieta: number; limit: number }
export const KRAJE: Kraj[] = dane.kraje;
export const OD_KIEDY = dane.od;
export const kraj = (id: string) => KRAJE.find((k) => k.id === id);
export const PROJEKT = dane.projekt as { wersja: string; zmiany: Record<string, { dieta?: number; limit?: number; waluta?: string }> };

export type Nocleg = 'rachunek' | 'ryczalt' | 'zapewniony';
export interface Etap { kraj: string; od?: string; sniadania?: number; obiady?: number; kolacje?: number; nocleg?: Nocleg; noce?: number; rachunek?: number }
export interface DaneZagr {
  /** wyjazd z miejscowości w Polsce (opcjonalnie – część krajowa) */
  wyjazd?: string;
  /** przekroczenie granicy / start samolotu z ostatniego lotniska w kraju */
  granica: string;
  etapy: Etap[];
  /** powrót: przekroczenie granicy / lądowanie na pierwszym lotnisku w kraju */
  powrotGranica: string;
  /** powrót do miejscowości w Polsce (opcjonalnie) */
  powrot?: string;
  samochod?: boolean;
  dojazdy?: 'oba' | 'jedna' | 'brak';
  komunikacja?: boolean;
  krajoweLacznie?: boolean;
  kursy?: Record<string, number>;
  /** inne koszty w złotych: bilety, wiza, ubezpieczenie, opłaty */
  koszty?: number;
  zaliczka?: { kwota: number; waluta: string };
}
export interface Pozycja { nazwa: string; opis: string; kwota: number }
export interface EtapWynik {
  kraj: Kraj;
  od: string;
  do: string;
  godziny: number;
  pelneDoby: number;
  resztaGodzin: number;
  /** ułamek diety za niepełną dobę: 0, 1/3, 1/2, 1 */
  ulamek: number;
  diety: number;
  pozycje: Pozycja[];
  razem: number;
  noceDomyslne: number;
}
export interface Krajowa { godziny: [number, number]; diety: number; stawka: number; kwota: number; opis: string }
export interface WynikZagr {
  etapy: EtapWynik[];
  waluty: Record<string, number>;
  krajowa: Krajowa | null;
  koszty: number;
  /** suma w złotych (null – brak kursu którejś waluty) */
  pln: number | null;
  zaliczkaPln: number | null;
  doWyplatyPln: number | null;
  /** do wypłaty w walucie, gdy cała część zagraniczna i zaliczka są w jednej walucie */
  doWyplatyWal: { kwota: number; waluta: string } | null;
  uwagi: string[];
  blad?: string;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const CZAS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ms = (t: string) => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13), +t.slice(14, 16));
const H = 3_600_000;
const pl = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}${t.length > 10 ? ` ${t.slice(11, 16)}` : ''}`;
const fmt = (n: number, w: string) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${w === 'PLN' ? 'zł' : w}`;
const godz = (h: number) => {
  const g = Math.floor(h + 1e-9), m = Math.round((h - g) * 60);
  return m ? `${g} h ${m} min` : `${g} h`;
};

/** Liczba diet za czas za granicą (§ 13 ust. 3). */
export function dietyZagraniczne(godziny: number): { pelne: number; reszta: number; ulamek: number; diety: number } {
  const pelne = Math.floor(godziny / 24 + 1e-9);
  const reszta = Math.max(0, r2(godziny - pelne * 24));
  const ulamek = reszta <= 1e-9 ? 0 : reszta <= 8 ? 1 / 3 : reszta <= 12 ? 0.5 : 1;
  return { pelne, reszta, ulamek, diety: pelne + ulamek };
}
/** Liczba diet krajowych (§ 7 ust. 3): do doby – < 8 h 0, 8–12 h 50%, > 12 h 100%; dłużej – reszta ≤ 8 h 50%, > 8 h 100%. */
export function dietyKrajowe(godziny: number): number {
  if (godziny <= 0) return 0;
  if (godziny <= 24) return godziny < 8 ? 0 : godziny <= 12 ? 0.5 : 1;
  const pelne = Math.floor(godziny / 24 + 1e-9), reszta = godziny - pelne * 24;
  return pelne + (reszta <= 1e-9 ? 0 : reszta <= 8 ? 0.5 : 1);
}
/** Noce w etapie – liczba północy między początkiem a końcem. */
const noceW = (od: string, doT: string) => Math.max(0, Math.round((Date.UTC(+doT.slice(0, 4), +doT.slice(5, 7) - 1, +doT.slice(8, 10)) - Date.UTC(+od.slice(0, 4), +od.slice(5, 7) - 1, +od.slice(8, 10))) / 864e5));
const ulamekOpis = (u: number) => (u === 1 / 3 ? '1/3' : u === 0.5 ? '50%' : '100%');

export function obliczDieteZagraniczna(x: DaneZagr): WynikZagr {
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikZagr => ({ etapy: [], waluty: {}, krajowa: null, koszty: 0, pln: null, zaliczkaPln: null, doWyplatyPln: null, doWyplatyWal: null, uwagi, blad });
  if (!CZAS.test(x.granica) || !CZAS.test(x.powrotGranica)) return pusty('Podaj datę i godzinę przekroczenia granicy (startu samolotu) oraz powrotu.');
  if (!x.etapy.length || !x.etapy.every((e) => kraj(e.kraj))) return pusty('Wybierz państwo docelowe.');
  if (x.granica.slice(0, 10) < OD_KIEDY) return pusty(`Kalkulator zna stawki obowiązujące od ${pl(OD_KIEDY)}.`);
  const granice = [x.granica, ...x.etapy.slice(1).map((e) => e.od ?? ''), x.powrotGranica];
  if (granice.some((g) => !CZAS.test(g))) return pusty('Podaj datę i godzinę wjazdu do każdego kolejnego państwa.');
  for (let i = 1; i < granice.length; i++) if (ms(granice[i]) <= ms(granice[i - 1])) return pusty(i === granice.length - 1 ? 'Powrót musi być później niż wyjazd za granicę.' : 'Etapy podróży muszą następować po sobie.');
  if (x.wyjazd && CZAS.test(x.wyjazd) && ms(x.wyjazd) > ms(x.granica)) return pusty('Wyjazd z miejscowości nie może być później niż przekroczenie granicy.');
  if (x.powrot && CZAS.test(x.powrot) && ms(x.powrot) < ms(x.powrotGranica)) return pusty('Powrót do miejscowości nie może być wcześniej niż powrót do kraju.');

  const samochod = !!x.samochod;
  const dojazdy = samochod ? 'brak' : x.dojazdy ?? 'oba';
  const komunikacja = !samochod && x.komunikacja !== false;
  const etapy: EtapWynik[] = x.etapy.map((e, i) => {
    const k = kraj(e.kraj)!, od = granice[i], doT = granice[i + 1];
    const godziny = (ms(doT) - ms(od)) / H;
    const d = dietyZagraniczne(godziny);
    const pozycje: Pozycja[] = [];
    const dieta = r2(d.diety * k.dieta);
    const opis = `${d.pelne ? `${d.pelne} ${d.pelne === 1 ? 'doba' : d.pelne < 5 ? 'doby' : 'dób'}` : ''}${d.pelne && d.ulamek ? ' + ' : ''}${d.ulamek ? `${godz(d.reszta)} (${ulamekOpis(d.ulamek)})` : ''} × ${fmt(k.dieta, k.waluta)}`;
    pozycje.push({ nazwa: 'Dieta', opis, kwota: dieta });
    const s = Math.max(0, e.sniadania ?? 0), o = Math.max(0, e.obiady ?? 0), kol = Math.max(0, e.kolacje ?? 0);
    const potr = r2((0.15 * s + 0.3 * o + 0.3 * kol) * k.dieta);
    if (potr > 0) {
      pozycje.push({ nazwa: 'Zapewnione posiłki', opis: [s && `${s} × śniadanie 15%`, o && `${o} × obiad 30%`, kol && `${kol} × kolacja 30%`].filter(Boolean).join(', '), kwota: -Math.min(potr, dieta) });
      if (potr > dieta) uwagi.push(`${k.nazwa}: zapewnione posiłki są warte więcej niż należna dieta – dieta wynosi 0.`);
    }
    const noceDomyslne = noceW(od, doT);
    const noce = e.noce !== undefined && e.noce >= 0 ? Math.floor(e.noce) : noceDomyslne;
    const nocleg = e.nocleg ?? 'rachunek';
    if (noce > 0 && nocleg === 'ryczalt') {
      pozycje.push({ nazwa: 'Ryczałt za nocleg', opis: `${noce} × 25% limitu (${fmt(r2(0.25 * k.limit), k.waluta)})`, kwota: r2(noce * 0.25 * k.limit) });
    } else if (noce > 0 && nocleg === 'rachunek' && (e.rachunek ?? 0) > 0) {
      const lim = noce * k.limit, kw = r2(e.rachunek!);
      pozycje.push({ nazwa: 'Hotel (rachunek)', opis: `limit ${fmt(k.limit, k.waluta)} za noc × ${noce}`, kwota: Math.min(kw, lim) });
      if (kw > lim) uwagi.push(`${k.nazwa}: rachunek za hotel przekracza limit o ${fmt(r2(kw - lim), k.waluta)}. Nadwyżkę pracodawca zwraca tylko, jeśli się na to zgodzi (§ 16 ust. 3).`);
    }
    if (dojazdy !== 'brak' && (i === 0 || noce > 0)) { // miejscowość docelowa i każda inna z noclegiem
      const ile = dojazdy === 'oba' ? 1 : 0.5;
      pozycje.push({ nazwa: 'Ryczałt na dojazd z i do dworca / lotniska', opis: `${ile === 1 ? '1 dieta' : '50% diety – w jedną stronę'}`, kwota: r2(ile * k.dieta) });
    }
    if (komunikacja) {
      const doby = Math.ceil(godziny / 24 - 1e-9);
      pozycje.push({ nazwa: 'Ryczałt na komunikację miejscową', opis: `${doby} × 10% diety (${fmt(r2(0.1 * k.dieta), k.waluta)})`, kwota: r2(doby * 0.1 * k.dieta) });
    }
    const zm = PROJEKT.zmiany[k.id];
    if (zm) uwagi.push(`${k.nazwa}: ${PROJEKT.wersja} przewiduje ${[zm.dieta && `dietę ${zm.dieta} ${zm.waluta ?? k.waluta}`, zm.limit && `limit noclegu ${zm.limit} ${zm.waluta ?? k.waluta}`].filter(Boolean).join(' i ')}. Liczymy według stawek obowiązujących, dopóki zmiana nie zostanie ogłoszona.`);
    return { kraj: k, od, do: doT, godziny: r2(godziny), pelneDoby: d.pelne, resztaGodzin: d.reszta, ulamek: d.ulamek, diety: d.diety, pozycje, razem: r2(pozycje.reduce((a, p) => a + p.kwota, 0)), noceDomyslne };
  });

  const waluty: Record<string, number> = {};
  for (const e of etapy) waluty[e.kraj.waluta] = r2((waluty[e.kraj.waluta] ?? 0) + e.razem);

  // część krajowa
  let krajowa: Krajowa | null = null;
  const h1 = x.wyjazd && CZAS.test(x.wyjazd) ? (ms(x.granica) - ms(x.wyjazd)) / H : 0;
  const h2 = x.powrot && CZAS.test(x.powrot) ? (ms(x.powrot) - ms(x.powrotGranica)) / H : 0;
  if (h1 > 0 || h2 > 0) {
    const stawka = stawkaDiety((x.wyjazd && CZAS.test(x.wyjazd) ? x.wyjazd : x.granica).slice(0, 10));
    const diety = x.krajoweLacznie ? dietyKrajowe(h1 + h2) : dietyKrajowe(h1) + dietyKrajowe(h2);
    const opis = x.krajoweLacznie ? `łącznie ${godz(r2(h1 + h2))}` : `${godz(r2(h1))} przed granicą, ${godz(r2(h2))} po powrocie – osobno`;
    krajowa = { godziny: [r2(h1), r2(h2)], diety, stawka, kwota: r2(diety * stawka), opis };
    if (!x.krajoweLacznie && diety === 0 && dietyKrajowe(h1 + h2) > 0) uwagi.push(`Odcinki krajowe liczone osobno są krótsze niż 8 godzin, więc dieta krajowa nie przysługuje. Po zsumowaniu (${godz(r2(h1 + h2))}) wyniosłaby ${fmt(r2(dietyKrajowe(h1 + h2) * stawka), 'PLN')} – część pracodawców spoza budżetówki tak liczy.`);
  }
  const koszty = r2(Math.max(0, x.koszty ?? 0));

  // przeliczenie na złote
  const kursy = x.kursy ?? {};
  const brakKursu = Object.keys(waluty).filter((w) => !(kursy[w] > 0));
  const pln = brakKursu.length ? null : r2(Object.entries(waluty).reduce((a, [w, v]) => a + v * kursy[w], 0) + (krajowa?.kwota ?? 0) + koszty);
  let zaliczkaPln: number | null = 0;
  const z = x.zaliczka && x.zaliczka.kwota > 0 ? x.zaliczka : null;
  if (z) zaliczkaPln = z.waluta === 'PLN' ? z.kwota : kursy[z.waluta] > 0 ? r2(z.kwota * kursy[z.waluta]) : null;
  const doWyplatyPln = pln !== null && zaliczkaPln !== null ? r2(pln - zaliczkaPln) : null;
  const jednaWaluta = Object.keys(waluty).length === 1 ? Object.keys(waluty)[0] : null;
  const doWyplatyWal = jednaWaluta && (!z || z.waluta === jednaWaluta) && !krajowa?.kwota && !koszty ? { kwota: r2(waluty[jednaWaluta] - (z?.kwota ?? 0)), waluta: jednaWaluta } : null;

  if (samochod) uwagi.push('Przy podróży samochodem ryczałty na dojazdy i komunikację miejscową nie przysługują (§ 17 ust. 4). Koszty przejazdu rozlicza się osobno.');
  if (etapy.some((e) => e.godziny < 8)) uwagi.push('Za pobyt za granicą do 8 godzin przysługuje 1/3 diety – w podróży zagranicznej nie ma minimalnego czasu.');
  return { etapy, waluty, krajowa, koszty, pln, zaliczkaPln, doWyplatyPln, doWyplatyWal, uwagi };
}
