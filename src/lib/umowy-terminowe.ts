// Umowy na czas określony – limit 33 miesięcy i 3 umów (art. 25¹ KP), okres wypowiedzenia (art. 34, 36),
// koniec okresu wypowiedzenia w sobotę / ostatniego dnia miesiąca (art. 30 § 2¹).
// Okresy umów stykających się (koniec + 1 dzień = początek następnej) liczymy jako jeden ciągły okres kalendarzowo,
// umowy przedzielone przerwą – sumujemy (30 dni = miesiąc). Przerwy nie zerują limitu (PIP, „Umowy terminowe”).
import { dodajDni } from './kalendarz';
import { klucz, roznica, sumuj, type LMD, type Przedzial } from './staz';

export type TypUmowy = 'okreslony' | 'wyjatek' | 'probny' | 'nieokreslony';
export const TYPY: Record<TypUmowy, string> = {
  okreslony: 'na czas określony',
  wyjatek: 'określony – wyjątek (zastępstwo, sezonowa, kadencja, obiektywne przyczyny)',
  probny: 'na okres próbny',
  nieokreslony: 'na czas nieokreślony',
};
export interface Umowa { od: string; do?: string; typ: TypUmowy }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const LIMIT: LMD = { lata: 2, miesiace: 9, dni: 0 }; // 33 miesiące
const LIMIT_K = klucz(LIMIT);

/** Scala okresy nakładające się i stykające (dzień po końcu = początek następnego). */
export function ciagle(przedzialy: Przedzial[]): Przedzial[] {
  const p = [...przedzialy].sort((a, b) => a.od.localeCompare(b.od));
  const w: Przedzial[] = [];
  for (const o of p) {
    const ost = w.at(-1);
    if (ost && o.od <= dodajDni(ost.do, 1)) { if (o.do > ost.do) ost.do = o.do; }
    else w.push({ ...o });
  }
  return w;
}
const przytnij = (p: Przedzial[], doDnia: string) => p.filter((x) => x.od <= doDnia).map((x) => ({ od: x.od, do: x.do < doDnia ? x.do : doDnia }));
const dzien = (iso: string) => Math.round(Date.parse(iso) / 864e5);
const zDnia = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);

/** Ostatni dzień, w którym łączny okres osiąga dokładnie 33 miesiące (null – nie osiąga w podanych okresach). */
export function dzien33(okresy: Przedzial[]): string | null {
  const c = ciagle(okresy);
  if (!c.length || klucz(sumuj(c)) < LIMIT_K) return null;
  let lo = dzien(c[0].od), hi = dzien(c.at(-1)!.do);
  while (lo < hi) { const m = Math.floor((lo + hi) / 2); if (klucz(sumuj(przytnij(c, zDnia(m)))) >= LIMIT_K) hi = m; else lo = m + 1; }
  return zDnia(lo);
}

export function analiza(umowy: Umowa[], naDzien: string, startNastepnej?: string) {
  const poprawne = umowy.filter((u) => ISO.test(u.od) && (!u.do || (ISO.test(u.do) && u.do >= u.od)));
  const terminowe = poprawne.filter((u) => u.typ === 'okreslony' && u.do).sort((a, b) => a.od.localeCompare(b.od));
  const okresy: Przedzial[] = terminowe.map((u) => ({ od: u.od, do: u.do! }));
  const laczny = okresy.length ? sumuj(ciagle(okresy)) : { lata: 0, miesiace: 0, dni: 0 };
  const d33 = dzien33(okresy);
  const poOkresie = d33 && okresy.some((o) => o.do > d33) ? dodajDni(d33, 1) : null;
  const czwarta = terminowe.length >= 4 ? terminowe[3].od : null;
  const nieokreslonyOd = [poOkresie, czwarta].filter(Boolean).sort()[0] ?? null;
  const powod = !nieokreslonyOd ? null : nieokreslonyOd === czwarta && nieokreslonyOd !== poOkresie ? 'liczba' : 'okres';
  const pozostaloUmow = Math.max(0, 3 - terminowe.length);
  // ile jeszcze można – jak długo może trwać kolejna umowa (jeśli zostały umowy w limicie)
  let maksKoniec: string | null = null;
  if (!nieokreslonyOd && pozostaloUmow > 0 && startNastepnej && ISO.test(startNastepnej)) {
    const z = [...okresy, { od: startNastepnej, do: dodajDni(startNastepnej, 365 * 4) }];
    maksKoniec = dzien33(z);
  }
  const brakuje = (() => {
    if (klucz(laczny) >= LIMIT_K) return null;
    const m = 33 - (laczny.lata * 12 + laczny.miesiace) - (laczny.dni > 0 ? 1 : 0);
    return { miesiace: m, dni: laczny.dni > 0 ? 30 - laczny.dni : 0 };
  })();

  // staż u pracodawcy (wszystkie rodzaje umów) – do okresu wypowiedzenia (art. 36 § 1)
  const wszystkie: Przedzial[] = poprawne.map((u) => ({ od: u.od, do: u.do && u.do < naDzien ? u.do : naDzien })).filter((p) => p.od <= naDzien && p.do >= p.od);
  const c = ciagle(wszystkie);
  const staz = c.length ? sumuj(c) : { lata: 0, miesiace: 0, dni: 0 };
  const sk = klucz(staz);
  const okresWyp: { tygodnie?: number; miesiace?: number; opis: string } =
    sk >= klucz({ lata: 3, miesiace: 0, dni: 0 }) ? { miesiace: 3, opis: '3 miesiące' } : sk >= klucz({ lata: 0, miesiace: 6, dni: 0 }) ? { miesiace: 1, opis: '1 miesiąc' } : { tygodnie: 2, opis: '2 tygodnie' };
  // kiedy wydłuży się okres wypowiedzenia (gdy zatrudnienie trwa dalej)
  const przyszle = poprawne.map((u) => ({ od: u.od, do: u.do ?? dodajDni(naDzien, 365 * 5) }));
  const progDzien = (cel: LMD) => {
    const cc = ciagle(przyszle);
    if (!cc.length || klucz(sumuj(cc)) < klucz(cel)) return null;
    let lo = dzien(cc[0].od), hi = dzien(cc.at(-1)!.do);
    while (lo < hi) { const m = Math.floor((lo + hi) / 2); if (klucz(sumuj(przytnij(cc, zDnia(m)))) >= klucz(cel)) hi = m; else lo = m + 1; }
    return zDnia(lo);
  };
  const od1mies = sk < klucz({ lata: 0, miesiace: 6, dni: 0 }) ? progDzien({ lata: 0, miesiace: 6, dni: 0 }) : null;
  const od3mies = sk < klucz({ lata: 3, miesiace: 0, dni: 0 }) ? progDzien({ lata: 3, miesiace: 0, dni: 0 }) : null;

  const uwagi: string[] = [];
  if (poprawne.some((u) => u.typ === 'wyjatek')) uwagi.push('Umowy-wyjątki (zastępstwo, praca sezonowa lub dorywcza, kadencja, obiektywne przyczyny zgłoszone do PIP) nie wliczają się do limitu 33 miesięcy i 3 umów.');
  if (poprawne.some((u) => u.typ === 'probny')) uwagi.push('Umowa na okres próbny nie wlicza się do limitu, ale wlicza się do stażu u pracodawcy, od którego zależy okres wypowiedzenia.');
  return { laczny, liczba: terminowe.length, d33, nieokreslonyOd, powod, pozostaloUmow, brakuje, maksKoniec, staz, okresWyp, od1mies, od3mies, uwagi };
}
export type AnalizaUmow = ReturnType<typeof analiza>;

/** Koniec okresu wypowiedzenia (art. 30 § 2¹): tygodnie – w sobotę, miesiące – ostatniego dnia miesiąca. */
export function koniecWypowiedzenia(zlozenie: string, okres: { tygodnie?: number; miesiace?: number }): string {
  if (okres.miesiace) {
    const r = +zlozenie.slice(0, 4), m = +zlozenie.slice(5, 7) - 1 + okres.miesiace; // od 1. dnia następnego miesiąca
    return new Date(Date.UTC(r, m + 1, 0)).toISOString().slice(0, 10);
  }
  // tygodnie liczone od najbliższej niedzieli po dniu złożenia (dnia złożenia się nie liczy), koniec w sobotę
  const dow = new Date(zlozenie + 'T00:00:00Z').getUTCDay(); // 0 = niedziela
  const doNiedzieli = (7 - dow) % 7 || 7;
  return dodajDni(zlozenie, doNiedzieli + 7 * (okres.tygodnie ?? 1) - 1);
}

export const opis = (x: LMD) => {
  const p: string[] = [];
  const odm = (n: number, f: [string, string, string]) => (n === 1 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? f[1] : f[2]);
  if (x.lata) p.push(`${x.lata} ${odm(x.lata, ['rok', 'lata', 'lat'])}`);
  if (x.miesiace) p.push(`${x.miesiace} ${odm(x.miesiace, ['miesiąc', 'miesiące', 'miesięcy'])}`);
  if (x.dni) p.push(`${x.dni} ${odm(x.dni, ['dzień', 'dni', 'dni'])}`);
  return p.join(' ') || '0 dni';
};
export const miesiace = (x: LMD) => x.lata * 12 + x.miesiace;
