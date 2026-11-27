// Składki ZUS przedsiębiorcy (JDG) miesiąc po miesiącu.
// Społeczne: ustawa o systemie ubezpieczeń społecznych – art. 18 ust. 8 (pełny ZUS: podstawa ≥ 60% prognozowanego przeciętnego
// wynagrodzenia), art. 18a (preferencyjny: ≥ 30% płacy minimalnej przez 24 miesiące), art. 18c (mały ZUS plus – podstawa z dochodu);
// ulga na start: art. 18 ustawy – Prawo przedsiębiorców (6 miesięcy bez składek społecznych). Fundusz Pracy: tylko gdy podstawa
// ≥ płacy minimalnej i nie za kobiety 55+ / mężczyzn 60+ (art. 259, 261 ustawy o rynku pracy). Wakacje składkowe: jeden miesiąc
// w roku bez składek społecznych i FP liczonych od najniższej obowiązującej podstawy (ZUS, od 1.11.2024).
// Zdrowotna: ustawa o świadczeniach opieki zdrowotnej – art. 79 (9%), art. 79a (liniowy 4,9%), art. 81 ust. 2c–2d (skala i liniowy:
// dochód z poprzedniego miesiąca, minimum od płacy minimalnej z pierwszego dnia roku składkowego), ust. 2f–2g (ryczałt: 60 / 100 /
// 180% przeciętnego wynagrodzenia z IV kw. według przychodu narastająco, przychód pomniejszony o składki społeczne). Rok składkowy
// skali i liniowego trwa od lutego do stycznia, więc ich styczeń liczy się według stawek z poprzedniego roku; ryczałt i karta
// – według roku kalendarzowego.
import stawki from '../data/stawki.json';
import zdrDane from '../data/zdrowotna-jdg.json';
import { parametry, skladki, zasilek } from './maly-zus';

const r2 = (n: number) => Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100;

export type Etap = 'start' | 'pref' | 'mzp' | 'pelny' | 'wlasna';
export type FormaZdr = 'skala' | 'liniowy' | 'ryczalt' | 'karta';
/** firma – tylko działalność; etat – także umowa o pracę z pensją co najmniej minimalną (społeczne z firmy dobrowolne);
 *  emeryt – emeryt lub rencista prowadzący firmę (społeczne obowiązkowe, bez Funduszu Pracy ze względu na wiek) */
export type Sytuacja = 'firma' | 'etat' | 'emeryt';

export interface DaneZus {
  rok: number;
  etap: Etap;
  /** podstawa dla małego ZUS plus albo zadeklarowana wyższa podstawa */
  podstawa?: number;
  chorobowe?: boolean;
  /** stopa wypadkowa w % */
  wypadkowa?: number;
  /** kobieta 55+ / mężczyzna 60+ – bez Funduszu Pracy */
  bezFp?: boolean;
  sytuacja?: Sytuacja;
  forma: FormaZdr;
  /** skala, liniowy: miesięczny dochód (przychód minus koszty, przed odjęciem składek społecznych) */
  dochod?: number;
  /** ryczałt: miesięczny przychód */
  przychod?: number;
  /** miesiąc wakacji składkowych (0–11), -1 – bez */
  wakacje?: number;
}

export interface MiesiacZus {
  podstawa: number;
  emerytalna: number;
  rentowa: number;
  chorobowa: number;
  wypadkowa: number;
  fp: number;
  spoleczne: number;
  zdrowotna: number;
  /** opis podstawy zdrowotnej, np. „9% dochodu”, „minimum”, „ryczałt do 60 000 zł” */
  zdrOpis: string;
  razem: number;
  wakacje: boolean;
}

/** Parametry zdrowotnej dla roku składkowego (luty roku rs – styczeń rs+1). */
export function zdrowotnaParametry(rs: number): { minPodstawa: number; ryczaltPodstawa: number; niepewne: boolean } {
  const s = (stawki.lata as Record<string, { placa_minimalna: { wartosc: number | null }; zdrowotna_ryczalt_podstawa?: { wartosc: number | null } }>)[String(rs)];
  const st = (zdrDane.lata as Record<string, { min_podstawa: number; ryczalt_podstawa: number }>)[String(rs)];
  if (s) {
    const ryczalt = s.zdrowotna_ryczalt_podstawa?.wartosc ?? null;
    const poprz = zdrowotnaParametry(rs - 1);
    return { minPodstawa: s.placa_minimalna.wartosc ?? poprz.minPodstawa, ryczaltPodstawa: ryczalt ?? poprz.ryczaltPodstawa, niepewne: ryczalt === null };
  }
  if (st) return { minPodstawa: st.min_podstawa, ryczaltPodstawa: st.ryczalt_podstawa, niepewne: false };
  return { minPodstawa: 4806, ryczaltPodstawa: 9228.64, niepewne: true };
}

/** Najniższa obowiązująca podstawa składek społecznych na danym etapie. */
function podstawyEtapu(x: DaneZus): { podstawa: number; najnizsza: number } | null {
  const p = parametry(x.rok);
  if (!p || x.etap === 'start' || x.sytuacja === 'etat') return null;
  if (x.etap === 'pref') return { podstawa: p.min, najnizsza: p.min };
  if (x.etap === 'mzp') { const b = r2(Math.min(p.max, Math.max(p.min, x.podstawa ?? p.min))); return { podstawa: b, najnizsza: b }; }
  if (x.etap === 'wlasna') return { podstawa: r2(Math.max(p.max, x.podstawa ?? p.max)), najnizsza: p.max };
  return { podstawa: p.max, najnizsza: p.max };
}

export interface WynikZus {
  miesiace: MiesiacZus[];
  /** typowy miesiąc (luty) */
  typowy: MiesiacZus;
  rok: { spoleczne: number; fp: number; zdrowotna: number; razem: number };
  /** zdrowotna do odliczenia w roku: liniowy – do limitu, ryczałt – 50%, skala – 0 */
  odliczenieZdrowotnej: number;
  /** składki społeczne do odliczenia od dochodu / przychodu (albo do kosztów) w roku */
  odliczenieSpolecznych: number;
  /** ryczałt: dopłata zdrowotnej w rozliczeniu rocznym, gdy przychód z roku przekroczy próg (art. 81 ust. 2e) */
  doplataZdrowotnej: number;
  /** zasiłek chorobowy za pełny miesiąc L4 (80%), gdy opłacana jest chorobowa */
  zasilek: number;
  uwagi: string[];
}

export function obliczZus(x: DaneZus): WynikZus {
  const p = parametry(x.rok);
  const placa = p?.placa ?? 4806;
  const pods = podstawyEtapu(x);
  const chor = x.chorobowe !== false;
  const bezFp = !!x.bezFp || x.sytuacja === 'emeryt';
  const wyp = x.wypadkowa ?? 1.67;
  const uwagi: string[] = [];
  const miesiace: MiesiacZus[] = [];
  let narPrzychod = 0;
  let niepewnaZdr = false;

  for (let m = 0; m < 12; m++) {
    // składki społeczne i FP
    let s = pods ? skladki(pods.podstawa, { chorobowe: chor, wypadkowa: wyp, bezFP: bezFp }, placa) : skladki(0, { chorobowe: false, wypadkowa: 0, bezFP: true }, placa);
    const wakacje = !!pods && x.wakacje === m;
    if (wakacje) {
      // zwolnienie obejmuje składki od najniższej podstawy – nadwyżkę ponad nią płaci się samodzielnie
      const z = skladki(pods!.najnizsza, { chorobowe: chor, wypadkowa: wyp, bezFP: bezFp }, placa);
      s = { ...s, emerytalna: r2(s.emerytalna - z.emerytalna), rentowa: r2(s.rentowa - z.rentowa), chorobowa: r2(s.chorobowa - z.chorobowa), wypadkowa: r2(s.wypadkowa - z.wypadkowa), fp: r2(s.fp - z.fp), spoleczne: r2(s.spoleczne - z.spoleczne), razem: r2(s.razem - z.razem) };
    }

    // zdrowotna: skala i liniowy – rok składkowy od lutego, więc styczeń według poprzedniego roku (art. 79a, 81 ust. 2d);
    // ryczałt i karta – rok kalendarzowy (IV kw. poprzedniego roku, płaca minimalna z 1 stycznia; art. 81 ust. 2f i 2z)
    const zp = zdrowotnaParametry(m === 0 && (x.forma === 'skala' || x.forma === 'liniowy') ? x.rok - 1 : x.rok);
    if (zp.niepewne && x.forma === 'ryczalt') niepewnaZdr = true;
    const minZdr = r2(zp.minPodstawa * 0.09);
    let zdrowotna = 0, zdrOpis = '';
    if (x.forma === 'skala' || x.forma === 'liniowy') {
      const baza = Math.max(0, (x.dochod ?? 0) - s.spoleczne);
      const stopa = x.forma === 'skala' ? 0.09 : 0.049;
      const wg = r2(baza * stopa);
      zdrowotna = Math.max(minZdr, wg);
      zdrOpis = wg > minZdr ? `${x.forma === 'skala' ? '9' : '4,9'}% dochodu` : 'minimalna';
    } else if (x.forma === 'karta') {
      zdrowotna = minZdr; zdrOpis = 'karta podatkowa';
    } else {
      narPrzychod += Math.max(0, (x.przychod ?? 0) - s.spoleczne);
      const [mn, prog] = narPrzychod <= 60000 ? [0.6, 'przychód do 60 000 zł'] : narPrzychod <= 300000 ? [1, 'przychód 60–300 tys. zł'] : [1.8, 'przychód ponad 300 000 zł'];
      zdrowotna = r2(0.09 * r2(mn * zp.ryczaltPodstawa));
      zdrOpis = prog as string;
    }
    miesiace.push({ podstawa: pods?.podstawa ?? 0, emerytalna: s.emerytalna, rentowa: s.rentowa, chorobowa: s.chorobowa, wypadkowa: s.wypadkowa, fp: s.fp, spoleczne: s.spoleczne, zdrowotna, zdrOpis, razem: r2(s.spoleczne + s.fp + zdrowotna), wakacje });
  }

  const suma = (f: (q: MiesiacZus) => number) => r2(miesiace.reduce((a, q) => a + f(q), 0));
  const rok = { spoleczne: suma((q) => q.spoleczne), fp: suma((q) => q.fp), zdrowotna: suma((q) => q.zdrowotna), razem: suma((q) => q.razem) };
  type Rok = { zdrowotna_liniowy_limit_odliczenia?: { wartosc: number | null } };
  const lata = stawki.lata as Record<string, Rok>;
  const limitL = lata[String(x.rok)]?.zdrowotna_liniowy_limit_odliczenia?.wartosc ?? lata[String(x.rok - 1)]?.zdrowotna_liniowy_limit_odliczenia?.wartosc ?? 14100;
  const odliczenieZdrowotnej = x.forma === 'liniowy' ? Math.min(rok.zdrowotna, limitL) : x.forma === 'ryczalt' ? r2(rok.zdrowotna * 0.5) : 0;

  // rozliczenie roczne na ryczałcie: 12 miesięcy według progu z przychodu całego roku minus zapłacone składki
  let doplataZdrowotnej = 0;
  if (x.forma === 'ryczalt') {
    const zp = zdrowotnaParametry(x.rok);
    const mn = narPrzychod <= 60000 ? 0.6 : narPrzychod <= 300000 ? 1 : 1.8;
    doplataZdrowotnej = Math.max(0, r2(12 * r2(0.09 * r2(mn * zp.ryczaltPodstawa)) - rok.zdrowotna));
  }

  if (x.etap === 'start') uwagi.push('Ulga na start: przez 6 pełnych miesięcy od rozpoczęcia działalności płacisz tylko składkę zdrowotną – bez prawa do zasiłków z ZUS i bez okresu składkowego do emerytury.');
  if (x.sytuacja === 'etat' && x.etap !== 'start') uwagi.push(`Przy umowie o pracę z pensją co najmniej ${placa.toLocaleString('pl-PL')} zł brutto składki społeczne z firmy są dobrowolne – obowiązkowa jest tylko zdrowotna.`);
  if (x.sytuacja === 'emeryt') uwagi.push('Emeryt prowadzący firmę płaci składki społeczne jak inni przedsiębiorcy (chorobowa dobrowolna), ale bez Funduszu Pracy – nie płacą go kobiety po 55. i mężczyźni po 60. roku życia.');
  if (pods && !chor) uwagi.push('Bez dobrowolnej składki chorobowej nie dostaniesz zasiłku chorobowego ani macierzyńskiego z ZUS.');
  if (pods && pods.podstawa < placa && !bezFp) uwagi.push(`Fundusz Pracy płaci się dopiero od podstawy równej płacy minimalnej (${placa.toLocaleString('pl-PL')} zł) – przy tej podstawie go nie ma.`);
  if (x.wakacje !== undefined && x.wakacje >= 0 && pods) uwagi.push('W miesiącu wakacji składkowych składki społeczne i FP od najniższej podstawy opłaca budżet państwa – wliczają się do emerytury. Zdrowotną płacisz normalnie. Wniosek RWS trzeba złożyć w eZUS w miesiącu poprzedzającym.');
  if (x.forma === 'ryczalt' && miesiace.some((q, i) => i > 0 && q.zdrOpis !== miesiace[i - 1].zdrOpis)) uwagi.push('Zdrowotna rośnie od miesiąca, w którym przychód od początku roku przekroczy próg – za wcześniejsze miesiące różnicę dopłacisz w rozliczeniu rocznym.');
  if (niepewnaZdr) uwagi.push(`Zdrowotną na ryczałcie w ${x.rok} r. liczymy według przeciętnego wynagrodzenia z poprzedniego roku – nowe kwoty poda GUS w styczniu.`);
  if (x.forma === 'skala' || x.forma === 'liniowy') uwagi.push('Zdrowotną liczy się od dochodu z poprzedniego miesiąca, a po roku rozlicza w zeznaniu – przy nierównych dochodach miesięczne kwoty będą inne.');

  return {
    miesiace, typowy: miesiace[1], rok, odliczenieZdrowotnej, doplataZdrowotnej,
    odliczenieSpolecznych: rok.spoleczne,
    zasilek: pods && chor ? zasilek(pods.podstawa) : 0,
    uwagi,
  };
}
