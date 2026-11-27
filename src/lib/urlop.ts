// Wymiar urlopu wypoczynkowego (Kodeks pracy art. 153–155³, 158, 167², 168).
// Roczny wymiar: 20 dni (staż < 10 lat) albo 26 dni (≥ 10 lat), przy niepełnym etacie proporcjonalnie, niepełny dzień w górę (art. 154).
// Urlop proporcjonalny (art. 155¹, 155²a, 155³): kalendarzowy miesiąc pracy = 1/12 wymiaru, niepełny miesiąc w górę,
// niepełny dzień w górę, a gdy zmiana pracodawcy następuje w tym samym miesiącu – miesiąc zaokrągla stary pracodawca.
// Pierwsza praca (art. 153 § 1): w pierwszym roku 1/12 wymiaru z upływem każdego miesiąca pracy, bez zaokrągleń.
import { dodajDni } from './kalendarz';

export type Tryb = 'caly' | 'proporcjonalny' | 'pierwsza';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const wGore = (n: number) => Math.ceil(n - 1e-9);

export interface DaneUrlopu {
  rok: number;
  tryb: Tryb;
  /** staż urlopowy co najmniej 10 lat już na początku roku */
  dziesiecLat?: boolean;
  /** dzień, w którym staż urlopowy osiąga 10 lat (jeśli w tym roku) */
  dataDziesieciu?: string;
  etat?: number;
  /** zmiana etatu w trakcie roku: od dnia, nowy etat */
  zmianaEtatu?: { od: string; etat: number };
  /** początek i koniec zatrudnienia (tryb proporcjonalny i pierwsza praca) */
  od?: string;
  do?: string;
  /** poprzednia praca skończyła się w tym samym miesiącu, w którym zaczyna się nowa (art. 155²a § 3) */
  tenSamMiesiac?: boolean;
  /** godzin w dniu urlopu: 8, a przy niższej normie (np. niepełnosprawni) – ta norma */
  norma?: number;
  zalegly?: number;
  wykorzystany?: number;
}
export interface Etap { od: string; do: string; miesiace: number; etat: number; roczny: number; dni: number }
export interface Narastanie { po: string; dni: number; godziny: number }
export interface WynikUrlopu {
  baza: 20 | 26;
  /** roczny wymiar przy danym etacie */
  roczny: number;
  dni: number;
  godziny: number;
  etapy: Etap[];
  narastanie: Narastanie[];
  pozostalo: number;
  ograniczono: boolean;
  uwagi: string[];
  blad?: string;
}

const dniWMiesiacu = (r: number, m: number) => new Date(Date.UTC(r, m, 0)).getUTCDate();
const pl = (d: string) => d.split('-').reverse().join('.');
const mies = (d: string) => +d.slice(0, 4) * 12 + +d.slice(5, 7) - 1;
const isoMies = (m: number, dzien: 'pierwszy' | 'ostatni') => {
  const r = Math.floor(m / 12), mm = (m % 12) + 1;
  return `${r}-${String(mm).padStart(2, '0')}-${dzien === 'pierwszy' ? '01' : String(dniWMiesiacu(r, mm)).padStart(2, '0')}`;
};
/** Roczny wymiar przy etacie (art. 154 § 2 – niepełny dzień w górę). */
export const rocznyWymiar = (baza: number, etat: number) => wGore(baza * etat);
/** Dodaj n miesięcy (koniec miesiąca przycinany). */
function plusMiesiace(d: string, n: number): string {
  const m = mies(d) + n, r = Math.floor(m / 12), mm = (m % 12) + 1;
  return `${r}-${String(mm).padStart(2, '0')}-${String(Math.min(+d.slice(8, 10), dniWMiesiacu(r, mm))).padStart(2, '0')}`;
}

export function obliczUrlop(d: DaneUrlopu): WynikUrlopu {
  const uwagi: string[] = [];
  const norma = d.norma && d.norma > 0 ? d.norma : 8;
  const etat = d.etat && d.etat > 0 && d.etat <= 1 ? d.etat : 1;
  const pocz = `${d.rok}-01-01`, kon = `${d.rok}-12-31`;
  const od = d.tryb !== 'caly' && d.od && ISO.test(d.od) && d.od > pocz ? d.od : pocz;
  const doD = d.tryb !== 'caly' && d.do && ISO.test(d.do) && d.do < kon ? d.do : kon;
  const pusty = (blad: string): WynikUrlopu => ({ baza: 20, roczny: 0, dni: 0, godziny: 0, etapy: [], narastanie: [], pozostalo: 0, ograniczono: false, uwagi, blad });
  if (d.tryb === 'pierwsza' && !(d.od && ISO.test(d.od))) return pusty('Podaj datę rozpoczęcia pierwszej pracy.');
  if (d.tryb !== 'caly' && d.od && ISO.test(d.od) && d.od > kon) return pusty(`Zatrudnienie zaczyna się po ${d.rok} r.`);
  if (d.tryb !== 'caly' && d.do && ISO.test(d.do) && d.do < pocz) return pusty(`Zatrudnienie skończyło się przed ${d.rok} r.`);
  if (doD < od) return pusty('Data zakończenia jest wcześniejsza niż data rozpoczęcia.');

  // 20 czy 26 dni: 10 lat osiągnięte przed końcem zatrudnienia w roku → 26 dni za cały rok
  let baza: 20 | 26 = d.dziesiecLat ? 26 : 20;
  if (!d.dziesiecLat && d.dataDziesieciu && ISO.test(d.dataDziesieciu) && d.dataDziesieciu <= doD) {
    if (d.dataDziesieciu < pocz) baza = 26;
    else if (d.dataDziesieciu <= kon) {
      baza = 26;
      uwagi.push(`Od ${pl(d.dataDziesieciu)} masz 10 lat stażu – w tym roku przysługuje wymiar 26 dni. Jeśli urlop w niższym wymiarze jest już wykorzystany, dostaniesz urlop uzupełniający (art. 158 KP).`);
    }
  }

  const etapy: Etap[] = [];
  const narastanie: Narastanie[] = [];
  let dni = 0, roczny = rocznyWymiar(baza, etat);

  if (d.tryb === 'pierwsza') {
    // art. 153 § 1: z upływem każdego miesiąca pracy (licząc od dnia rozpoczęcia) 1/12 rocznego wymiaru, bez zaokrągleń
    const start = d.od!;
    if (start < pocz) return pusty(`Pierwsza praca zaczęła się przed ${d.rok} r. – w tym roku przysługuje pełny wymiar. Wybierz „Cały rok” albo „Zmiana pracy w trakcie roku”.`);
    for (let n = 1; n <= 12; n++) {
      const koniecMiesiaca = dodajDni(plusMiesiace(start, n), -1);
      if (koniecMiesiaca > doD) break;
      narastanie.push({ po: koniecMiesiaca, dni: r2((roczny * n) / 12), godziny: r2((roczny * n * norma) / 12) });
    }
    dni = narastanie.at(-1)?.dni ?? 0;
    etapy.push({ od: start, do: doD, miesiace: narastanie.length, etat, roczny, dni });
    uwagi.push('W pierwszym roku pracy urlop nabywasz z dołu – po każdym przepracowanym miesiącu 1/12 wymiaru, bez zaokrąglania w górę. Ułamek dnia możesz wykorzystać w godzinach.');
    uwagi.push(`Od 1 stycznia ${d.rok + 1} r. nabędziesz pełny roczny wymiar (${roczny} dni) z góry.`);
  } else {
    // miesiące pracy w roku; niepełny miesiąc w górę, chyba że miesiąc początkowy zaokrągla poprzedni pracodawca
    let m0 = mies(od);
    const m1 = mies(doD);
    if (d.tryb === 'proporcjonalny' && d.tenSamMiesiac && od.slice(8) !== '01') m0 += 1;
    const okresy: { m0: number; m1: number; etat: number }[] = [];
    const z = d.zmianaEtatu;
    if (z && ISO.test(z.od) && z.etat > 0 && z.etat <= 1 && z.od > od && z.od <= doD && z.etat !== etat) {
      // miesiąc zmiany – do okresu, w którym przepracowano w nim więcej dni (remis: wyższy etat)
      const mz = mies(z.od), dz = +z.od.slice(8, 10), wMies = dniWMiesiacu(+z.od.slice(0, 4), +z.od.slice(5, 7));
      const przed = dz - 1, po = wMies - dz + 1;
      const doNowego = po > przed || (po === przed && z.etat > etat);
      const granica = doNowego ? mz : mz + 1;
      if (granica - 1 >= m0) okresy.push({ m0, m1: Math.min(granica - 1, m1), etat });
      if (m1 >= Math.max(granica, m0)) okresy.push({ m0: Math.max(granica, m0), m1, etat: z.etat });
      uwagi.push(`Przy zmianie etatu urlop liczymy osobno dla każdego okresu i zaokrąglamy w górę; miesiąc zmiany (${pl(isoMies(mz, 'pierwszy')).slice(3)}) przypisaliśmy do etatu ${doNowego ? 'nowego' : 'poprzedniego'}, bo przepracowano w nim więcej dni.`);
    } else okresy.push({ m0, m1, etat });

    for (const o of okresy) {
      const miesiace = Math.max(0, o.m1 - o.m0 + 1);
      const r = rocznyWymiar(baza, o.etat);
      const x = miesiace === 12 ? r : wGore((r * miesiace) / 12);
      etapy.push({ od: o.m0 === mies(od) ? od : isoMies(o.m0, 'pierwszy'), do: o.m1 === mies(doD) ? doD : isoMies(o.m1, 'ostatni'), miesiace, etat: o.etat, roczny: r, dni: x });
      dni += x;
    }
    if (okresy.length > 1) roczny = Math.max(...okresy.map((o) => rocznyWymiar(baza, o.etat)));
    if (d.tryb === 'proporcjonalny' && d.tenSamMiesiac && od.slice(8) !== '01')
      uwagi.push(`Miesiąc rozpoczęcia pracy (${pl(od).slice(3)}) zaokrągla w górę poprzedni pracodawca – u nowego liczymy od następnego miesiąca (art. 155²a § 3 KP).`);
  }

  const ograniczono = dni > baza;
  if (ograniczono) { dni = baza; uwagi.push(`Wymiar w roku nie może przekroczyć ${baza} dni (art. 155³ § 2 KP).`); }
  const zalegly = Math.max(0, d.zalegly ?? 0), wykorzystany = Math.max(0, d.wykorzystany ?? 0);
  if (zalegly > 0) uwagi.push(`Zaległy urlop z ${d.rok - 1} r. trzeba wykorzystać do 30 września ${d.rok} r. (art. 168 KP).`);
  const godziny = d.tryb === 'pierwsza' ? narastanie.at(-1)?.godziny ?? 0 : r2(dni * norma);
  return { baza, roczny, dni, godziny, etapy, narastanie, pozostalo: r2(dni + zalegly - wykorzystany), ograniczono, uwagi };
}
