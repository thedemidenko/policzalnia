// Ryczałt od przychodów ewidencjonowanych (ustawa o zryczałtowanym podatku dochodowym): podatek = stawka × (przychód −
// składki społeczne − 50% zapłaconej składki zdrowotnej), przy kilku stawkach odliczenia proporcjonalnie do przychodów
// (art. 11 ust. 1, 1a, 3); najem, noclegi i in.: 8,5% do 100 000 zł, 12,5% od nadwyżki (art. 12 ust. 1 pkt 4).
// Podstawę i podatek zaokrągla się do pełnych złotych. Składka zdrowotna na ryczałcie: 9% od 60% / 100% / 180% przeciętnego
// wynagrodzenia z IV kw. poprzedniego roku – zależnie od rocznego przychodu (do 60 tys., do 300 tys., powyżej).
// Porównanie: podatek liniowy (19%, zdrowotna 4,9% dochodu, odliczenie zdrowotnej do limitu) i skala (12/32%, zdrowotna 9%).
import stawki from '../data/stawki.json';
import dane from '../data/ryczalt-stawki.json';
import { pit, podatekSkala } from './ikze';
import { parametry, skladki } from './maly-zus';

export interface StawkaR { id: string; stawka: number; stawkaPowyzej?: number; prog?: number; nazwa: string }
export const STAWKI: StawkaR[] = dane.stawki;
export const DZIALALNOSCI = dane.dzialalnosci as { n: string; s: string; k: string }[];
export const stawka = (id: string) => STAWKI.find((s) => s.id === id);

export type Zus = 'pelny' | 'pelnyBez' | 'pref' | 'prefBez' | 'start' | 'wlasny';
export const ZUS: Record<Zus, string> = {
  pelny: 'pełny ZUS z chorobowym',
  pelnyBez: 'pełny ZUS bez chorobowego',
  pref: 'preferencyjny z chorobowym',
  prefBez: 'preferencyjny bez chorobowego',
  start: 'ulga na start (tylko zdrowotna)',
  wlasny: 'własna kwota (np. Mały ZUS Plus)',
};

const r2 = (n: number) => Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;
const zl0 = (n: number) => Math.round(n);

type Rok = { placa_minimalna: { wartosc: number }; zdrowotna_ryczalt_podstawa?: { wartosc: number | null }; zdrowotna_liniowy_limit_odliczenia?: { wartosc: number | null } };
const rokDane = (rok: number) => (stawki.lata as Record<string, Rok>)[String(rok)];

/** Miesięczne składki społeczne i FP dla wariantu ZUS. */
export function zusMiesiecznie(rok: number, z: Zus, wlasna = 0): { spoleczne: number; fp: number } {
  const p = parametry(rok);
  if (!p) return { spoleczne: 0, fp: 0 };
  if (z === 'start') return { spoleczne: 0, fp: 0 };
  if (z === 'wlasny') return { spoleczne: r2(Math.max(0, wlasna)), fp: 0 };
  const podst = z === 'pelny' || z === 'pelnyBez' ? p.max : p.min;
  const s = skladki(podst, { chorobowe: z === 'pelny' || z === 'pref' }, p.placa);
  return { spoleczne: s.spoleczne, fp: s.fp };
}

/** Roczna składka zdrowotna na ryczałcie (12 miesięcy według progu rocznego przychodu). */
export function zdrowotnaRyczalt(rok: number, przychodRoczny: number): { mies: number; rok: number; prog: string; niepewne: boolean } {
  const d = rokDane(rok);
  let podstawa = d?.zdrowotna_ryczalt_podstawa?.wartosc ?? null;
  let niepewne = false;
  if (!podstawa) { podstawa = rokDane(rok - 1)?.zdrowotna_ryczalt_podstawa?.wartosc ?? 9228.64; niepewne = true; }
  const [m, prog] = przychodRoczny <= 60000 ? [0.6, 'do 60 000 zł'] : przychodRoczny <= 300000 ? [1, '60 000–300 000 zł'] : [1.8, 'ponad 300 000 zł'];
  const mies = r2(0.09 * r2(m * podstawa));
  return { mies, rok: r2(mies * 12), prog: prog as string, niepewne };
}

export interface PrzychodR { stawka: string; kwota: number }
export interface DaneR {
  rok: number;
  /** przychody roczne według stawek */
  przychody: PrzychodR[];
  zus: Zus;
  /** własna miesięczna kwota składek społecznych (wariant „wlasny”) */
  zusWlasny?: number;
  /** liczba miesięcy z ZUS w roku (domyślnie 12) */
  miesiace?: number;
  /** roczne koszty – do porównania z liniowym i skalą */
  koszty?: number;
}
export interface PozycjaR { stawka: StawkaR; przychod: number; odliczenia: number; podstawa: number; podatek: number }
export interface Forma { nazwa: string; podatek: number; zdrowotna: number; spoleczne: number; fp: number; koszty: number; naReke: number; obciazenie: number }
export interface WynikR {
  przychod: number;
  spoleczne: number;
  fp: number;
  zdrowotna: number;
  zdrowotnaMies: number;
  zdrowotnaProg: string;
  odliczenieZdrowotnej: number;
  pozycje: PozycjaR[];
  podstawa: number;
  podatek: number;
  naReke: number;
  /** podatek + zdrowotna + społeczne + FP jako % przychodu */
  obciazenie: number;
  stawkaEfektywna: number;
  porownanie: Forma[] | null;
  uwagi: string[];
}

export function obliczRyczalt(x: DaneR): WynikR {
  const uwagi: string[] = [];
  const mies = Math.min(12, Math.max(0, Math.round(x.miesiace ?? 12)));
  const rows = x.przychody.filter((p) => p.kwota > 0 && stawka(p.stawka));
  const przychod = r2(rows.reduce((a, p) => a + p.kwota, 0));
  const z = zusMiesiecznie(x.rok, x.zus, x.zusWlasny);
  const spoleczne = r2(z.spoleczne * mies), fp = r2(z.fp * mies);
  const zd = zdrowotnaRyczalt(x.rok, przychod);
  const zdrowotna = r2(zd.mies * mies);
  const odliczenieZdrowotnej = r2(zdrowotna * 0.5);
  const odliczenia = Math.min(przychod, r2(spoleczne + odliczenieZdrowotnej));

  // odliczenia proporcjonalnie do przychodów z różnych stawek (art. 11 ust. 3)
  const pozycje: PozycjaR[] = rows.map((p) => {
    const st = stawka(p.stawka)!;
    const odl = przychod > 0 ? r2((odliczenia * p.kwota) / przychod) : 0;
    const podstawa = zl0(Math.max(0, p.kwota - odl));
    let podatek: number;
    if (st.stawkaPowyzej && st.prog) podatek = (Math.min(podstawa, st.prog) * st.stawka + Math.max(0, podstawa - st.prog) * st.stawkaPowyzej) / 100;
    else podatek = (podstawa * st.stawka) / 100;
    return { stawka: st, przychod: p.kwota, odliczenia: odl, podstawa, podatek: r2(podatek) };
  });
  const podstawa = pozycje.reduce((a, p) => a + p.podstawa, 0);
  const podatek = zl0(pozycje.reduce((a, p) => a + p.podatek, 0));
  const naReke = r2(przychod - spoleczne - fp - zdrowotna - podatek);
  const obciazenie = przychod > 0 ? r2(((przychod - naReke) / przychod) * 100) : 0;
  const stawkaEfektywna = przychod > 0 ? r2((podatek / przychod) * 100) : 0;
  if (zd.niepewne) uwagi.push(`Składkę zdrowotną na ${x.rok} r. policzyliśmy według stawek z ${x.rok - 1} r. – nowe kwoty zależą od przeciętnego wynagrodzenia, które GUS poda w styczniu.`);
  if (pozycje.some((p) => p.stawka.stawkaPowyzej) && pozycje.some((p) => p.stawka.stawkaPowyzej && p.podstawa > (p.stawka.prog ?? 0))) uwagi.push('Od przychodu z najmu i noclegów ponad 100 000 zł stawka rośnie do 12,5%.');
  if (przychod > 0 && odliczenia >= przychod) uwagi.push('Składki są wyższe niż przychód – podatek wynosi 0 zł, a nadwyżki składek nie da się przenieść na kolejny rok.');
  if (x.zus === 'start') uwagi.push('Ulga na start trwa 6 pełnych miesięcy – potem przez 24 miesiące płacisz preferencyjny ZUS.');

  // porównanie z liniowym i skalą (te same składki społeczne; FP to koszt)
  let porownanie: Forma[] | null = null;
  if (x.koszty !== undefined && x.koszty >= 0 && przychod > 0) {
    const p = pit(x.rok), rd = rokDane(x.rok);
    const placa = parametry(x.rok)?.placa ?? 4806;
    const minZdr = r2(0.09 * placa * mies);
    const koszty = r2(x.koszty + fp);
    const dochod = Math.max(0, przychod - koszty);
    const baza = Math.max(0, dochod - spoleczne);
    // liniowy
    const zdrL = r2(Math.max(minZdr, 0.049 * baza));
    const limitL = rd?.zdrowotna_liniowy_limit_odliczenia?.wartosc ?? rokDane(x.rok - 1)?.zdrowotna_liniowy_limit_odliczenia?.wartosc ?? 14100;
    const podstL = zl0(Math.max(0, baza - Math.min(zdrL, limitL)));
    const podL = zl0(podstL * p.liniowy);
    // skala
    const zdrS = r2(Math.max(minZdr, 0.09 * baza));
    const podS = zl0(podatekSkala(zl0(baza), p));
    const forma = (nazwa: string, pod: number, zdr: number): Forma => {
      const nr = r2(przychod - x.koszty! - spoleczne - fp - zdr - pod);
      return { nazwa, podatek: pod, zdrowotna: zdr, spoleczne, fp, koszty: x.koszty!, naReke: nr, obciazenie: r2(((przychod - x.koszty! - nr) / przychod) * 100) };
    };
    porownanie = [
      { nazwa: 'Ryczałt', podatek, zdrowotna, spoleczne, fp, koszty: x.koszty, naReke: r2(naReke - x.koszty), obciazenie: r2(((przychod - naReke) / przychod) * 100) },
      forma('Podatek liniowy 19%', podL, zdrL),
      forma('Skala 12% / 32%', podS, zdrS),
    ];
    if (p.niepewne) uwagi.push(`Skala podatkowa na ${x.rok} r. nie jest jeszcze przesądzona – porównanie liczymy według obecnej.`);
  }
  return { przychod, spoleczne, fp, zdrowotna, zdrowotnaMies: zd.mies, zdrowotnaProg: zd.prog, odliczenieZdrowotnej, pozycje, podstawa, podatek, naReke, obciazenie, stawkaEfektywna, porownanie, uwagi };
}
