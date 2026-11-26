// Wspólne rozliczenie małżonków (art. 6 ust. 2–3, 8 i art. 6a ustawy o PIT) i samotnego rodzica (art. 6 ust. 4c–4d):
// podatek = 2 × podatek według skali od połowy łącznych dochodów, po odliczeniu przez każdego z małżonków jego składek
// społecznych i ulg. Warunki: małżeństwo i wspólność majątkowa przez cały rok albo od ślubu do końca roku; wyklucza je
// podatek liniowy lub ryczałt (poza ryczałtem od najmu prywatnego) u choćby jednego z małżonków.
// Ulga na dzieci (art. 27f): 1112,04 zł rocznie na 1. i 2. dziecko, 2000,04 zł na 3., 2700 zł na 4. i kolejne; przy jednym
// dziecku limit dochodów (minus składki społeczne): 112 000 zł – małżonkowie przez cały rok łącznie i samotny rodzic,
// 56 000 zł – pozostali. Niewykorzystana ulga wraca do wysokości składek społecznych i zdrowotnej (ust. 8–9).
// Podstawa i podatek zaokrąglane do pełnych złotych (art. 63 § 1 Ordynacji).
import { pit, podatekSkala } from './ikze';

export interface Osoba {
  przychod: number;
  koszty?: number;
  /** składki społeczne odliczane od dochodu */
  spoleczne?: number;
  /** składka zdrowotna (tylko do limitu zwrotu ulgi na dzieci) */
  zdrowotna?: number;
  /** ulgi odliczane od dochodu: IKZE, internet, darowizny, rehabilitacyjna… */
  odliczenia?: number;
  /** zaliczki pobrane w roku (PIT-11, PIT-40A…) */
  zaliczki?: number;
}
export type Tryb = 'malzonkowie' | 'samotny';
export interface DaneWR {
  rok: number;
  tryb: Tryb;
  a: Osoba;
  b?: Osoba;
  dzieci?: number;
  slubWTrakcie?: boolean;
  rozdzielnosc?: boolean;
  liniowyRyczalt?: boolean;
}
export interface OsobaWynik { dochod: number; podstawa: number; podatek: number; zaliczki: number; limitZwrotu: number }
export interface Wariant { podatekPrzedUlga: number; ulgaOdliczona: number; ulgaZwrot: number; podatek: number; zaliczki: number; /** + zwrot, − dopłata */ saldo: number }
export interface WynikWR {
  mozna: boolean;
  powody: string[];
  osoby: OsobaWynik[];
  osobno: Wariant;
  razem: Wariant;
  oszczednosc: number;
  ulga: number;
  ulgaLimitPrzekroczony: boolean;
  niepewne: boolean;
  uwagi: string[];
}

const zl0 = (n: number) => Math.round(n);
const fmt = (n: number) => n.toLocaleString('pl-PL', { maximumFractionDigits: 0 });

export function kwotaUlgi(dzieci: number): number {
  let u = 0;
  for (let i = 1; i <= dzieci; i++) u += i <= 2 ? 1112.04 : i === 3 ? 2000.04 : 2700;
  return Math.round(u * 100) / 100;
}

function osoba(o: Osoba, rok: number): OsobaWynik {
  const p = pit(rok);
  const dochod = Math.max(0, Math.max(0, o.przychod - (o.koszty ?? 0)) - (o.spoleczne ?? 0));
  const podstawa = zl0(Math.max(0, dochod - (o.odliczenia ?? 0)));
  return { dochod, podstawa, podatek: zl0(podatekSkala(podstawa, p)), zaliczki: o.zaliczki ?? 0, limitZwrotu: (o.spoleczne ?? 0) + (o.zdrowotna ?? 0) };
}

/** Odliczenie ulgi od podatku i zwrot niewykorzystanej części (do limitu składek). */
function zUlga(podatek: number, ulga: number, limitZwrotu: number, zaliczki: number): Wariant {
  const odl = Math.min(ulga, podatek);
  const zwrot = Math.round(Math.min(ulga - odl, limitZwrotu) * 100) / 100;
  const po = Math.round((podatek - odl) * 100) / 100;
  return { podatekPrzedUlga: podatek, ulgaOdliczona: odl, ulgaZwrot: zwrot, podatek: po, zaliczki, saldo: Math.round((zaliczki - po + zwrot) * 100) / 100 };
}

export function obliczWspolne(x: DaneWR): WynikWR {
  const p = pit(x.rok);
  const uwagi: string[] = [];
  const powody: string[] = [];
  const A = osoba(x.a, x.rok);
  const samotny = x.tryb === 'samotny';
  const B = !samotny && x.b ? osoba(x.b, x.rok) : null;
  const osoby = B ? [A, B] : [A];
  if (!samotny && x.rozdzielnosc) powody.push('Przy rozdzielności majątkowej wspólne rozliczenie nie przysługuje.');
  if (x.liniowyRyczalt) powody.push(samotny ? 'Podatek liniowy lub ryczałt (poza najmem prywatnym) wyklucza rozliczenie z dzieckiem.' : 'Podatek liniowy lub ryczałt (poza najmem prywatnym) u któregokolwiek z małżonków wyklucza wspólne rozliczenie.');
  if (samotny && !(x.dzieci && x.dzieci > 0)) powody.push('Rozliczenie samotnego rodzica wymaga co najmniej jednego dziecka (małoletniego, uczącego się do 25 lat albo z zasiłkiem pielęgnacyjnym lub rentą socjalną).');

  // ulga na dzieci
  const dzieci = Math.max(0, Math.floor(x.dzieci ?? 0));
  let ulga = kwotaUlgi(dzieci);
  let ulgaLimitPrzekroczony = false;
  if (dzieci === 1) {
    const limit = samotny || !x.slubWTrakcie ? 112000 : 56000;
    const doch = samotny ? A.dochod : x.slubWTrakcie ? A.dochod : A.dochod + (B?.dochod ?? 0);
    if (doch > limit) { ulga = 0; ulgaLimitPrzekroczony = true; uwagi.push(`Przy jednym dziecku ulga przysługuje, gdy dochody ${samotny || x.slubWTrakcie ? '' : 'obojga małżonków '}nie przekraczają ${fmt(limit)} zł – tu ${fmt(Math.round(doch))} zł. Nie dotyczy to dziecka z orzeczeniem o niepełnosprawności.`); }
    else if (x.slubWTrakcie && !samotny) uwagi.push('Po ślubie w trakcie roku limit dochodu przy jednym dziecku to 56 000 zł dla każdego z rodziców osobno (nie 112 000 zł łącznie).');
  }

  const zaliczki = osoby.reduce((s, o) => s + o.zaliczki, 0);
  const limitZwrotu = osoby.reduce((s, o) => s + o.limitZwrotu, 0);
  // osobno: ulgę dzielą dowolnie – optymalnie najpierw na podatek, reszta wraca do limitu składek obojga
  const podatekOsobno = osoby.reduce((s, o) => s + o.podatek, 0);
  const osobno = zUlga(podatekOsobno, ulga, limitZwrotu, zaliczki);
  // razem: 2 × podatek od połowy łącznej podstawy
  const podstawa = osoby.reduce((s, o) => s + o.podstawa, 0);
  const podatekRazem = zl0(2 * podatekSkala(podstawa / 2, p));
  const razem = zUlga(podatekRazem, ulga, limitZwrotu, zaliczki);
  const oszczednosc = Math.round((osobno.podatek - osobno.ulgaZwrot - (razem.podatek - razem.ulgaZwrot)) * 100) / 100;

  const mozna = powody.length === 0;
  const prog = p.progi[0].do ?? 120000;
  if (mozna && oszczednosc <= 0) uwagi.push(samotny ? `Dochód mieści się w kwocie wolnej (${fmt(p.kwota_wolna)} zł), więc rozliczenie z dzieckiem nie obniża podatku.` : 'Przy takich dochodach wspólne rozliczenie nie obniża podatku – oboje mieścicie się w tym samym progu skali i każde wykorzystuje kwotę wolną.');
  if (!samotny && B && mozna && oszczednosc > 0) {
    const [mn, mx] = [Math.min(A.podstawa, B.podstawa), Math.max(A.podstawa, B.podstawa)];
    if (mn < p.kwota_wolna) uwagi.push(`Część korzyści to kwota wolna (${fmt(p.kwota_wolna)} zł), której mniej zarabiający małżonek nie wykorzystałby sam.`);
    if (mx > prog) uwagi.push(`Część korzyści to przesunięcie dochodu z progu 32% – przy wspólnym rozliczeniu próg wynosi łącznie ${fmt(2 * prog)} zł.`);
  }
  const max = osoby.map((o) => o.dochod).reduce((a, b) => Math.max(a, b), 0);
  if (max > 1_000_000) uwagi.push('Danina solidarnościowa od dochodu ponad 1 mln zł liczy się dla każdego osobno – wspólne rozliczenie jej nie zmienia.');
  return { mozna, powody, osoby, osobno, razem, oszczednosc, ulga, ulgaLimitPrzekroczony, niepewne: p.niepewne, uwagi };
}
