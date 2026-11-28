// Zdolność kredytowa (kredyt hipoteczny) według zasad Rekomendacji S KNF (nowelizacja z czerwca 2023, uchwała KNF 242/2023):
// – bufor stopy przy zmiennym oprocentowaniu: MAX(5 pp − stopa referencyjna NBP; 2,5 pp) + σ, gdzie σ = 1,5 pp, gdy odchylenie
//   standardowe stopy z ostatnich 100 dni roboczych ≥ 0,5 pp i ostatnia stopa jest wyższa niż średnia; inaczej 0;
// – przy okresowo stałej stopie: Bx = 2,5 pp × (T − x) / (T − 60), T – okres kredytu, x – okres stałej stopy (miesiące, x ≥ 60);
// – DStI: szczególna ostrożność powyżej 40% (dochód do przeciętnego wynagrodzenia w regionie) i 50% (pozostali), pkt 9.3;
// – okres spłaty: rekomendowany do 25 lat, nie dłużej niż 35 (rekomendacja 7); LtV do 80%, 90% z dodatkowym zabezpieczeniem (15.5).
// Koszty utrzymania i sposób liczenia dochodu każdy bank ustala sam – kalkulator przyjmuje ostrożne, edytowalne założenia.
import stopy from '../data/stopy-nbp.json';
import stawki from '../data/stawki.json';
import { rataRowna } from './hipoteczny';
import { obliczMiesiac } from './wynagrodzenie';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Stopa referencyjna NBP w dniu (ostatnia zmiana nie późniejsza niż data). */
export function stopaRef(data: string): number {
  const z = (stopy.zmiany as { od: string; ref: number }[]).filter((x) => x.od <= data);
  return z.length ? z[z.length - 1].ref : 3.75;
}

/** Dni robocze (pn–pt) przed datą. */
function dniRobocze(data: string, n: number): string[] {
  const d = new Date(data + 'T12:00:00Z');
  const out: string[] = [];
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Bufor dla stopy zmiennej według wzoru KNF na dany dzień. */
export function buforZmienna(data: string): { bufor: number; ref: number; sigma: number } {
  const ref = stopaRef(data);
  const hist = dniRobocze(data, 100).map(stopaRef);
  const sr = hist.reduce((a, b) => a + b, 0) / hist.length;
  const odch = Math.sqrt(hist.reduce((a, b) => a + (b - sr) ** 2, 0) / hist.length);
  const sigma = odch >= 0.5 && ref > sr ? 1.5 : 0;
  return { bufor: Math.max(5 - ref, 2.5) + sigma, ref, sigma };
}

/** Bufor dla okresowo stałej stopy: 2,5 pp × (T − x)/(T − 60). */
export const buforStala = (miesiace: number, stalaMiesiecy: number) =>
  miesiace <= 60 ? 0 : Math.max(0, 2.5 * (miesiace - Math.max(60, stalaMiesiecy)) / (miesiace - 60));

/** Przeciętne wynagrodzenie netto (z IV kw. poprzedniego roku – przeciętne w sektorze przedsiębiorstw) – próg DStI 40/50%. */
export function przecietneNetto(rok: number): number {
  type R = { zdrowotna_ryczalt_podstawa?: { wartosc: number | null } };
  const lata = stawki.lata as Record<string, R>;
  const brutto = lata[String(rok)]?.zdrowotna_ryczalt_podstawa?.wartosc ?? lata[String(rok - 1)]?.zdrowotna_ryczalt_podstawa?.wartosc ?? 9228.64;
  return obliczMiesiac({ rok: Math.min(rok, 2026), brutto, pit2: 300 }).netto;
}

export interface DaneZdolnosci {
  /** łączny dochód netto gospodarstwa miesięcznie */
  dochod: number;
  /** liczba kredytobiorców (dorosłych z dochodem) */
  kredytobiorcy: number;
  /** liczba osób w gospodarstwie (z dziećmi) */
  osoby: number;
  /** raty innych kredytów miesięcznie */
  raty?: number;
  /** limity kart kredytowych i debetów – bank liczy ok. 3% limitu miesięcznie */
  limity?: number;
  lata: number;
  oprocentowanie: number;
  typ: 'zmienne' | 'stale';
  /** okres stałej stopy w latach */
  okresStaly?: number;
  /** koszty utrzymania: pierwsza osoba i każda kolejna */
  kosztPierwszej?: number;
  kosztKolejnej?: number;
  /** data – do bufora (stopa NBP) */
  data: string;
  rok: number;
  /** wymuszony limit DStI (np. 0,6) – do porównania z liberalniejszymi bankami */
  limitDsti?: number;
}

export interface WynikZdolnosci {
  kwota: number;
  /** maksymalna rata, jaką bank uzna */
  rataMax: number;
  /** rata faktyczna przy maksymalnej kwocie (bez bufora) */
  rata: number;
  bufor: number;
  stopaTestowa: number;
  dsti: number;
  /** co ogranicza: limit DStI albo koszty utrzymania */
  ogranicza: 'dsti' | 'koszty';
  kosztyUtrzymania: number;
  zobowiazania: number;
  /** cena nieruchomości przy wkładzie 20% i 10% */
  cena20: number;
  cena10: number;
  przecietne: number;
}

export function obliczZdolnosc(x: DaneZdolnosci): WynikZdolnosci {
  const n = Math.round(Math.min(35, Math.max(1, x.lata)) * 12);
  const przecietne = przecietneNetto(x.rok);
  const naOsobe = x.dochod / Math.max(1, x.kredytobiorcy);
  const dsti = x.limitDsti ?? (naOsobe <= przecietne ? 0.4 : 0.5);
  const kosztyUtrzymania = (x.kosztPierwszej ?? 1500) + Math.max(0, x.osoby - 1) * (x.kosztKolejnej ?? 1000);
  const zobowiazania = r2((x.raty ?? 0) + (x.limity ?? 0) * 0.03);
  const zDsti = x.dochod * dsti - zobowiazania;
  const zKosztow = x.dochod - kosztyUtrzymania - zobowiazania;
  const rataMax = Math.max(0, Math.min(zDsti, zKosztow));
  const bufor = x.typ === 'zmienne' ? buforZmienna(x.data).bufor : buforStala(n, Math.round((x.okresStaly ?? 5) * 12));
  const stopaTestowa = x.oprocentowanie + bufor;
  // największa kwota, której rata przy stopie testowej mieści się w limicie
  const naZl = rataRowna(1, stopaTestowa / 100 / 12, n);
  const kwota = rataMax > 0 ? Math.floor(rataMax / naZl / 1000) * 1000 : 0;
  return {
    kwota, rataMax: r2(rataMax), rata: r2(rataRowna(kwota, x.oprocentowanie / 100 / 12, n)), bufor: Math.round(bufor * 100) / 100, stopaTestowa: Math.round(stopaTestowa * 100) / 100,
    dsti, ogranicza: zDsti <= zKosztow ? 'dsti' : 'koszty', kosztyUtrzymania, zobowiazania,
    cena20: Math.floor(kwota / 0.8 / 1000) * 1000, cena10: Math.floor(kwota / 0.9 / 1000) * 1000, przecietne: r2(przecietne),
  };
}

/** Dochód netto potrzebny, żeby dostać kredyt na daną kwotę. */
export function potrzebnyDochod(kwota: number, x: Omit<DaneZdolnosci, 'dochod'>): number {
  let lo = 0, hi = 200000;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (obliczZdolnosc({ ...x, dochod: m }).kwota >= kwota) hi = m; else lo = m; }
  return Math.ceil(hi / 10) * 10;
}
