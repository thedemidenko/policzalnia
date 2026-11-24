// Odsetki za zwłokę od zaległości podatkowych (Ordynacja podatkowa, art. 53–56d, 62, 63).
// Stawka od 1.01.2016 = 200% stopy lombardowej NBP + 2 pp, nie mniej niż 8% (art. 56 § 1), zmienia się od dnia zmiany
// stopy lombardowej (art. 56c). Obniżona = 50% (art. 56a), podwyższona = 150% (art. 56b). Do 31.12.2015 – tabela MF.
// Wzór (rozporządzenie MF, Dz.U. 2021 poz. 703, § 2): kwota × dni × stawka / 365, osobno dla każdego okresu stawki,
// zaokrągla się sumę (do pełnych złotych, art. 63 § 1). Odsetki od dnia po terminie płatności (art. 53 § 4)
// do dnia zapłaty włącznie (§ 4 rozporządzenia). Wpłata niepokrywająca całości – proporcjonalnie na podatek i odsetki
// (art. 55 § 2), bez zaokrągleń (art. 63 § 3); kolejność – zaległość o najwcześniejszym terminie (art. 62 § 1).
// Odsetek nie nalicza się, gdy nie przekraczają 3 × opłaty za list polecony (art. 54 § 1 pkt 5) – 8,70 zł.
import stopy from '../data/stopy-nbp.json';
import { r2 } from './format';
import { dodajDni, terminRoboczy } from './kalendarz';
import { dzien, iso } from './odsetki';

export type StawkaPodatkowa = 'podstawowa' | 'obnizona' | 'podwyzszona';
export const MNOZNIK: Record<StawkaPodatkowa, number> = { podstawowa: 1, obnizona: 0.5, podwyzszona: 1.5 };
export const PROG = stopy.prog_odsetek_podatkowych.kwota;
export const OD_KIEDY = stopy.odsetki_podatkowe_do_2015[0].od;
const NOWE_PRZEPISY = '2016-01-01';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pl = (d: string) => d.split('-').reverse().join('.');

/** Zaokrąglenie do pełnych złotych: poniżej 50 gr w dół, od 50 gr w górę (art. 63 § 1). */
export const doZlotych = (n: number) => Math.round(r2(n));

/** Roczna stawka odsetek za zwłokę (w %) w danym dniu. NaN, gdy kalkulator jej nie zna. */
export function stawkaPodatkowa(data: string, rodzaj: StawkaPodatkowa = 'podstawowa'): number {
  if (data < NOWE_PRZEPISY) {
    if (rodzaj !== 'podstawowa') return NaN;
    let s = NaN;
    for (const z of stopy.odsetki_podatkowe_do_2015) if (z.od <= data) s = z.stopa;
    return s;
  }
  let lomb = NaN;
  for (const z of stopy.zmiany) if (z.od <= data) lomb = z.lomb;
  return r2(Math.max(8, 2 * lomb + 2) * MNOZNIK[rodzaj]);
}

/** Dni, od których stawka mogła się zmienić. */
const ZMIANY = [...new Set([...stopy.odsetki_podatkowe_do_2015.map((z) => z.od), NOWE_PRZEPISY, ...stopy.zmiany.map((z) => z.od).filter((d) => d > NOWE_PRZEPISY)])]
  .sort().map(dzien);

/** Ostatni dzień terminu liczonego w miesiącach (art. 12 § 3), z przesunięciem z dnia wolnego (art. 12 § 5). */
export function plusMiesiace(od: string, n: number): string {
  const r = +od.slice(0, 4), m = +od.slice(5, 7) - 1 + n, d = +od.slice(8, 10);
  const rr = r + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  const ostatni = new Date(Date.UTC(rr, mm + 1, 0)).getUTCDate();
  return terminRoboczy(`${rr}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(d, ostatni)).padStart(2, '0')}`);
}

export interface Zaleglosc { kwota: number; termin: string }
export interface Wplata { data: string; kwota: number }
export interface OpcjePodatkowe {
  stawka?: StawkaPodatkowa;
  /** art. 12 § 5 – termin w sobotę / dzień wolny przesuwa się na najbliższy dzień roboczy */
  przesunTermin?: boolean;
  /** zaliczki na podatek dochodowy: odsetki najpóźniej do dnia złożenia zeznania (§ 4 ust. 1 pkt 7 rozporządzenia) */
  zeznanie?: string;
  wplaty?: Wplata[];
}
export interface OkresPodatkowy { od: string; do: string; dni: number; kwota: number; stawka: number; odsetki: number }
export interface WplataNaZaleglosc { data: string; kwota: number; naPodatek: number; naOdsetki: number }
export interface WynikZaleglosci {
  /** numer wiersza (od 1, w kolejności wpisania) */
  nr: number;
  kwota: number;
  termin: string;
  terminEfektywny: string;
  /** dni zwłoki do dnia zapłaty (lub złożenia zeznania) */
  dni: number;
  okresy: OkresPodatkowy[];
  wplaty: WplataNaZaleglosc[];
  /** odsetki pozostałe do zapłaty przed zaokrągleniem */
  odsetkiPrzedZaokr: number;
  /** odsetki do zapłaty po zaokrągleniu i progu */
  odsetki: number;
  podatek: number;
  ponizejProgu: boolean;
  /** dzień spłaty całości wpłatami częściowymi (wcześniej niż data zapłaty) */
  splaconaWplata?: string;
  blad?: string;
}
export interface WynikPodatkowy {
  pozycje: WynikZaleglosci[];
  podatek: number;
  odsetki: number;
  razem: number;
  wplacono: number;
  nadplata: number;
  uwagi: string[];
  blad?: string;
}

interface Stan { w: WynikZaleglosci; start: number; koniec: number; K: number; Z: number; dotad: number; wplacono: boolean }

/**
 * @param zaleglosci kwoty i terminy płatności
 * @param zaplata dzień zapłaty pozostałej kwoty (odsetki do tego dnia włącznie)
 */
export function obliczOdsetkiPodatkowe(zaleglosci: Zaleglosc[], zaplata: string, opcje: OpcjePodatkowe = {}): WynikPodatkowy {
  const { stawka = 'podstawowa', przesunTermin = true } = opcje;
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikPodatkowy => ({ pozycje: [], podatek: 0, odsetki: 0, razem: 0, wplacono: 0, nadplata: 0, uwagi, blad });
  if (!ISO.test(zaplata)) return pusty('Podaj datę zapłaty.');
  const zeznanie = opcje.zeznanie && ISO.test(opcje.zeznanie) ? opcje.zeznanie : undefined;
  const E = dzien(zaplata);
  const kres = zeznanie ? Math.min(E, dzien(zeznanie)) : E;

  const stany: Stan[] = [];
  zaleglosci.forEach((z, i) => {
    if (!(z.kwota > 0) || !ISO.test(z.termin)) return;
    const t = przesunTermin ? terminRoboczy(z.termin) : z.termin;
    if (t !== z.termin) uwagi.push(`Termin ${pl(z.termin)} przypadał w dzień wolny – przesunięto go na ${pl(t)} (art. 12 § 5 Ordynacji).`);
    const w: WynikZaleglosci = { nr: i + 1, kwota: r2(z.kwota), termin: z.termin, terminEfektywny: t, dni: 0, okresy: [], wplaty: [], odsetkiPrzedZaokr: 0, odsetki: 0, podatek: r2(z.kwota), ponizejProgu: false };
    const start = dzien(t) + 1;
    if (iso(start) < OD_KIEDY) w.blad = `Kalkulator zna stawki od ${pl(OD_KIEDY)}.`;
    else if (stawka !== 'podstawowa' && iso(start) < NOWE_PRZEPISY) w.blad = 'Stawkę obniżoną i podwyższoną kalkulator stosuje od 1.01.2016 r.';
    stany.push({ w, start, koniec: kres, K: w.kwota, Z: 0, dotad: start - 1, wplacono: false });
  });
  if (stany.length === 0) return pusty('Podaj kwotę i termin płatności zaległości.');
  if (stany.every((s) => s.w.blad)) return { ...pusty(stany[0].w.blad!), pozycje: stany.map((s) => s.w) };
  const aktywne = stany.filter((s) => !s.w.blad);

  // nalicz odsetki od s.dotad+1 do dnia d włącznie (z podziałem na okresy stawek)
  const nalicz = (s: Stan, d: number) => {
    const b = Math.min(d, s.koniec);
    if (b <= s.dotad || s.K <= 0) { s.dotad = Math.max(s.dotad, b); return; }
    const granice = [s.dotad + 1, ...ZMIANY.filter((g) => g > s.dotad + 1 && g <= b), b + 1];
    for (let i = 0; i < granice.length - 1; i++) {
      const a = granice[i], k = granice[i + 1] - 1, dni = k - a + 1;
      const st = stawkaPodatkowa(iso(a), stawka);
      const p = s.w.okresy.at(-1);
      if (p && p.stawka === st && p.kwota === s.K && dzien(p.do) === a - 1) {
        s.Z = r2(s.Z - p.odsetki);
        p.do = iso(k); p.dni += dni; p.odsetki = r2((s.K * p.dni * st) / 36500);
        s.Z = r2(s.Z + p.odsetki);
      } else {
        const ods = r2((s.K * dni * st) / 36500);
        s.w.okresy.push({ od: iso(a), do: iso(k), dni, kwota: s.K, stawka: st, odsetki: ods });
        s.Z = r2(s.Z + ods);
      }
    }
    s.dotad = b;
  };
  // odsetki do zapłaty przy spłacie całości: zaokrąglenie, a bez wcześniejszych wpłat także próg
  const koncowe = (s: Stan) => {
    const o = doZlotych(s.Z);
    return !s.wplacono && o <= PROG ? 0 : o;
  };

  // wpłaty częściowe – chronologicznie, na zaległość o najwcześniejszym terminie (art. 62 § 1)
  const kolejnosc = [...aktywne].sort((a, b) => a.start - b.start || a.w.nr - b.w.nr);
  const wplaty = (opcje.wplaty ?? []).filter((x) => ISO.test(x.data) && x.kwota > 0).sort((a, b) => a.data.localeCompare(b.data));
  if (wplaty.some((x) => dzien(x.data) > E)) uwagi.push('Wpłaty późniejsze niż data zapłaty pominięto.');
  let nadplata = 0, wplacono = 0;
  for (const x of wplaty) {
    const d = dzien(x.data);
    if (d > E) continue;
    wplacono = r2(wplacono + x.kwota);
    let W = r2(x.kwota);
    for (const s of kolejnosc) {
      if (W <= 0) break;
      if (s.K <= 0 && s.Z <= 0) continue;
      nalicz(s, d);
      const ods = koncowe(s);
      if (W >= r2(s.K + ods)) {
        s.w.wplaty.push({ data: x.data, kwota: r2(s.K + ods), naPodatek: s.K, naOdsetki: ods });
        W = r2(W - s.K - ods); s.K = 0; s.Z = 0; s.w.splaconaWplata = x.data;
      } else {
        const naPodatek = r2((W * s.K) / (s.K + s.Z)), naOdsetki = r2(W - naPodatek);
        s.w.wplaty.push({ data: x.data, kwota: W, naPodatek, naOdsetki });
        if (s.Z > 0) s.wplacono = true;
        s.K = r2(s.K - naPodatek); s.Z = r2(s.Z - naOdsetki); W = 0;
      }
    }
    nadplata = r2(nadplata + W);
  }

  for (const s of aktywne) {
    nalicz(s, E);
    const ostatni = Math.min(s.w.splaconaWplata ? dzien(s.w.splaconaWplata) : E, s.koniec);
    s.w.dni = Math.max(0, ostatni - s.start + 1);
    s.w.podatek = s.K;
    s.w.odsetkiPrzedZaokr = s.Z;
    s.w.odsetki = s.K > 0 || s.Z > 0 ? koncowe(s) : 0;
    s.w.ponizejProgu = s.Z > 0 && s.w.odsetki === 0;
    if (s.w.ponizejProgu) uwagi.push(`${stany.length > 1 ? `Zaległość ${s.w.nr}: o` : 'O'}dsetki (${r2(s.Z).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł) nie przekraczają ${PROG.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł – nie płacisz ich (art. 54 § 1 pkt 5 Ordynacji).`);
    else if (!s.wplacono && s.Z >= 8.5 && s.Z <= PROG) uwagi.push(`${stany.length > 1 ? `Zaległość ${s.w.nr}: o` : 'O'}dsetki przed zaokrągleniem nie przekraczają ${PROG.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł, ale po zaokrągleniu to 9 zł – bezpieczniej je zapłacić.`);
  }
  if (zeznanie && dzien(zeznanie) < E) uwagi.push(`Odsetki od zaliczek policzono do dnia złożenia zeznania (${pl(zeznanie)}). Niezapłacony podatek wynikający z zeznania to nowa zaległość od terminu płatności podatku rocznego.`);
  if (stawka === 'obnizona') uwagi.push('Stawka obniżona przysługuje tylko przy korekcie złożonej w ciągu 6 miesięcy od terminu deklaracji i zapłacie zaległości w ciągu 7 dni od korekty (art. 56a).');
  for (const s of stany) if (s.w.blad) uwagi.push(`${stany.length > 1 ? `Zaległość ${s.w.nr}: ` : ''}${s.w.blad}`);
  if (nadplata > 0) uwagi.push(`Wpłaty przekroczyły zaległości i odsetki o ${nadplata.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł (nadpłata).`);

  const pozycje = stany.map((s) => s.w);
  const podatek = r2(aktywne.reduce((a, s) => a + s.w.podatek, 0));
  const odsetki = aktywne.reduce((a, s) => a + s.w.odsetki, 0);
  return { pozycje, podatek, odsetki, razem: r2(podatek + odsetki), wplacono, nadplata, uwagi };
}

/** Uwagi do stawki obniżonej (art. 56a § 1): korekta do 6 miesięcy od terminu deklaracji, zapłata do 7 dni od korekty. */
export function sprawdzObnizona(terminDeklaracji: string, korekta: string, zaplata: string): string[] {
  if (!ISO.test(terminDeklaracji) || !ISO.test(korekta) || !ISO.test(zaplata)) return [];
  const u: string[] = [];
  const granica = plusMiesiace(terminDeklaracji, 6);
  if (korekta > granica) u.push(`Korekta złożona po ${pl(granica)} (6 miesięcy od terminu deklaracji) – stawka obniżona nie przysługuje.`);
  const doZaplaty = terminRoboczy(dodajDni(korekta, 7));
  if (zaplata > doZaplaty) u.push(`Zapłata po ${pl(doZaplaty)} (7 dni od korekty) – stawka obniżona nie przysługuje.`);
  return u;
}
