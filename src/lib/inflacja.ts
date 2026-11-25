// Inflacja (CPI, GUS) – poziom cen w miesiącu i średnio w roku, przeliczanie wartości pieniądza między datami,
// realna zmiana wynagrodzenia, inflacja w przyszłości, denominacja 1995 (10 000 starych zł = 1 zł).
// Miesięcznie: 1982–1986 łańcuch „poprzedni miesiąc = 100”, od 1987 „grudzień poprzedniego roku = 100” (jak w oficjalnych
// wskaźnikach grudzień/grudzień – bez kumulowania zaokrągleń z kolejnych miesięcy). Rocznie: łańcuch „rok poprzedni = 100”
// od 1950, zakotwiczony w średnim poziomie cen z miesięcy – dzięki temu oba tryby da się łączyć.
import dane from '../data/inflacja.json';

type Lista = (number | null)[];
const MM = dane.mm as Record<string, Lista>;
const GR = dane.gr as Record<string, Lista>;
const RR = dane.rr as Record<string, Lista>;
const ROCZNE = dane.roczne as Record<string, number>;
export const OSTATNI = dane.ostatni; // „2026-10”
export const OST_ROK = +OSTATNI.slice(0, 4);
export const OST_MIES = +OSTATNI.slice(5, 7);
export const PIERWSZY_ROK = Math.min(...Object.keys(ROCZNE).map(Number)) - 1; // 1949 = baza łańcucha rocznego
export const DENOMINACJA = 1995;
export const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

// poziomy miesięczne: grudzień 1981 = 100
const L = new Map<string, number>();
(() => {
  let lvl = 100;
  for (let y = 1982; y <= 1986; y++) for (let m = 0; m < 12; m++) { lvl *= (MM[y][m] as number) / 100; L.set(`${y}-${m + 1}`, lvl); }
  for (let y = 1987; y <= OST_ROK; y++) {
    const grudzien = L.get(`${y - 1}-12`)!;
    for (let m = 0; m < 12; m++) { const g = GR[y]?.[m]; if (g == null) break; L.set(`${y}-${m + 1}`, grudzien * g / 100); }
  }
})();
// poziomy roczne (średnie): kotwica = średnia z 12 miesięcy ostatniego pełnego roku, wcześniej łańcuch GUS
const OST_PELNY = OST_MIES === 12 ? OST_ROK : OST_ROK - 1;
const A = new Map<number, number>();
(() => {
  const sr = (y: number) => { let s = 0, n = 0; for (let m = 1; m <= 12; m++) { const v = L.get(`${y}-${m}`); if (v) { s += v; n++; } } return s / n; };
  A.set(OST_PELNY, sr(OST_PELNY));
  for (let y = OST_PELNY; y > PIERWSZY_ROK; y--) A.set(y - 1, A.get(y)! / (ROCZNE[y] / 100));
  if (OST_ROK > OST_PELNY) A.set(OST_ROK, sr(OST_ROK)); // bieżący rok – średnia z dostępnych miesięcy
})();

export interface Data { rok: number; mies?: number }
export const maMiesiac = (d: Data) => !!d.mies && d.rok >= 1982 && L.has(`${d.rok}-${d.mies}`);
export const dostepny = (d: Data) => (d.mies ? maMiesiac(d) : A.has(d.rok));

/** Poziom cen: miesięczny (gdy podano miesiąc i są dane), inaczej średni w roku. */
export function poziom(d: Data): number | null {
  if (d.mies && d.rok >= 1982) return L.get(`${d.rok}-${d.mies}`) ?? null;
  return A.get(d.rok) ?? null;
}
const czas = (d: Data) => d.rok + ((d.mies ?? 6.5) - 0.5) / 12; // średnia w roku ≈ połowa roku

export interface Przeliczenie { kwota: number; od: Data; do: Data; stareZlote?: boolean }

/** Ten sam miesiąc w różnych latach – łańcuch oficjalnych wskaźników r/r (zgodny z komunikatami GUS). */
function lancuchRr(od: Data, d: Data): number | null {
  if (!od.mies || od.mies !== d.mies || od.rok === d.rok) return null;
  const [x, y] = od.rok < d.rok ? [od, d] : [d, od];
  let f = 1;
  for (let r = x.rok + 1; r <= y.rok; r++) { const v = RR[r]?.[x.mies! - 1]; if (v == null) return null; f *= v / 100; }
  return od.rok < d.rok ? f : 1 / f;
}

export function przelicz(p: Przeliczenie) {
  const a = poziom(p.od), b = poziom(p.do);
  if (a == null || b == null) return null;
  const den = (d: Data) => (p.stareZlote !== false && d.rok < DENOMINACJA ? 10000 : 1);
  const wspolczynnik = lancuchRr(p.od, p.do) ?? b / a;
  const wartosc = (p.kwota / den(p.od)) * wspolczynnik * den(p.do);
  const lata = Math.abs(czas(p.do) - czas(p.od));
  const skumulowana = wspolczynnik - 1;
  const sredniorocznie = lata > 0 ? Math.pow(wspolczynnik, 1 / lata) - 1 : 0;
  const silaNabywcza = (p.kwota / den(p.do)) / wspolczynnik * den(p.od); // ile była warta dzisiejsza kwota wtedy
  const spadekSily = 1 - 1 / wspolczynnik;
  return { wartosc, wspolczynnik, skumulowana, sredniorocznie, lata, silaNabywcza, spadekSily, denominacja: den(p.od) !== den(p.do) };
}

/** Realna zmiana pensji (albo dowolnej kwoty) między dwiema datami. */
export function realnaZmiana(przed: number, po: number, od: Data, d: Data) {
  const a = poziom(od), b = poziom(d);
  if (a == null || b == null || przed <= 0) return null;
  const inflacja = (lancuchRr(od, d) ?? b / a) - 1;
  const nominalna = po / przed - 1;
  const realna = (1 + nominalna) / (1 + inflacja) - 1;
  return { inflacja, nominalna, realna, potrzebna: przed * (1 + inflacja), roznica: po - przed * (1 + inflacja) };
}

/** Siła nabywcza w przyszłości przy założonej inflacji. */
export function przyszlosc(kwota: number, lata: number, inflacja: number) {
  const f = Math.pow(1 + inflacja / 100, lata);
  return { realnie: kwota / f, potrzebna: kwota * f, spadek: 1 - 1 / f };
}

/** Inflacja średnioroczna (rok poprzedni = 100) – do tabel i wykresu. */
export const inflacjaRoczna = (rok: number): number | null => (ROCZNE[rok] ? ROCZNE[rok] - 100 : null);
/** Inflacja r/r w miesiącu. */
export const inflacjaRr = (rok: number, mies: number): number | null => { const v = RR[rok]?.[mies - 1]; return v == null ? null : v - 100; };
export const LATA_ROCZNE = Object.keys(ROCZNE).map(Number);
