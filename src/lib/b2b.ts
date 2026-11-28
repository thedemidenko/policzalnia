// B2B (jednoosobowa działalność) czy umowa o pracę – roczne porównanie kwot na rękę.
// B2B: składki i zdrowotna z ./skladki-zus (rok składkowy, progi ryczałtu, roczna dopłata), podatek:
// – ryczałt: stawka × (przychód − składki społeczne − 50% zdrowotnej), art. 11 ust. 1 ustawy o ryczałcie; FP nie odlicza się;
// – liniowy: 19% × (dochód − składki społeczne − zdrowotna do limitu), art. 30c PIT; FP i koszty w kosztach;
// – skala: 12/32% z kwotą zmniejszającą od dochodu po składkach społecznych (zdrowotnej nie odlicza się), art. 27 PIT.
// Etat: ./wynagrodzenie (zaliczki miesiąc po miesiącu, próg 32%, limit 30-krotności, koszt pracodawcy).
import stawki from '../data/stawki.json';
import { obliczZus, type Etap } from './skladki-zus';
import { obliczRok as obliczEtat, type DaneWynagrodzenia } from './wynagrodzenie';
import { pit, podatekSkala } from './ikze';
import { rokPracy } from './dni-robocze';
import { parametry, zasilek } from './maly-zus';

const r2 = (n: number) => Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;
const zl0 = (n: number) => Math.round(n);

export type FormaB2B = 'ryczalt' | 'liniowy' | 'skala';

export interface DaneB2B {
  rok: number;
  /** faktura miesięcznie, netto (bez VAT) */
  faktura: number;
  forma: FormaB2B;
  /** stawka ryczałtu w % */
  stawkaRyczaltu?: number;
  etap: Exclude<Etap, 'wlasna'>;
  /** podstawa Małego ZUS Plus */
  podstawaMzp?: number;
  chorobowe?: boolean;
  /** miesięczne koszty firmy netto (księgowość, sprzęt, oprogramowanie) */
  koszty?: number;
  /** dni robocze w roku bez faktury (urlop, choroba) */
  dniBezFaktury?: number;
  /** miesiąc wakacji składkowych (0–11) */
  wakacje?: number;
}

export interface WynikB2B {
  przychod: number;
  koszty: number;
  spoleczne: number;
  fp: number;
  zdrowotna: number;
  podatek: number;
  naReke: number;
  naRekeMies: number;
  /** składka emerytalna w roku (19,52% podstawy) – trafia na konto emerytalne */
  emerytalna: number;
  /** zasiłek chorobowy za pełny miesiąc L4 */
  zasilek: number;
}

/** Dni robocze w roku (do przeliczenia dni bez faktury). */
export const dniRobocze = (rok: number) => rokPracy(rok).dni;

export function obliczB2B(x: DaneB2B): WynikB2B {
  const dni = dniRobocze(x.rok);
  const bez = Math.min(dni, Math.max(0, x.dniBezFaktury ?? 0));
  const przychod = r2(Math.max(0, x.faktura) * 12 * (1 - bez / dni));
  const przychodMies = przychod / 12;
  const kosztyRok = r2(Math.max(0, x.koszty ?? 0) * 12);
  const chor = x.chorobowe !== false;
  const baza = { rok: x.rok, etap: x.etap as Etap, podstawa: x.podstawaMzp, chorobowe: chor, forma: x.forma as 'ryczalt' | 'liniowy' | 'skala', wakacje: x.wakacje };
  // FP jest kosztem (liniowy, skala) – najpierw ustalamy jego wysokość, potem dochód do składki zdrowotnej
  const fpMies = obliczZus({ ...baza, dochod: 0, przychod: 0 }).typowy.fp;
  const z = x.forma === 'ryczalt'
    ? obliczZus({ ...baza, przychod: przychodMies })
    : obliczZus({ ...baza, dochod: Math.max(0, przychodMies - (x.koszty ?? 0) - fpMies) });
  const spoleczne = z.rok.spoleczne, fp = z.rok.fp;
  // zdrowotna za rok – na ryczałcie z roczną dopłatą po przekroczeniu progu
  const zdrowotna = r2(z.rok.zdrowotna + z.doplataZdrowotnej);
  const p = pit(x.rok);
  let podatek = 0;
  if (x.forma === 'ryczalt') {
    const podstawa = zl0(Math.max(0, przychod - spoleczne - r2(zdrowotna * 0.5)));
    podatek = zl0(podstawa * (x.stawkaRyczaltu ?? 12) / 100);
  } else {
    const dochod = Math.max(0, przychod - kosztyRok - fp);
    if (x.forma === 'liniowy') {
      type Rok = { zdrowotna_liniowy_limit_odliczenia?: { wartosc: number | null } };
      const lata = stawki.lata as Record<string, Rok>;
      const limit = lata[String(x.rok)]?.zdrowotna_liniowy_limit_odliczenia?.wartosc ?? lata[String(x.rok - 1)]?.zdrowotna_liniowy_limit_odliczenia?.wartosc ?? 14100;
      podatek = zl0(zl0(Math.max(0, dochod - spoleczne - Math.min(zdrowotna, limit))) * p.liniowy);
    } else {
      podatek = zl0(podatekSkala(zl0(Math.max(0, dochod - spoleczne)), p));
    }
  }
  const naReke = r2(przychod - kosztyRok - spoleczne - fp - zdrowotna - podatek);
  const podstawaZus = z.typowy.podstawa;
  return {
    przychod, koszty: kosztyRok, spoleczne, fp, zdrowotna, podatek, naReke, naRekeMies: r2(naReke / 12),
    emerytalna: z.miesiace.reduce((a, q) => r2(a + q.emerytalna), 0),
    zasilek: chor && podstawaZus > 0 ? zasilek(podstawaZus) : 0,
  };
}

export interface WynikEtatu {
  brutto: number;
  naReke: number;
  naRekeMies: number;
  kosztPracodawcy: number;
  kosztMies: number;
  /** składki emerytalne pracownika i pracodawcy w roku */
  emerytalna: number;
  /** wynagrodzenie chorobowe za pełny miesiąc L4 (80%) */
  zasilek: number;
  /** wartość 26 dni płatnego urlopu (brutto) */
  urlop: number;
}

export function obliczUoP(x: Omit<DaneWynagrodzenia, 'pit2'> & { pit2?: number }, dniUrlopu = 26): WynikEtatu {
  const r = obliczEtat({ pit2: 300, ...x });
  const dni = dniRobocze(x.rok);
  return {
    brutto: x.brutto, naReke: r.suma.netto, naRekeMies: r2(r.suma.netto / 12), kosztPracodawcy: r.suma.kosztPracodawcy, kosztMies: r2(r.suma.kosztPracodawcy / 12),
    emerytalna: r.miesiace.reduce((a, q) => r2(a + q.emerytalna + q.skladkiPracodawcy.emerytalna), 0),
    zasilek: r2(x.brutto * (1 - 0.1371) * 0.8),
    urlop: r2((x.brutto * 12 / dni) * dniUrlopu),
  };
}

/** Najniższa faktura miesięczna, przy której B2B daje rocznie na rękę co najmniej tyle, ile etat. */
export function progOplacalnosci(netoEtatRok: number, x: Omit<DaneB2B, 'faktura'>): number {
  const f = (k: number) => obliczB2B({ ...x, faktura: k }).naReke;
  let lo = 0, hi = Math.max(1000, netoEtatRok);
  while (f(hi) < netoEtatRok && hi < 1e7) hi *= 1.5;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) >= netoEtatRok) hi = m; else lo = m; }
  return Math.ceil(hi);
}

export const placaMinimalnaB2B = (rok: number) => parametry(rok)?.placa ?? 4806;
