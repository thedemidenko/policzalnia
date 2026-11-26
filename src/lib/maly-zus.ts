// „Mały ZUS plus” (art. 18c ustawy o systemie ubezpieczeń społecznych). Podstawa składek emerytalnej i rentowych na dany rok
// = 0,5 × przeciętny miesięczny dochód z poprzedniego roku (dochód × 30 / dni prowadzenia działalności), w granicach
// 30% płacy minimalnej ze stycznia – 60% prognozowanego przeciętnego wynagrodzenia. Warunek: przychód w poprzednim roku
// ≤ 120 000 zł (proporcjonalnie przy niepełnym roku, ust. 7), działalność ≥ 60 dni. Ryczałt i karta (bez zwolnienia z VAT):
// dochód = 0,5 × przychód (ust. 12). Składki w kosztach doliczane do dochodu (ust. 4a). Od 2026 r.: 36 miesięcy ulgi
// w każdym okresie 60 miesięcy prowadzenia działalności (ust. 11a–11c). Fundusz Pracy tylko przy podstawie ≥ płacy
// minimalnej (art. 259 ustawy o rynku pracy), nie dla kobiet 55+ i mężczyzn 60+ (art. 261).
import stawki from '../data/stawki.json';
// zaokrąglenie do grosza „w górę od 0,5 grosza” (art. 18c ust. 3, 4, 7, 13) – odporne na błąd zapisu liczb (4849,315)
const r2 = (n: number) => Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;

export type Forma = 'skala' | 'liniowy' | 'ryczalt' | 'karta' | 'mieszana';
export const FORMY: Record<Forma, string> = {
  skala: 'skala podatkowa (12% i 32%)',
  liniowy: 'podatek liniowy 19%',
  ryczalt: 'ryczałt od przychodów',
  karta: 'karta podatkowa',
  mieszana: 'kilka form w ciągu roku',
};
export const LATA = Object.keys(stawki.lata).map(Number).sort();

const S = stawki.stale.skladki;
const STOPY = { emerytalna: S.emerytalna.pracownik + S.emerytalna.pracodawca, rentowa: S.rentowa.pracownik + S.rentowa.pracodawca, chorobowa: S.chorobowa.pracownik, fp: S.fundusz_pracy.pracodawca };

type Rok = { placa_minimalna: { wartosc: number }; prognozowane_przecietne: { wartosc: number }; zdrowotna_ryczalt_podstawa?: { wartosc: number | null } };
export function parametry(rok: number) {
  const p = (stawki.lata as Record<string, Rok>)[String(rok)];
  if (!p) return null;
  const placa = p.placa_minimalna.wartosc, prognoza = p.prognozowane_przecietne.wartosc;
  return { placa, prognoza, min: r2(0.3 * placa), max: r2(0.6 * prognoza), ryczaltPodstawa: p.zdrowotna_ryczalt_podstawa?.wartosc ?? null };
}
export const dniWRoku = (rok: number) => (rok % 4 === 0 && (rok % 100 !== 0 || rok % 400 === 0) ? 366 : 365);

export interface DaneMZP {
  /** rok, na który ustalamy podstawę (dochód z roku poprzedniego) */
  rok: number;
  forma: Forma;
  /** przychód i dochód (zasady ogólne: skala / liniowy) */
  przychodOgolne?: number;
  dochodOgolne?: number;
  przychodRyczalt?: number;
  /** karta podatkowa: sprzedaż opodatkowana VAT (bez VAT) */
  przychodKarta?: number;
  kartaZwolnionaVat?: boolean;
  /** składki społeczne zaliczone do kosztów – doliczane do dochodu (ust. 4a) */
  skladkiWKosztach?: number;
  /** dni prowadzenia działalności w poprzednim roku (domyślnie cały rok) */
  dni?: number;
  chorobowe?: boolean;
  wypadkowa?: number;
  bezFP?: boolean;
  /** wykluczenia z ust. 11 */
  preferencyjny?: boolean;
  bylyPracodawca?: boolean;
  innaDzialalnosc?: boolean;
  stawkaRyczaltu?: number;
}
export interface Skladki { podstawa: number; emerytalna: number; rentowa: number; chorobowa: number; wypadkowa: number; fp: number; spoleczne: number; razem: number }
export interface WynikMZP {
  mozna: boolean;
  powody: string[];
  przychod: number;
  limit: number;
  dni: number;
  dochod: number;
  przecietny: number;
  podstawaWyliczona: number;
  podstawa: number;
  min: number;
  max: number;
  maly: Skladki;
  pelny: Skladki;
  oszczednoscMies: number;
  oszczednoscRok: number;
  /** oszczędność po uwzględnieniu mniejszego odliczenia składek od dochodu / przychodu */
  oszczednoscPoPodatku: number;
  stawkaPodatku: number;
  zdrowotna: number | null;
  zdrowotnaOpis: string;
  zasilekMaly: number;
  zasilekPelny: number;
  emerytalnaRocznieMniej: number;
  /** średni dochód miesięczny, od którego podstawa osiąga maksimum (ulga nic nie daje) */
  progBezKorzysci: number;
  uwagi: string[];
  blad?: string;
}

export function skladki(podstawa: number, x: { chorobowe?: boolean; wypadkowa?: number; bezFP?: boolean }, placa: number): Skladki {
  const emerytalna = r2(podstawa * STOPY.emerytalna), rentowa = r2(podstawa * STOPY.rentowa);
  const chorobowa = x.chorobowe === false ? 0 : r2(podstawa * STOPY.chorobowa);
  const wypadkowa = r2(podstawa * (x.wypadkowa ?? 1.67) / 100);
  const fp = !x.bezFP && podstawa >= placa ? r2(podstawa * STOPY.fp) : 0;
  const spoleczne = r2(emerytalna + rentowa + chorobowa + wypadkowa);
  return { podstawa, emerytalna, rentowa, chorobowa, wypadkowa, fp, spoleczne, razem: r2(spoleczne + fp) };
}

/** Zasiłek chorobowy za pełny miesiąc (80% podstawy po odjęciu 13,71%). */
export const zasilek = (podstawa: number) => r2(podstawa * (1 - 0.1371) * 0.8);

export function obliczMalyZus(x: DaneMZP): WynikMZP | { blad: string } {
  const par = parametry(x.rok);
  if (!par) return { blad: `Kalkulator zna parametry na lata ${LATA.join(', ')}.` };
  const uwagi: string[] = [];
  const powody: string[] = [];
  const rokPop = x.rok - 1;
  const pelnyRok = dniWRoku(rokPop);
  const dni = Math.min(pelnyRok, Math.max(0, Math.round(x.dni ?? pelnyRok)));
  const f = x.forma;
  const ogolne = f === 'skala' || f === 'liniowy' || f === 'mieszana';
  const ryczalt = f === 'ryczalt' || f === 'mieszana';
  const karta = f === 'karta' || f === 'mieszana';
  const pO = ogolne ? Math.max(0, x.przychodOgolne ?? 0) : 0;
  const dO = ogolne ? (x.dochodOgolne ?? 0) : 0;
  const pR = ryczalt ? Math.max(0, x.przychodRyczalt ?? 0) : 0;
  const pK = karta && !x.kartaZwolnionaVat ? Math.max(0, x.przychodKarta ?? 0) : 0;
  const przychod = r2(pO + pR + pK);
  const dochod = r2(dO + r2(0.5 * pR) + r2(0.5 * pK) + (ogolne ? Math.max(0, x.skladkiWKosztach ?? 0) : 0));

  const limit = dni >= pelnyRok ? 120000 : r2((120000 / pelnyRok) * dni);
  if (dni < 60) powody.push(`W ${rokPop} r. działalność trwała krócej niż 60 dni.`);
  if (przychod > limit) powody.push(`Przychód z ${rokPop} r. (${przychod.toLocaleString('pl-PL')} zł) przekracza limit ${limit.toLocaleString('pl-PL', { minimumFractionDigits: dni >= pelnyRok ? 0 : 2 })} zł.`);
  if (karta && x.kartaZwolnionaVat) powody.push('Karta podatkowa ze zwolnieniem z VAT wyklucza Mały ZUS Plus.');
  if (x.preferencyjny) powody.push('W okresie preferencyjnych składek (pierwsze 24 miesiące) nie można korzystać z Małego ZUS Plus.');
  if (x.bylyPracodawca) powody.push('Działalność na rzecz byłego pracodawcy wyklucza ulgę.');
  if (x.innaDzialalnosc) powody.push('Prowadzenie w poprzednim roku także innej działalności (np. wspólnik spółki jawnej, twórca, wolny zawód poza firmą) wyklucza ulgę.');

  const przecietny = dni > 0 ? r2((dochod * 30) / dni) : 0;
  const podstawaWyliczona = r2(Math.max(0, przecietny) * 0.5);
  const podstawa = Math.min(par.max, Math.max(par.min, podstawaWyliczona));
  if (dochod <= 0) uwagi.push(`Przy stracie lub zerowym dochodzie podstawa wynosi minimum – ${par.min.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł.`);
  if (podstawaWyliczona > par.max) uwagi.push('Dochód jest na tyle wysoki, że podstawa osiąga maksimum – składki są takie jak na pełnym ZUS, więc ulga nic nie daje.');

  const opcje = { chorobowe: x.chorobowe, wypadkowa: x.wypadkowa, bezFP: x.bezFP };
  const maly = skladki(podstawa, opcje, par.placa);
  const pelny = skladki(par.max, opcje, par.placa);
  const mozna = powody.length === 0;
  const oszczednoscMies = r2(pelny.razem - maly.razem);
  const oszczednoscRok = r2(oszczednoscMies * 12);

  // efekt podatkowy: mniejsze składki społeczne = mniejsze odliczenie (FP to koszt – też)
  const st = f === 'liniowy' ? 19 : f === 'ryczalt' ? (x.stawkaRyczaltu ?? 12) : 12;
  const oszczednoscPoPodatku = r2(oszczednoscRok * (1 - st / 100));

  // składka zdrowotna (szacunek przy podobnym dochodzie w roku składkowym)
  let zdrowotna: number | null = null, zdrowotnaOpis = '';
  const minZdr = r2(0.09 * par.placa);
  const dochodMies = dni > 0 ? (dochod * 30) / dni : 0;
  if (f === 'skala' || f === 'liniowy') {
    const st2 = f === 'skala' ? 0.09 : 0.049;
    zdrowotna = r2(Math.max(minZdr, st2 * Math.max(0, dochodMies - (mozna ? maly : pelny).spoleczne)));
    zdrowotnaOpis = `${f === 'skala' ? '9%' : '4,9%'} dochodu, min. ${minZdr.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł – szacunkowo przy podobnym dochodzie`;
  } else if (f === 'ryczalt') {
    if (par.ryczaltPodstawa) {
      const roczny = (pR * pelnyRok) / Math.max(1, dni);
      const m = roczny <= 60000 ? 0.6 : roczny <= 300000 ? 1 : 1.8;
      zdrowotna = r2(0.09 * m * par.ryczaltPodstawa);
      zdrowotnaOpis = `ryczałt, przychód ${roczny <= 60000 ? 'do 60 tys.' : roczny <= 300000 ? '60–300 tys.' : 'ponad 300 tys.'} zł – przy podobnym przychodzie`;
    } else zdrowotnaOpis = 'stawki dla ryczałtu na ten rok GUS poda w styczniu';
  } else if (f === 'karta') {
    zdrowotna = minZdr;
    zdrowotnaOpis = '9% płacy minimalnej';
  } else zdrowotnaOpis = 'zależy od formy opodatkowania w roku składkowym';

  if (maly.fp === 0 && !x.bezFP && pelny.fp > 0) uwagi.push(`Przy podstawie niższej niż płaca minimalna (${par.placa.toLocaleString('pl-PL')} zł) nie płacisz Funduszu Pracy.`);
  if (x.chorobowe === false) uwagi.push('Bez ubezpieczenia chorobowego nie dostaniesz zasiłku chorobowego ani macierzyńskiego.');

  return {
    mozna, powody, przychod, limit, dni, dochod, przecietny, podstawaWyliczona, podstawa, min: par.min, max: par.max, maly, pelny,
    oszczednoscMies, oszczednoscRok, oszczednoscPoPodatku, stawkaPodatku: st, zdrowotna, zdrowotnaOpis,
    zasilekMaly: x.chorobowe === false ? 0 : zasilek(podstawa), zasilekPelny: x.chorobowe === false ? 0 : zasilek(par.max),
    emerytalnaRocznieMniej: r2((pelny.emerytalna - maly.emerytalna) * 12), progBezKorzysci: r2(par.max * 2), uwagi,
  };
}

/** Licznik ulgi od 2026 r.: 36 miesięcy ulgi w okresie 60 miesięcy prowadzenia działalności. */
export function okresUlgi(start: string, zawieszenie = 0, bezUlgi = 0): { koniecUlgi: string; koniecOkresu: string; kolejnyOd: string; pozostalo?: number } | null {
  if (!/^\d{4}-\d{2}$/.test(start)) return null;
  const plus = (n: number) => { const d = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const z = Math.max(0, Math.floor(zawieszenie)), b = Math.max(0, Math.floor(bezUlgi));
  // miesiące zawieszenia nie liczą się do 60 ani do 36; miesiące działalności bez ulgi liczą się tylko do 60
  const koniecOkresu = plus(59 + z);
  const koniecUlgi = plus(Math.min(35 + z + b, 59 + z));
  return { koniecUlgi, koniecOkresu, kolejnyOd: plus(60 + z) };
}
