// Staż pracy: sumowanie okresów zatrudnienia (Kodeks pracy art. 154¹, 155, 302¹).
// Każdy okres liczony kalendarzowo od pierwszego do ostatniego dnia włącznie (lata, miesiące, dni), składniki sumowane,
// a nadwyżka dni przeliczana: 30 dni = 1 miesiąc, 12 miesięcy = 1 rok (art. 114 KC w zw. z art. 300 KP – praktyka kadrowa).
// Nakładające się okresy liczy się raz (art. 154¹ § 2, art. 302¹ § 10). Od 2026 r. do stażu wlicza się też zlecenia,
// działalność gospodarczą i pracę za granicą (art. 302¹, Dz.U. 2025 poz. 1423).
import { dodajDni } from './kalendarz';

export type RodzajOkresu = 'uop' | 'zlecenie' | 'jdg' | 'inne';
export const RODZAJE: Record<RodzajOkresu, string> = {
  uop: 'Umowa o pracę',
  zlecenie: 'Zlecenie / agencyjna',
  jdg: 'Działalność gospodarcza',
  inne: 'Inne (np. praca za granicą)',
};

/** Okresy nauki wliczane do stażu urlopowego (art. 155 § 1 KP) – w latach. */
export const NAUKA = {
  brak: { lata: 0, nazwa: 'Bez szkoły ponadpodstawowej' },
  zasadnicza2: { lata: 2, nazwa: 'Zasadnicza zawodowa 2-letnia' },
  zasadnicza3: { lata: 3, nazwa: 'Zasadnicza / branżowa I stopnia (3 lata)' },
  liceum: { lata: 4, nazwa: 'Liceum ogólnokształcące' },
  technikum4: { lata: 4, nazwa: 'Technikum 4-letnie' },
  technikum5: { lata: 5, nazwa: 'Technikum 5-letnie' },
  srednia_po_zasadniczej: { lata: 5, nazwa: 'Średnia zawodowa po zasadniczej' },
  policealna: { lata: 6, nazwa: 'Szkoła policealna' },
  wyzsza: { lata: 8, nazwa: 'Studia wyższe' },
} as const;
export type Nauka = keyof typeof NAUKA;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dni = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);
const dniWMiesiacu = (r: number, m: number) => new Date(Date.UTC(r, m, 0)).getUTCDate(); // m: 1–12

export interface LMD { lata: number; miesiace: number; dni: number }
export const zero = (): LMD => ({ lata: 0, miesiace: 0, dni: 0 });

/** Przeniesienie: 30 dni = miesiąc, 12 miesięcy = rok. */
export function normalizuj(x: LMD): LMD {
  const d = x.dni % 30, mm = x.miesiace + Math.floor(x.dni / 30);
  return { lata: x.lata + Math.floor(mm / 12), miesiace: mm % 12, dni: d };
}
export const dodaj = (a: LMD, b: LMD): LMD => normalizuj({ lata: a.lata + b.lata, miesiace: a.miesiace + b.miesiace, dni: a.dni + b.dni });
/** Do porównań (leksykograficznie: lata, miesiące, dni). */
export const klucz = (x: LMD) => x.lata * 10_000 + x.miesiace * 100 + x.dni;

/** Długość okresu od–do włącznie w latach, miesiącach i dniach kalendarzowych. */
export function roznica(od: string, doDnia: string): LMD {
  const k = dodajDni(doDnia, 1); // dzień po końcu – okres półotwarty
  let M = (+k.slice(0, 4) - +od.slice(0, 4)) * 12 + (+k.slice(5, 7) - +od.slice(5, 7));
  if (+k.slice(8, 10) < +od.slice(8, 10)) M -= 1;
  // pełne miesiące od początku okresu (dzień przycięty do końca krótszego miesiąca), reszta w dniach
  const m0 = +od.slice(5, 7) - 1 + M, r = +od.slice(0, 4) + Math.floor(m0 / 12), m = (m0 % 12) + 1;
  const kotwica = `${r}-${String(m).padStart(2, '0')}-${String(Math.min(+od.slice(8, 10), dniWMiesiacu(r, m))).padStart(2, '0')}`;
  return { lata: Math.floor(M / 12), miesiace: M % 12, dni: dni(k) - dni(kotwica) };
}

export interface Okres { od: string; do?: string; rodzaj?: RodzajOkresu }
export interface Przedzial { od: string; do: string }

/** Okresy przycięte do dnia obliczenia i scalone, gdy się nakładają (stykające się zostają osobno). */
export function scal(okresy: Okres[], naDzien: string): Przedzial[] {
  const p = okresy
    .filter((o) => ISO.test(o.od) && o.od <= naDzien)
    .map((o) => ({ od: o.od, do: o.do && ISO.test(o.do) && o.do < naDzien ? o.do : naDzien }))
    .filter((o) => o.do >= o.od)
    .sort((a, b) => a.od.localeCompare(b.od));
  const w: Przedzial[] = [];
  for (const o of p) {
    const ost = w.at(-1);
    if (ost && o.od <= ost.do) { if (o.do > ost.do) ost.do = o.do; }
    else w.push({ ...o });
  }
  return w;
}

/** Jeden okres – kalendarzowo (bez przeliczania 30 dni); kilka – suma z przeliczeniem 30 dni = miesiąc. */
export function sumuj(przedzialy: Przedzial[]): LMD {
  if (przedzialy.length === 1) return roznica(przedzialy[0].od, przedzialy[0].do);
  return przedzialy.reduce((s, p) => dodaj(s, roznica(p.od, p.do)), zero());
}
export const dniKalendarzowe = (przedzialy: Przedzial[]) => przedzialy.reduce((s, p) => s + dni(p.do) - dni(p.od) + 1, 0);

const PROG_26 = klucz({ lata: 10, miesiace: 0, dni: 0 });

/** Art. 155: lata szkoły + praca po jej ukończeniu albo cała praca – co korzystniejsze. */
function stazUrlopowy(scalone: Przedzial[], naukaLata: number, koniecNauki?: string): { urlopowy: LMD; naukaPominieta: boolean } {
  const laczny = sumuj(scalone);
  if (naukaLata === 0) return { urlopowy: laczny, naukaPominieta: false };
  let praca = laczny;
  if (koniecNauki && ISO.test(koniecNauki)) {
    const po = dodajDni(koniecNauki, 1);
    praca = sumuj(scalone.filter((p) => p.do >= po).map((p) => ({ od: p.od < po ? po : p.od, do: p.do })));
  }
  const zNauka = { ...praca, lata: praca.lata + naukaLata };
  return klucz(zNauka) >= klucz(laczny) ? { urlopowy: zNauka, naukaPominieta: false } : { urlopowy: laczny, naukaPominieta: true };
}

export interface WynikStazu {
  naDzien: string;
  /** wszystkie okresy (zasady od 2026 r.) */
  laczny: LMD;
  dniLaczny: number;
  /** tylko umowy o pracę (zasady sprzed 2026 r.) */
  tylkoUop: LMD;
  maInneOkresy: boolean;
  scalone: Przedzial[];
  nakladanie: boolean;
  /** staż do urlopu: okresy pracy + nauka (wariant korzystniejszy) */
  urlopowy: LMD;
  naukaLata: number;
  /** true, gdy korzystniejsze okazało się liczenie pracy w czasie nauki zamiast lat szkoły */
  naukaPominieta: boolean;
  wymiarUrlopu: 20 | 26;
  /** ile brakuje do 10 lat stażu urlopowego */
  doProgu?: LMD;
  /** dzień, w którym staż urlopowy osiągnie 10 lat (gdy ostatni okres trwa) */
  dataProgu?: string;
  blad?: string;
}

/**
 * @param naDzien dzień obliczenia (okresy bez daty końca liczone do tego dnia włącznie)
 * @param koniecNauki data ukończenia szkoły – praca przed nią: wariant korzystniejszy (art. 155 § 2)
 */
export function obliczStaz(okresy: Okres[], naDzien: string, nauka: Nauka = 'brak', koniecNauki?: string): WynikStazu {
  const pusty = (blad: string): WynikStazu => ({
    naDzien, laczny: zero(), dniLaczny: 0, tylkoUop: zero(), maInneOkresy: false, scalone: [], nakladanie: false,
    urlopowy: zero(), naukaLata: 0, naukaPominieta: false, wymiarUrlopu: 20, blad,
  });
  if (!ISO.test(naDzien)) return pusty('Podaj dzień obliczenia.');
  const poprawne = okresy.filter((o) => ISO.test(o.od) && o.od <= naDzien && (!o.do || !ISO.test(o.do) || o.do >= o.od));
  if (poprawne.length === 0) return pusty(okresy.some((o) => ISO.test(o.od) && o.od > naDzien) ? 'Okres zaczyna się po dniu obliczenia.' : 'Podaj datę rozpoczęcia co najmniej jednego okresu.');

  const scalone = scal(poprawne, naDzien);
  const laczny = sumuj(scalone);
  const nakladanie = scalone.length < poprawne.length;
  const tylkoUop = sumuj(scal(poprawne.filter((o) => (o.rodzaj ?? 'uop') === 'uop'), naDzien));
  const maInneOkresy = poprawne.some((o) => (o.rodzaj ?? 'uop') !== 'uop');
  const naukaLata = NAUKA[nauka].lata;
  const { urlopowy, naukaPominieta } = stazUrlopowy(scalone, naukaLata, koniecNauki);

  const wynik: WynikStazu = {
    naDzien, laczny, dniLaczny: dniKalendarzowe(scalone), tylkoUop, maInneOkresy, scalone, nakladanie,
    urlopowy, naukaLata, naukaPominieta, wymiarUrlopu: klucz(urlopowy) >= PROG_26 ? 26 : 20,
  };
  if (wynik.wymiarUrlopu === 20) {
    // 10 lat minus staż (miesiąc = 30 dni); co najmniej 1 dzień
    const brak = Math.max(1, 3600 - (urlopowy.lata * 360 + urlopowy.miesiace * 30 + urlopowy.dni));
    wynik.doProgu = { lata: Math.floor(brak / 360), miesiace: Math.floor((brak % 360) / 30), dni: brak % 30 };
    // gdy okres trwa: najwcześniejszy dzień, w którym staż urlopowy osiągnie 10 lat (wyszukiwanie binarne)
    const trwa = poprawne.some((o) => !o.do || !ISO.test(o.do) || o.do > naDzien);
    if (trwa) {
      const na = (d: string) => klucz(stazUrlopowy(scal(poprawne, d), naukaLata, koniecNauki).urlopowy) >= PROG_26;
      let lo = 1, hi = 3700;
      if (na(dodajDni(naDzien, hi))) {
        while (lo < hi) { const m = (lo + hi) >> 1; if (na(dodajDni(naDzien, m))) hi = m; else lo = m + 1; }
        wynik.dataProgu = dodajDni(naDzien, lo);
      }
    }
  }
  return wynik;
}

export const opisLMD = (x: LMD) => {
  const odm = (n: number, f: [string, string, string]) => `${n} ${n === 1 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? f[1] : f[2]}`;
  return `${odm(x.lata, ['rok', 'lata', 'lat'])}, ${odm(x.miesiace, ['miesiąc', 'miesiące', 'miesięcy'])}, ${odm(x.dni, ['dzień', 'dni', 'dni'])}`;
};
