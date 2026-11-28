// Prognoza emerytury z ZUS (osoby urodzone po 1948 r.) w dzisiejszych złotych.
// Ustawa o emeryturach i rentach z FUS (tekst jednolity Dz.U. 2026 poz. 1533): art. 24 (wiek 60/65), art. 25 (podstawa =
// zwaloryzowane składki na koncie + kapitał początkowy + subkonto), art. 26 (emerytura = podstawa / średnie dalsze trwanie
// życia z tablicy GUS, wspólnej dla kobiet i mężczyzn, w miesiącach), art. 87 (najniższa emerytura przy 20/25 latach stażu).
// Składka emerytalna 19,52% podstawy (bez OFE: 12,22% konto, 7,3% subkonto – art. 22 ust. 3 ustawy o sus), do limitu
// 30-krotności przeciętnego wynagrodzenia. Projekcja realna: wynagrodzenia i waloryzacja rosną o realny wskaźnik (konto
// waloryzuje się o inflację i realny wzrost sumy składek, subkonto – o średni nominalny wzrost PKB, więc w długim okresie
// realnie podobnie jak płace). Tablice trwania życia wydłużają się – domyślnie o 1 miesiąc rocznie.
import dane from '../data/emerytura.json';
import stawki from '../data/stawki.json';
import { obliczMiesiac } from './wynagrodzenie';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const TABLICA = dane.tablica.wiek as Record<string, number>;
export const MINIMALNA = dane.minimalna.kwota;
const SKLADKA = dane.skladka.razem / 100;
const PRZECIETNE = (stawki.lata as Record<string, { prognozowane_przecietne: { wartosc: number } }>)['2026'].prognozowane_przecietne.wartosc;

/** Średnie dalsze trwanie życia (miesiące) dla wieku w latach – z tablicy GUS, z interpolacją dla miesięcy. */
export function dalszeTrwanie(wiekLat: number): number {
  const w = Math.min(75, Math.max(55, wiekLat));
  const a = Math.floor(w), b = Math.min(75, a + 1);
  return r2(TABLICA[a] + (TABLICA[b] - TABLICA[a]) * (w - a));
}

export interface DaneEmerytury {
  wiek: number;
  /** wiek przejścia na emeryturę */
  wiekEmerytalny: number;
  kobieta: boolean;
  /** podstawa składek miesięcznie (pensja brutto albo podstawa w JDG), dziś */
  podstawa: number;
  /** zgromadzony kapitał (konto + kapitał początkowy + subkonto po waloryzacji); gdy brak – szacunek ze stażu */
  kapital?: number;
  /** lata pracy do dziś (do stażu i szacunku kapitału) */
  staz: number;
  /** realny wzrost wynagrodzeń i waloryzacji, % rocznie */
  wzrost: number;
  /** wydłużanie się tablic trwania życia, miesięcy na rok */
  wydluzanie?: number;
}

export interface WynikEmerytury {
  brutto: number;
  netto: number;
  /** emerytura przed podwyższeniem do minimalnej */
  wyliczona: number;
  kapitalEmerytalny: number;
  kapitalDzis: number;
  szacowanyKapital: boolean;
  dzielnik: number;
  ostatniaPensja: number;
  stopaZastapienia: number;
  stazNaEmeryturze: number;
  minimalnaGwarantowana: boolean;
  /** brakująca kwota do 60% ostatniej pensji (brutto) i miesięczna oszczędność, która ją pokryje */
  luka: number;
  oszczednosc: number;
}

/** Netto emerytury: zdrowotna 9%, zaliczka 12% minus 300 zł kwoty zmniejszającej (bez kosztów uzyskania). */
export function nettoEmerytury(brutto: number): number {
  const zdrowotna = r2(brutto * 0.09);
  const zaliczka = Math.max(0, Math.round(Math.round(brutto) * 0.12 - 300));
  return r2(brutto - zdrowotna - zaliczka);
}

export function obliczEmeryture(x: DaneEmerytury): WynikEmerytury {
  const lat = Math.max(0, Math.round(x.wiekEmerytalny - x.wiek));
  const g = x.wzrost / 100;
  const szacowany = x.kapital === undefined || x.kapital <= 0;
  // szacunek kapitału ze stażu: dzisiejsza podstawa przez wszystkie dotychczasowe lata (w dzisiejszych złotych)
  const kapitalDzis = szacowany ? r2(Math.min(x.podstawa, PRZECIETNE * 30 / 12) * 12 * SKLADKA * Math.max(0, x.staz)) : x.kapital!;
  let kapital = kapitalDzis;
  let pensja = x.podstawa;
  for (let i = 0; i < lat; i++) {
    const limit = PRZECIETNE * 30 * Math.pow(1 + g, i);
    const skladki = Math.min(pensja * 12, limit) * SKLADKA;
    kapital = kapital * (1 + g) + skladki;
    if (i < lat - 1) pensja *= 1 + g;
  }
  const dzielnik = r2(dalszeTrwanie(x.wiekEmerytalny) + (x.wydluzanie ?? 1) * lat);
  const wyliczona = r2(kapital / dzielnik);
  const stazNaEmeryturze = x.staz + lat;
  const minimalnaGwarantowana = stazNaEmeryturze >= (x.kobieta ? 20 : 25) && x.wiekEmerytalny >= (x.kobieta ? 60 : 65);
  const brutto = minimalnaGwarantowana ? Math.max(wyliczona, MINIMALNA) : wyliczona;
  const ostatniaPensja = r2(pensja);
  const stopaZastapienia = ostatniaPensja > 0 ? Math.round((brutto / ostatniaPensja) * 1000) / 10 : 0;
  // luka do 60% ostatniej pensji: kapitał na wypłaty przez okres z tablicy, odkładany z realnym zyskiem 2% rocznie
  const luka = Math.max(0, r2(0.6 * ostatniaPensja - brutto));
  const potrzebne = luka * dzielnik;
  const rm = 0.02 / 12, n = lat * 12;
  const oszczednosc = n > 0 ? r2(potrzebne * rm / (Math.pow(1 + rm, n) - 1)) : 0;
  return {
    brutto: r2(brutto), netto: nettoEmerytury(brutto), wyliczona, kapitalEmerytalny: r2(kapital), kapitalDzis: r2(kapitalDzis), szacowanyKapital: szacowany,
    dzielnik, ostatniaPensja, stopaZastapienia, stazNaEmeryturze, minimalnaGwarantowana, luka, oszczednosc,
  };
}

/** Netto pensji do porównania (umowa o pracę). */
export const nettoPensji = (brutto: number) => obliczMiesiac({ rok: 2026, brutto, pit2: 300 }).netto;
