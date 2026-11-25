// Lokata – odsetki, podatek Belki (art. 30a ust. 1 pkt 3 PIT, zaokrąglenie w górę – art. 63 § 1a Ordynacji),
// kapitalizacja w trakcie, odnawianie, lokata rentierska, OKI od 2027 r. (Dz.U. 2026 poz. 1098), realny zysk po inflacji.
import dane from '../data/lokaty.json';
import { dodajDni } from './kalendarz';
import { r2 } from './format';

export type Jednostka = 'dni' | 'miesiace' | 'lata';
export type Kapitalizacja = 'koniec' | 'dzienna' | 'miesieczna' | 'kwartalna' | 'roczna' | 'wyplata';
export type Opodatkowanie = 'belka' | 'oki' | 'brak' | 'firma';
export type Baza = 'miesiace' | '365' | '360';

export const BELKA = dane.belka / 100;
export const OKI = dane.oki;
export const INFLACJA = dane.inflacja;
export const PROG_BFG = r2(dane.bfg.euro * dane.bfg.kurs);

export const KAPITALIZACJE: [Kapitalizacja, string][] = [
  ['koniec', 'na koniec lokaty'],
  ['dzienna', 'dzienna'],
  ['miesieczna', 'miesięczna'],
  ['kwartalna', 'kwartalna'],
  ['roczna', 'roczna'],
  ['wyplata', 'odsetki wypłacane co miesiąc (rentierska)'],
];

/** podatek od odsetek: podstawa i podatek do pełnych groszy w górę */
export const podatekBelki = (odsetki: number) => (odsetki <= 0 ? 0 : Math.ceil(r2(odsetki) * BELKA * 100 - 1e-7) / 100);

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function plusMiesiecy(od: string, n: number): string {
  const r = +od.slice(0, 4), m = +od.slice(5, 7) - 1 + n, d = +od.slice(8, 10);
  const rr = r + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  const ostatni = new Date(Date.UTC(rr, mm + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(rr, mm, Math.min(d, ostatni))));
}
export const dniMiedzy = (od: string, d: string) => Math.round((Date.parse(d) - Date.parse(od)) / 864e5);

export interface DaneLokaty {
  kwota: number;
  /** oprocentowanie roczne, % */
  stopa: number;
  okres: number;
  jednostka: Jednostka;
  kapitalizacja?: Kapitalizacja;
  /** jak liczyć część roku: miesiące/12 albo dni/365 (360) */
  baza?: Baza;
  /** data założenia (ISO) – do liczenia dni przy okresie w miesiącach */
  start?: string;
  /** ile razy odnowić lokatę na tych samych warunkach */
  odnowienia?: number;
  podatek?: Opodatkowanie;
  /** inflacja roczna, % */
  inflacja?: number;
}

export interface Okres { nr: number; od?: string; do?: string; odsetki: number; podatek: number; saldo: number; wyplacone: number }

/** Ułamek roku i liczba dni jednej lokaty. */
function dlugosc(d: DaneLokaty, start: string) {
  const baza = d.baza ?? 'miesiace';
  const miesiace = d.jednostka === 'lata' ? d.okres * 12 : d.jednostka === 'miesiace' ? d.okres : null;
  const koniec = miesiace !== null ? plusMiesiecy(start, miesiace) : dodajDni(start, Math.round(d.okres));
  const dni = dniMiedzy(start, koniec);
  const rokDni = baza === '360' ? 360 : 365;
  const ulamek = miesiace !== null && baza === 'miesiace' ? miesiace / 12 : dni / rokDni;
  return { ulamek, dni, koniec, rokDni };
}

const KROK: Record<Exclude<Kapitalizacja, 'koniec'>, number> = { dzienna: 0, miesieczna: 1 / 12, kwartalna: 1 / 4, roczna: 1, wyplata: 1 / 12 };

export function obliczLokate(d: DaneLokaty) {
  const kap = d.kapitalizacja ?? 'koniec';
  const pod = d.podatek ?? 'belka';
  const r = d.stopa / 100;
  const start = d.start && /^\d{4}-\d{2}-\d{2}$/.test(d.start) ? d.start : iso(new Date());
  const lokat = 1 + Math.max(0, Math.round(d.odnowienia ?? 0));
  const okresy: Okres[] = [];
  let saldo = r2(d.kwota);
  let odsetki = 0, podatek = 0, wyplacone = 0, sumaUlamkow = 0, sumaDni = 0, saldoRazyCzas = 0;
  let od = start;

  for (let i = 1; i <= lokat; i++) {
    const { ulamek, dni, koniec, rokDni } = dlugosc(d, od);
    // podział lokaty na okresy kapitalizacji (ostatni może być niepełny)
    const krok = kap === 'koniec' ? ulamek : kap === 'dzienna' ? 1 / rokDni : KROK[kap];
    const pelne = Math.floor(ulamek / krok + 1e-9);
    const czesci = Array(pelne).fill(krok);
    const reszta = ulamek - pelne * krok;
    if (reszta > 1e-9) czesci.push(reszta);
    let oL = 0, pL = 0, wL = 0;
    for (const c of czesci) {
      const o = r2(saldo * r * c);
      const p = pod === 'belka' ? podatekBelki(o) : 0;
      saldoRazyCzas += saldo * c;
      oL += o; pL += p;
      if (kap === 'wyplata') wL += o - p; else saldo = r2(saldo + o - p);
    }
    odsetki += oL; podatek += pL; wyplacone += wL; sumaUlamkow += ulamek; sumaDni += dni;
    okresy.push({ nr: i, od, do: koniec, odsetki: r2(oL), podatek: r2(pL), saldo, wyplacone: r2(wL) });
    od = koniec;
  }
  odsetki = r2(odsetki); podatek = r2(podatek); wyplacone = r2(wyplacone);
  const netto = r2(odsetki - podatek);

  // OKI: zamiast podatku Belki podatek od średniej wartości ponad 25 000 zł (szacunek przy lokacie trzymanej na OKI)
  const sredniaWartosc = sumaUlamkow > 0 ? saldoRazyCzas / sumaUlamkow : d.kwota;
  const podatekOki = pod === 'oki' ? r2((Math.max(0, sredniaWartosc - OKI.limitOszczednosci) * OKI.stawka) / 100 * sumaUlamkow) : 0;
  const zysk = r2(netto - podatekOki);
  const koncowa = r2(d.kwota + zysk);

  const lata = sumaUlamkow;
  const stopaNetto = lata > 0 && d.kwota > 0 ? (Math.pow(koncowa / d.kwota, 1 / lata) - 1) * 100 : 0;
  const infl = (d.inflacja ?? 0) / 100;
  const wartoscRealna = r2(koncowa / Math.pow(1 + infl, lata));
  const zyskRealny = r2(wartoscRealna - d.kwota);
  const belkaGdyby = pod === 'belka' ? podatek : obliczLokate({ ...d, podatek: 'belka' }).podatek;

  const uwagi: string[] = [];
  if (koncowa > PROG_BFG) uwagi.push(`Gwarancja BFG obejmuje do 100 000 euro (ok. ${Math.round(PROG_BFG).toLocaleString('pl-PL')} zł) na osobę w jednym banku. Nadwyżkę warto ulokować w innym banku.`);
  if (pod === 'oki') uwagi.push(`OKI działa od 1 stycznia 2027 r. Zamiast podatku Belki płacisz ${String(OKI.stawka).replace('.', ',')}% rocznie od średniej wartości oszczędności ponad ${OKI.limitOszczednosci.toLocaleString('pl-PL')} zł – w zeznaniu do 31 maja następnego roku.`);
  if (pod === 'firma') uwagi.push('Odsetki od lokaty firmowej są przychodem z działalności (art. 14 ust. 2 pkt 5 ustawy o PIT) – bank nie pobiera podatku Belki, opodatkujesz je razem z innymi przychodami firmy.');
  if (kap === 'dzienna' && pod === 'belka') uwagi.push('Kapitalizacja dzienna nie pozwala ominąć podatku Belki – podatek zaokrągla się w górę do pełnego grosza, więc od każdej dziennej porcji odsetek pobierany jest co najmniej 1 grosz.');
  if (d.stopa > 0 && infl > 0 && zyskRealny < 0) uwagi.push('Przy tej inflacji lokata nie chroni siły nabywczej – po odjęciu podatku pieniądze realnie tracą na wartości.');

  return {
    kwota: r2(d.kwota), odsetki, podatek, netto, podatekOki, zysk, koncowa, wyplacone,
    dni: sumaDni, lata, koniec: od, stopaNetto, wartoscRealna, zyskRealny, belkaGdyby,
    okresy, lokat, uwagi,
  };
}
export type WynikLokaty = ReturnType<typeof obliczLokate>;

/** Ile wpłacić, żeby zysk netto (albo miesięczna wypłata przy lokacie rentierskiej) wyniósł cel. */
export function kwotaNaCel(cel: number, d: Omit<DaneLokaty, 'kwota'>): number {
  if (cel <= 0 || d.stopa <= 0) return 0;
  const miara = (k: number) => {
    const w = obliczLokate({ ...d, kwota: k });
    return d.kapitalizacja === 'wyplata' ? w.zysk / Math.max(1, Math.round(w.lata * 12)) : w.zysk;
  };
  let lo = 0, hi = 1000;
  while (miara(hi) < cel && hi < 1e12) hi *= 2;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (miara(m) >= cel) hi = m; else lo = m; }
  return Math.ceil(hi);
}
