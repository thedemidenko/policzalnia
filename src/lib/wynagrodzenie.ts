// Wynagrodzenie z umowy o pracę: brutto → netto → koszt pracodawcy, miesiąc po miesiącu przez cały rok.
// Składki: ustawa o systemie ubezpieczeń społecznych (art. 16, 19 ust. 1 – limit 30-krotności dla emerytalnej i rentowej),
// zdrowotna 9% od brutto po składkach społecznych (ustawa o świadczeniach opieki zdrowotnej, art. 81), od 2022 r. nieodliczana.
// PIT: art. 22 ust. 2 (koszty 250/300 zł), ust. 9 pkt 3 i ust. 9a (50% autorskie, limit 120 000 zł), art. 21 ust. 1 pkt 148, 152–154
// (zerowy PIT do 85 528 zł: do 26 lat, rodzina 4+, powrót z zagranicy, pracujący senior), art. 32 (zaliczka 12%, od miesiąca
// przekroczenia 120 000 zł – 32%, kwota zmniejszająca 300 / 150 / 100 zł z PIT-2), art. 11 ust. 1 i art. 12 (wpłata pracodawcy
// do PPK jest przychodem). Fundusz Pracy: ustawa o rynku pracy – nie płaci się, gdy podstawa < płacy minimalnej i za osoby 55/60+.
import stawki from '../data/stawki.json';
import { pit, podatekSkala } from './ikze';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
type Lata = Record<string, { placa_minimalna: { wartosc: number | null }; limit_30_krotnosci: { wartosc: number | null } }>;
const rokDane = (rok: number) => (stawki.lata as unknown as Lata)[String(rok)] ?? (stawki.lata as unknown as Lata)['2026'];
export const placaMinimalna = (rok: number) => rokDane(rok).placa_minimalna.wartosc ?? 4806;
export const limit30 = (rok: number) => rokDane(rok).limit_30_krotnosci.wartosc ?? 282600;
export const LIMIT_ULGI = stawki.stale.ulga_dla_mlodych_limit;
export const LIMIT_KUP_AUTORSKICH = 120000;
export const WYPADKOWA = stawki.stale.skladki.wypadkowa_domyslna.pracodawca;
/** Kwoty brutto z gotowymi stronami „X brutto ile to netto” (/praca/kalkulator-wynagrodzen/<kwota>-brutto-ile-to-netto/). */
export const KWOTY_STRON = [4806, 4950, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 18000, 20000, 25000, 30000];
export const adresKwoty = (k: number) => `/praca/kalkulator-wynagrodzen/${k}-brutto-ile-to-netto/`;
export const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
export const MIESIACE_OD = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
export const MIESIACE_W = ['styczniu', 'lutym', 'marcu', 'kwietniu', 'maju', 'czerwcu', 'lipcu', 'sierpniu', 'wrześniu', 'październiku', 'listopadzie', 'grudniu'];

/** Zwolnienie z PIT do 85 528 zł przychodu w roku (jeden wspólny limit dla wszystkich czterech ulg). */
export type Zwolnienie = 'brak' | 'mlodzi' | 'rodzina' | 'powrot' | 'senior';

export interface DaneWynagrodzenia {
  rok: number;
  /** wynagrodzenie brutto w miesiącu */
  brutto: number;
  /** koszty uzyskania przychodu: 250 zł albo 300 zł (dojazd z innej miejscowości) */
  podwyzszoneKoszty?: boolean;
  /** część wynagrodzenia za prawa autorskie (0–1) – 50% kosztów */
  autorskie?: number;
  /** kwota zmniejszająca z PIT-2: 300, 150, 100 albo 0 */
  pit2?: number;
  zwolnienie?: Zwolnienie;
  ppk?: boolean;
  /** wpłata pracownika do PPK (podstawowa + dodatkowa), np. 0,02 */
  ppkPracownik?: number;
  /** wpłata pracodawcy do PPK (podstawowa + dodatkowa), np. 0,015 */
  ppkPracodawca?: number;
  wypadkowa?: number;
  /** kobieta 55+ / mężczyzna 60+ – bez Funduszu Pracy i FGŚP */
  bezFp?: boolean;
  /** wymiar etatu (do sprawdzenia płacy minimalnej) */
  etat?: number;
}

export interface Miesiac {
  brutto: number;
  emerytalna: number;
  rentowa: number;
  chorobowa: number;
  spoleczne: number;
  zdrowotna: number;
  koszty: number;
  ppkPracownika: number;
  ppkPracodawcy: number;
  /** przychód zwolniony z PIT (ulgi zerowego PIT) */
  zwolniony: number;
  podstawa: number;
  /** część podstawy opodatkowana stawką z wyższego progu */
  wyzszyProg: number;
  zaliczka: number;
  netto: number;
  skladkiPracodawcy: { emerytalna: number; rentowa: number; wypadkowa: number; fp: number; fgsp: number };
  kosztPracodawcy: number;
  /** limit 30-krotności osiągnięty – bez emerytalnej i rentowej (w całości lub w części) */
  limitZus: boolean;
}

export interface WynikRoczny {
  miesiace: Miesiac[];
  suma: Omit<Miesiac, 'limitZus' | 'skladkiPracodawcy' | 'wyzszyProg'> & { skladkiPracodawcy: number };
  /** pierwszy miesiąc (0–11) z zaliczką według wyższego progu, -1 gdy brak */
  miesiacProgu: number;
  /** pierwszy miesiąc, w którym przekroczono limit 30-krotności, -1 gdy brak */
  miesiacLimitu: number;
  /** pierwszy miesiąc z podatkiem mimo ulgi zerowego PIT, -1 gdy brak */
  miesiacKoncaUlgi: number;
  /** szacunek zeznania PIT-37: podatek należny i różnica względem pobranych zaliczek (+ zwrot, − dopłata) */
  pit37: { dochod: number; podatek: number; zaliczki: number; roznica: number };
  uwagi: string[];
}

export function obliczRok(x: DaneWynagrodzenia): WynikRoczny {
  const p = pit(x.rok);
  const brutto = r2(Math.max(0, x.brutto));
  const kup = x.podwyzszoneKoszty ? stawki.stale.kup_pracownicze.podwyzszone : stawki.stale.kup_pracownicze.podstawowe;
  const aut = Math.min(1, Math.max(0, x.autorskie ?? 0));
  const pit2 = Math.max(0, x.pit2 ?? 0);
  const zw = x.zwolnienie && x.zwolnienie !== 'brak';
  const ppkP = x.ppk ? (x.ppkPracownik ?? 0.02) : 0;
  const ppkF = x.ppk ? (x.ppkPracodawca ?? 0.015) : 0;
  const wyp = x.wypadkowa ?? WYPADKOWA;
  const lim = limit30(x.rok);
  const min = placaMinimalna(x.rok);

  let narZus = 0, narZw = 0, narDoch = 0, narKupAut = 0;
  let miesiacProgu = -1, miesiacLimitu = -1, miesiacKoncaUlgi = -1;
  const miesiace: Miesiac[] = [];
  for (let m = 0; m < 12; m++) {
    // składki emerytalna i rentowa tylko do limitu 30-krotności (narastająco od stycznia)
    const bazaER = Math.max(0, Math.min(brutto, lim - narZus));
    if (bazaER < brutto && miesiacLimitu < 0) miesiacLimitu = m;
    narZus += brutto;
    const emerytalna = r2(bazaER * 0.0976), rentowa = r2(bazaER * 0.015), chorobowa = r2(brutto * 0.0245);
    const spoleczne = r2(emerytalna + rentowa + chorobowa);
    const zdrowotna = r2(Math.max(0, brutto - spoleczne) * 0.09);
    // PPK liczy się od pełnego brutto (bez limitu 30-krotności); wpłata pracodawcy to przychód pracownika
    const ppkPracownika = r2(brutto * ppkP), ppkPracodawcy = r2(brutto * ppkF);
    const przychod = r2(brutto + ppkPracodawcy);

    // ulga zerowego PIT: zwolniony przychód do wspólnego limitu w roku
    const zwolniony = zw ? r2(Math.max(0, Math.min(przychod, LIMIT_ULGI - narZw))) : 0;
    narZw += zwolniony;
    const opod = r2(przychod - zwolniony);
    const udzial = przychod > 0 ? opod / przychod : 0;
    // składki społeczne odlicza się tylko w części przypadającej na przychód opodatkowany
    const spoleczneOdl = r2(spoleczne * udzial);
    let koszty = 0;
    if (opod > 0) {
      const bazaAut = Math.max(0, (brutto * udzial - spoleczneOdl) * aut);
      const kupAut = r2(Math.min(bazaAut * 0.5, Math.max(0, LIMIT_KUP_AUTORSKICH - narKupAut)));
      narKupAut += kupAut;
      koszty = r2(Math.min((aut < 1 ? kup : 0) + kupAut, Math.max(0, opod - spoleczneOdl)));
      if (zw && miesiacKoncaUlgi < 0) miesiacKoncaUlgi = m;
    }
    const podstawa = opod > 0 ? Math.round(Math.max(0, opod - spoleczneOdl - koszty)) : 0;
    // zaliczka według skali narastająco: od miesiąca przekroczenia progu – wyższa stawka od nadwyżki
    let podatek = 0, wyzszyProg = 0, dol = 0;
    for (const pr of p.progi) {
      const gora = pr.do ?? Infinity;
      const czesc = Math.max(0, Math.min(narDoch + podstawa, gora) - Math.max(narDoch, dol));
      podatek += czesc * pr.stawka;
      if (dol > 0) wyzszyProg += czesc;
      dol = gora;
    }
    narDoch += podstawa;
    if (wyzszyProg > 0 && miesiacProgu < 0) miesiacProgu = m;
    const zaliczka = podstawa > 0 ? Math.max(0, Math.round(podatek - pit2)) : 0;
    const netto = r2(brutto - spoleczne - zdrowotna - zaliczka - ppkPracownika);

    const fpTak = !x.bezFp && brutto >= min;
    const sp = {
      emerytalna: r2(bazaER * 0.0976), rentowa: r2(bazaER * 0.065), wypadkowa: r2(brutto * wyp),
      fp: fpTak ? r2(bazaER * 0.0245) : 0, fgsp: x.bezFp ? 0 : r2(bazaER * 0.001),
    };
    const kosztPracodawcy = r2(brutto + sp.emerytalna + sp.rentowa + sp.wypadkowa + sp.fp + sp.fgsp + ppkPracodawcy);
    miesiace.push({ brutto, emerytalna, rentowa, chorobowa, spoleczne, zdrowotna, koszty, ppkPracownika, ppkPracodawcy, zwolniony, podstawa, wyzszyProg, zaliczka, netto, skladkiPracodawcy: sp, kosztPracodawcy, limitZus: bazaER < brutto });
  }

  const s = (f: (q: Miesiac) => number) => r2(miesiace.reduce((a, q) => a + f(q), 0));
  const suma = {
    brutto: s((q) => q.brutto), emerytalna: s((q) => q.emerytalna), rentowa: s((q) => q.rentowa), chorobowa: s((q) => q.chorobowa),
    spoleczne: s((q) => q.spoleczne), zdrowotna: s((q) => q.zdrowotna), koszty: s((q) => q.koszty), ppkPracownika: s((q) => q.ppkPracownika),
    ppkPracodawcy: s((q) => q.ppkPracodawcy), zwolniony: s((q) => q.zwolniony), podstawa: s((q) => q.podstawa), zaliczka: s((q) => q.zaliczka),
    netto: s((q) => q.netto), kosztPracodawcy: s((q) => q.kosztPracodawcy),
    skladkiPracodawcy: s((q) => q.skladkiPracodawcy.emerytalna + q.skladkiPracodawcy.rentowa + q.skladkiPracodawcy.wypadkowa + q.skladkiPracodawcy.fp + q.skladkiPracodawcy.fgsp),
  };
  // zeznanie roczne: dochód zaokrąglony, skala z kwotą zmniejszającą 3600 zł (bez innych ulg i wspólnego rozliczenia)
  const dochodRoczny = Math.round(suma.podstawa);
  const podatekRoczny = Math.round(podatekSkala(dochodRoczny, p));
  const pit37 = { dochod: dochodRoczny, podatek: podatekRoczny, zaliczki: suma.zaliczka, roznica: r2(suma.zaliczka - podatekRoczny) };

  const uwagi: string[] = [];
  const etat = x.etat && x.etat > 0 ? x.etat : 1;
  if (brutto > 0 && brutto < r2(min * etat) - 0.004)
    uwagi.push(`Pensja jest niższa niż płaca minimalna w ${x.rok} r. dla tego wymiaru etatu – ${r2(min * etat).toLocaleString('pl-PL')} zł brutto (${min.toLocaleString('pl-PL')} zł za pełny etat).`);
  if (miesiacProgu >= 0) uwagi.push(`Od ${MIESIACE_OD[miesiacProgu]} dochód od początku roku przekroczy ${(p.progi[0].do ?? 0).toLocaleString('pl-PL')} zł i pracodawca zacznie pobierać zaliczkę według stawki ${Math.round(p.progi[1].stawka * 100)}% – na rękę dostaniesz wtedy mniej.`);
  if (miesiacLimitu >= 0) uwagi.push(`W ${MIESIACE_W[miesiacLimitu]} suma pensji przekroczy limit 30-krotności (${lim.toLocaleString('pl-PL')} zł) – do końca roku nie płacisz składki emerytalnej i rentowej, więc netto rośnie.`);
  if (zw && miesiacKoncaUlgi >= 0) uwagi.push(`Limit zerowego PIT (${LIMIT_ULGI.toLocaleString('pl-PL')} zł przychodu w roku) wyczerpie się w ${MIESIACE_W[miesiacKoncaUlgi]} – od tej pory pracodawca pobiera zaliczkę na podatek.`);
  if (zw) uwagi.push('Ulga zerowego PIT zwalnia tylko z podatku – składki ZUS i zdrowotną płacisz w całości.');
  if (pit2 === 0 && !zw) uwagi.push('Bez PIT-2 pracodawca nie odlicza 300 zł miesięcznie – nadpłatę (do 3600 zł) odzyskasz w zeznaniu rocznym.');
  if (x.ppk) uwagi.push('Wpłata pracodawcy do PPK jest Twoim przychodem – zwiększa zaliczkę na podatek, choć nie trafia na konto.');
  return { miesiace, suma, miesiacProgu, miesiacLimitu, miesiacKoncaUlgi, pit37, uwagi };
}

/** Pierwszy miesiąc roku – typowa wypłata bez progu 32% i bez limitu ZUS. */
export const obliczMiesiac = (x: DaneWynagrodzenia) => obliczRok(x).miesiace[0];

/** Brutto, przy którym wypłata w styczniu wynosi co najmniej podaną kwotę netto. */
export function bruttoZNetto(netto: number, x: Omit<DaneWynagrodzenia, 'brutto'>): number {
  if (!(netto > 0)) return 0;
  const n = (b: number) => obliczRok({ ...x, brutto: r2(b) }).miesiace[0].netto;
  let lo = netto, hi = netto * 2 + 500;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (n(m) >= netto) hi = m; else lo = m; }
  let b = Math.ceil(hi * 100) / 100;
  while (b > 0.01 && n(b - 0.01) >= netto) b = r2(b - 0.01);
  // przez zaokrąglanie zaliczki do złotych kilka kwot brutto daje to samo netto – wtedy wybieramy pełną złotówkę
  const pelna = Math.ceil(b);
  if (pelna !== b && n(pelna) === n(b)) return pelna;
  return r2(b);
}

/** Brutto, przy którym łączny koszt pracodawcy w styczniu nie przekracza podanej kwoty. */
export function bruttoZKosztu(koszt: number, x: Omit<DaneWynagrodzenia, 'brutto'>): number {
  if (!(koszt > 0)) return 0;
  const k = (b: number) => obliczRok({ ...x, brutto: r2(b) }).miesiace[0].kosztPracodawcy;
  let lo = 0, hi = koszt;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (k(m) <= koszt) lo = m; else hi = m; }
  let b = Math.floor(lo * 100) / 100;
  while (k(b + 0.01) <= koszt) b = r2(b + 0.01);
  return r2(b);
}
