// Odsetki za zwłokę od składek ZUS (art. 23 ustawy o systemie ubezpieczeń społecznych).
// Zasady i wysokość jak w Ordynacji podatkowej (stawka podstawowa, art. 56), bez stawki obniżonej (art. 56a wyłączony).
// Odsetki liczy się odrębnie od każdego miesiąca i funduszu (FUS, FUZ, FP+FS, FGŚP, FEP – tak liczy kalkulator ZUS),
// od dnia po terminie płatności do dnia zapłaty włącznie, kwota × dni × stawka / 365 dla każdego okresu stawki,
// sumę zaokrągla się do pełnych złotych (art. 63 § 1 OP). Odsetek nie nalicza się, jeżeli nie przekraczałyby 1% płacy
// minimalnej (art. 23 ust. 1a, od 18.09.2021; wcześniej 6,60 zł) – ZUS pobiera je w 2026 r. od 49 zł, czyli porównuje
// kwotę po zaokrągleniu. Termin płatności – art. 47 ust. 1, w sobotę lub dzień wolny przesuwa się (art. 12 § 5 OP via art. 31).
// Wpłata (e-Składka) dzielona proporcjonalnie na fundusze według ostatniej deklaracji, a w funduszu – na najstarszy dług;
// niepełna wpłata pokrywa proporcjonalnie składkę i odsetki (art. 55 § 2 OP via art. 31). Od składek rozłożonych na raty
// odsetek nie nalicza się od dnia po wpływie wniosku (art. 29 ust. 2).
import dane from '../data/odsetki-zus.json';
import { r2 } from './format';
import { terminRoboczy } from './kalendarz';
import { dzien, iso } from './odsetki';
import { OD_KIEDY, doZlotych, stawkaPodatkowa } from './odsetki-podatkowe';
import stopy from '../data/stopy-nbp.json';

export type Platnik = 'sam' | 'pozostali' | 'prawna' | 'budzetowa';
export const PLATNICY: Record<Platnik, string> = {
  sam: 'Przedsiębiorca – tylko za siebie',
  pozostali: 'Przedsiębiorca z pracownikami',
  prawna: 'Spółka z o.o., S.A., spółdzielnia',
  budzetowa: 'Jednostka budżetowa',
};
export const FUNDUSZE = {
  fus: 'Ubezpieczenia społeczne',
  fuz: 'Ubezpieczenie zdrowotne',
  fp: 'Fundusz Pracy i Solidarnościowy',
  fgsp: 'FGŚP',
  fep: 'Fundusz Emerytur Pomostowych',
} as const;
export type Fundusz = keyof typeof FUNDUSZE;
export const KOLEJNOSC: Fundusz[] = ['fus', 'fuz', 'fp', 'fgsp', 'fep'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MIES = /^\d{4}-\d{2}$/;
const pl = (d: string) => d.split('-').reverse().join('.');
const zlp = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Termin płatności składek za dany miesiąc (bez przesunięcia z dnia wolnego). */
export function terminUstawowy(okres: string, platnik: Platnik): string {
  const r = +okres.slice(0, 4), m = +okres.slice(5, 7); // m = miesiąc składki; płatne w następnym
  const nowe = okres >= dane.nowe_terminy_od_okresu;
  const dzienM = platnik === 'budzetowa' ? 5 : platnik === 'prawna' ? 15 : platnik === 'pozostali' ? (nowe ? 20 : 15) : nowe ? 20 : 10;
  const rr = m === 12 ? r + 1 : r, mm = m === 12 ? 1 : m + 1;
  return `${rr}-${String(mm).padStart(2, '0')}-${String(dzienM).padStart(2, '0')}`;
}
/** Termin płatności z przesunięciem z soboty lub dnia wolnego na następny dzień roboczy. */
export const terminSkladek = (okres: string, platnik: Platnik) => terminRoboczy(terminUstawowy(okres, platnik));

/** Płaca minimalna w danym dniu (null – sprzed 2021). */
export function placaMinimalna(data: string): number | null {
  let p: number | null = null;
  for (const z of dane.placa_minimalna) if (z.od <= data) p = z.kwota;
  return p;
}
/** Próg: odsetek nie płaci się, gdy (po zaokrągleniu) nie przekraczają tej kwoty. */
export function progOdsetek(data: string): number {
  if (data < dane.prog_1proc_od) return dane.prog_wczesniej;
  return r2((placaMinimalna(data) ?? 0) / 100);
}
/** Najmniejsze odsetki pobierane przez ZUS w danym dniu (pełne złote powyżej progu). */
export const minimalneOdsetki = (data: string) => Math.floor(progOdsetek(data)) + 1;

const ZMIANY = [...new Set([...stopy.odsetki_podatkowe_do_2015.map((z) => z.od), '2016-01-01', ...stopy.zmiany.map((z) => z.od).filter((d) => d > '2016-01-01')])]
  .sort().map(dzien);

export interface OkresStawki { od: string; do: string; dni: number; kwota: number; stawka: number; odsetki: number }

/** Odsetki od kwoty za dni a..b (numery dni, włącznie), z podziałem na okresy stawek. */
export function odsetkiZaDni(kwota: number, a: number, b: number): OkresStawki[] {
  if (b < a || kwota <= 0) return [];
  const granice = [a, ...ZMIANY.filter((g) => g > a && g <= b), b + 1];
  const w: OkresStawki[] = [];
  for (let i = 0; i < granice.length - 1; i++) {
    const p = granice[i], k = granice[i + 1] - 1, dni = k - p + 1;
    const st = stawkaPodatkowa(iso(p));
    const ost = w.at(-1);
    if (ost && ost.stawka === st) { ost.do = iso(k); ost.dni += dni; ost.odsetki = r2((kwota * ost.dni * st) / 36500); continue; }
    w.push({ od: iso(p), do: iso(k), dni, kwota, stawka: st, odsetki: r2((kwota * dni * st) / 36500) });
  }
  return w;
}
const suma = (o: OkresStawki[]) => r2(o.reduce((s, x) => s + x.odsetki, 0));
/** Odsetki do zapłaty od jednej składki (zaokrąglone, z progiem) przy zapłacie całości w dniu `zaplata`. */
export function odsetkiOdSkladki(kwota: number, termin: string, zaplata: string): number {
  const o = doZlotych(suma(odsetkiZaDni(kwota, dzien(termin) + 1, dzien(zaplata))));
  return o <= progOdsetek(zaplata) ? 0 : o;
}

export interface PozycjaZus { okres?: string; termin?: string; kwoty: Partial<Record<Fundusz, number>> }
export interface WplataZus { data: string; kwota: number }
export interface OpcjeZus { platnik?: Platnik; wplaty?: WplataZus[]; wniosekRaty?: string }

export interface WplataNaFundusz { data: string; kwota: number; naSkladke: number; naOdsetki: number }
export interface FunduszWynik {
  fundusz: Fundusz;
  kwota: number;
  okresy: OkresStawki[];
  wplaty: WplataNaFundusz[];
  odsetkiPrzedZaokr: number;
  odsetki: number;
  /** składka pozostała do zapłaty */
  skladka: number;
  ponizejProgu: boolean;
}
export interface PozycjaWynik {
  nr: number;
  okres?: string;
  termin: string;
  terminUstawowy?: string;
  dni: number;
  fundusze: FunduszWynik[];
  kwota: number;
  skladki: number;
  odsetki: number;
  /** ostatni dzień zapłaty całej składki bez odsetek (poniżej progu w każdym funduszu) */
  bezOdsetekDo: string | null;
  splaconaWplata?: string;
  blad?: string;
}
export interface WynikZus {
  pozycje: PozycjaWynik[];
  kwota: number;
  skladki: number;
  odsetki: number;
  razem: number;
  wplacono: number;
  nadplata: number;
  prog: number;
  minimalne: number;
  stawka: number;
  /** o ile rosną odsetki każdego dnia zwłoki (przed zaokrągleniem) */
  przyrostDzienny: number;
  uwagi: string[];
  blad?: string;
}

interface Stan { p: PozycjaWynik; f: FunduszWynik; start: number; koniec: number; K: number; Z: number; dotad: number; wplacono: boolean }

/** Ostatni dzień zapłaty bez odsetek dla składek w podanych funduszach (skan do 3 lat). */
function bezOdsetekDo(kwoty: number[], termin: string): string | null {
  const s = dzien(termin) + 1;
  if (iso(s) < OD_KIEDY) return null;
  let ost = s - 1;
  for (let d = s; d < s + 365 * 3; d++) {
    const data = iso(d), prog = progOdsetek(data);
    if (kwoty.some((k) => doZlotych(suma(odsetkiZaDni(k, s, d))) > prog)) return iso(ost);
    ost = d;
  }
  return null;
}

/**
 * @param pozycje miesiące składek z kwotami na fundusze (termin z okresu i płatnika albo podany wprost)
 * @param zaplata dzień zapłaty pozostałej kwoty (odsetki do tego dnia włącznie)
 */
export function obliczOdsetkiZus(pozycje: PozycjaZus[], zaplata: string, opcje: OpcjeZus = {}): WynikZus {
  const platnik = opcje.platnik ?? 'sam';
  const uwagi: string[] = [];
  const pusty = (blad: string, poz: PozycjaWynik[] = []): WynikZus => ({ pozycje: poz, kwota: 0, skladki: 0, odsetki: 0, razem: 0, wplacono: 0, nadplata: 0, prog: 0, minimalne: 0, stawka: 0, przyrostDzienny: 0, uwagi, blad });
  if (!ISO.test(zaplata)) return pusty('Podaj datę zapłaty.');
  const E = dzien(zaplata);
  const raty = opcje.wniosekRaty && ISO.test(opcje.wniosekRaty) ? opcje.wniosekRaty : undefined;
  const kres = raty ? Math.min(E, dzien(raty)) : E;

  const wyniki: PozycjaWynik[] = [];
  const stany: Stan[] = [];
  pozycje.forEach((x, i) => {
    const kw = KOLEJNOSC.map((f) => [f, r2(Math.max(0, x.kwoty[f] ?? 0))] as const).filter(([, k]) => k > 0);
    if (!kw.length) return;
    const tu = x.termin && ISO.test(x.termin) ? undefined : x.okres && MIES.test(x.okres) ? terminUstawowy(x.okres, platnik) : undefined;
    const termin = x.termin && ISO.test(x.termin) ? x.termin : tu ? terminRoboczy(tu) : '';
    const p: PozycjaWynik = { nr: i + 1, okres: x.okres && MIES.test(x.okres) ? x.okres : undefined, termin, terminUstawowy: tu, dni: 0, fundusze: [], kwota: r2(kw.reduce((s, [, k]) => s + k, 0)), skladki: 0, odsetki: 0, bezOdsetekDo: null };
    wyniki.push(p);
    if (!termin) { p.blad = 'Podaj miesiąc składek albo termin płatności.'; return; }
    const start = dzien(termin) + 1;
    if (iso(start) < OD_KIEDY) { p.blad = `Kalkulator zna stawki od ${pl(OD_KIEDY)}.`; return; }
    for (const [f, k] of kw) {
      const fw: FunduszWynik = { fundusz: f, kwota: k, okresy: [], wplaty: [], odsetkiPrzedZaokr: 0, odsetki: 0, skladka: k, ponizejProgu: false };
      p.fundusze.push(fw);
      stany.push({ p, f: fw, start, koniec: kres, K: k, Z: 0, dotad: start - 1, wplacono: false });
    }
    p.bezOdsetekDo = bezOdsetekDo(kw.map(([, k]) => k), termin);
  });
  if (!wyniki.length) return pusty('Wpisz kwotę składek.');
  if (!stany.length) return pusty(wyniki[0].blad ?? 'Wpisz kwotę składek.', wyniki);

  const nalicz = (s: Stan, d: number) => {
    const b = Math.min(d, s.koniec);
    if (b <= s.dotad || s.K <= 0) { s.dotad = Math.max(s.dotad, b); return; }
    for (const o of odsetkiZaDni(s.K, s.dotad + 1, b)) {
      const ost = s.f.okresy.at(-1);
      if (ost && ost.stawka === o.stawka && ost.kwota === o.kwota && dzien(ost.do) === dzien(o.od) - 1) {
        s.Z = r2(s.Z - ost.odsetki); ost.do = o.do; ost.dni += o.dni; ost.odsetki = r2((ost.kwota * ost.dni * ost.stawka) / 36500); s.Z = r2(s.Z + ost.odsetki);
      } else { s.f.okresy.push(o); s.Z = r2(s.Z + o.odsetki); }
    }
    s.dotad = b;
  };
  const koncowe = (s: Stan, data: string) => { const o = doZlotych(s.Z); return !s.wplacono && o <= progOdsetek(data) ? 0 : o; };

  // wpłaty: podział na fundusze według ostatniej deklaracji (najnowszy miesiąc), w funduszu – najstarszy dług
  const wplaty = (opcje.wplaty ?? []).filter((x) => ISO.test(x.data) && x.kwota > 0).sort((a, b) => a.data.localeCompare(b.data));
  if (wplaty.some((x) => dzien(x.data) > E)) uwagi.push('Wpłaty późniejsze niż data zapłaty pominięto.');
  const najnowsza = [...wyniki].filter((p) => !p.blad).sort((a, b) => b.termin.localeCompare(a.termin))[0];
  const wagi = Object.fromEntries(KOLEJNOSC.map((f) => [f, najnowsza?.fundusze.find((x) => x.fundusz === f)?.kwota ?? 0])) as Record<Fundusz, number>;
  let nadplata = 0, wplacono = 0;
  for (const x of wplaty) {
    const d = dzien(x.data);
    if (d > E) continue;
    wplacono = r2(wplacono + x.kwota);
    stany.forEach((s) => nalicz(s, d));
    const dlug = (f: Fundusz) => r2(stany.filter((s) => s.f.fundusz === f).reduce((a, s) => a + s.K + koncowe(s, x.data), 0));
    const przydzial = {} as Record<Fundusz, number>;
    let W = r2(x.kwota);
    let otwarte = KOLEJNOSC.filter((f) => dlug(f) > 0);
    KOLEJNOSC.forEach((f) => (przydzial[f] = 0));
    while (W > 0.004 && otwarte.length) {
      const w = otwarte.map((f) => wagi[f]);
      const sw = w.reduce((a, b) => a + b, 0);
      const udzialy = sw > 0 ? w.map((v) => v / sw) : otwarte.map((f) => dlug(f) / otwarte.reduce((a, g) => a + dlug(g), 0));
      let rozdano = 0;
      otwarte.forEach((f, i) => {
        const brak = r2(dlug(f) - przydzial[f]);
        const ile = Math.min(brak, i === otwarte.length - 1 ? r2(W - rozdano) : r2(W * udzialy[i]));
        przydzial[f] = r2(przydzial[f] + ile); rozdano = r2(rozdano + ile);
      });
      W = r2(W - rozdano);
      const dalej = otwarte.filter((f) => r2(dlug(f) - przydzial[f]) > 0);
      if (dalej.length === otwarte.length && rozdano === 0) break;
      otwarte = dalej;
    }
    nadplata = r2(nadplata + W);
    for (const f of KOLEJNOSC) {
      let A = przydzial[f];
      for (const s of stany.filter((q) => q.f.fundusz === f).sort((a, b) => a.start - b.start || a.p.nr - b.p.nr)) {
        if (A <= 0) break;
        if (s.K <= 0 && s.Z <= 0) continue;
        const ods = koncowe(s, x.data);
        if (A >= r2(s.K + ods)) {
          s.f.wplaty.push({ data: x.data, kwota: r2(s.K + ods), naSkladke: s.K, naOdsetki: ods });
          A = r2(A - s.K - ods); s.K = 0; s.Z = 0;
        } else if (ods === 0 && !s.wplacono) {
          // odsetki od spłacanej części nie przekraczają progu – wpłata w całości na składkę,
          // odsetki od reszty składki liczą się dalej (część przypadająca na spłaconą kwotę przepada)
          s.f.wplaty.push({ data: x.data, kwota: A, naSkladke: A, naOdsetki: 0 });
          s.Z = r2((s.Z * (s.K - A)) / s.K); s.K = r2(s.K - A); A = 0;
        } else {
          const naSkladke = r2((A * s.K) / (s.K + s.Z)), naOdsetki = r2(A - naSkladke);
          s.f.wplaty.push({ data: x.data, kwota: A, naSkladke, naOdsetki });
          if (s.Z > 0) s.wplacono = true;
          s.K = r2(s.K - naSkladke); s.Z = r2(s.Z - naOdsetki); A = 0;
        }
      }
      nadplata = r2(nadplata + A);
    }
    for (const p of wyniki) if (!p.splaconaWplata && p.fundusze.length && stany.filter((s) => s.p === p).every((s) => s.K <= 0 && s.Z <= 0)) p.splaconaWplata = x.data;
  }

  for (const s of stany) {
    nalicz(s, E);
    s.f.skladka = s.K;
    s.f.odsetkiPrzedZaokr = s.Z;
    s.f.odsetki = s.K > 0 || s.Z > 0 ? koncowe(s, zaplata) : 0;
    s.f.ponizejProgu = s.Z > 0 && s.f.odsetki === 0;
  }
  for (const p of wyniki) {
    if (p.blad) continue;
    const ost = Math.min(p.splaconaWplata ? dzien(p.splaconaWplata) : E, kres);
    p.dni = Math.max(0, ost - dzien(p.termin));
    p.skladki = r2(p.fundusze.reduce((a, f) => a + f.skladka, 0));
    p.odsetki = p.fundusze.reduce((a, f) => a + f.odsetki, 0);
    if (p.terminUstawowy && p.terminUstawowy !== p.termin) uwagi.push(`Termin ${pl(p.terminUstawowy)} przypadał w dzień wolny – przesunięto go na ${pl(p.termin)}.`);
  }
  const prog = progOdsetek(zaplata);
  const ponizej = stany.filter((s) => s.f.ponizejProgu);
  if (ponizej.length) {
    const ile = r2(ponizej.reduce((a, s) => a + s.Z, 0));
    uwagi.push(`${ponizej.length === stany.length ? 'Odsetki' : 'Część odsetek'} (łącznie ${zlp(ile)} zł przed zaokrągleniem) nie przekracza ${zlp(prog)} zł w danym miesiącu i funduszu – ${ponizej.length === stany.length ? 'nie płacisz ich' : 'tej części nie płacisz'} (art. 23 ust. 1a ustawy o sus).`);
  }
  if (raty && dzien(raty) < E) uwagi.push(`Odsetki policzono do dnia złożenia wniosku o rozłożenie na raty (${pl(raty)}). Od dnia następnego nie nalicza się ich od składek objętych układem ratalnym (art. 29 ust. 2) – ZUS pobierze opłatę prolongacyjną.`);
  for (const p of wyniki) if (p.blad) uwagi.push(`${wyniki.length > 1 ? `Pozycja ${p.nr}: ` : ''}${p.blad}`);
  if (nadplata > 0) uwagi.push(`Wpłaty przekroczyły zadłużenie o ${zlp(nadplata)} zł (nadpłata).`);

  const ok = wyniki.filter((p) => !p.blad);
  const skladki = r2(ok.reduce((a, p) => a + p.skladki, 0));
  const odsetki = ok.reduce((a, p) => a + p.odsetki, 0);
  const stawka = stawkaPodatkowa(zaplata);
  return {
    pozycje: wyniki, kwota: r2(ok.reduce((a, p) => a + p.kwota, 0)), skladki, odsetki, razem: r2(skladki + odsetki), wplacono, nadplata,
    prog, minimalne: minimalneOdsetki(zaplata), stawka, przyrostDzienny: kres < E ? 0 : r2((skladki * stawka) / 36500), uwagi,
  };
}
