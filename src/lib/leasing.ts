// Leasing samochodu – rata (annuitet z wykupem jako wartością końcową), suma opłat,
// oprocentowanie z oferty oraz skutki podatkowe w firmie.
// Prawo: art. 23 ust. 1 pkt 4, 46a, 47a, ust. 5a, 5c, 5e, art. 23b ustawy o PIT (Dz.U. 2026 poz. 592),
// art. 86a ustawy o VAT. Limity od 1.01.2026 obowiązują także dla umów zawartych wcześniej.
import dane from '../data/leasing.json';
import { r2 } from './format';

export type Kto = 'firma' | 'prywatnie';
export type Naped = 'spalinowy' | 'niskoemisyjny' | 'elektryczny' | 'ciezarowy';
export type Opodatkowanie = 'skala12' | 'skala32' | 'liniowy' | 'ryczalt' | 'cit9' | 'cit19';
export type TrybOprocentowania = 'stopa' | 'rata' | 'suma';

export const VAT = dane.vat / 100;
export const LIMITY = dane.limity as Record<Exclude<Naped, 'ciezarowy'>, number>;
export const WIBOR = dane.wibor3m;
export const MIN_OKRES = dane.minOkresOperacyjny;
export const LIMIT_JEDNORAZOWO = dane.jednorazowaAmortyzacja;

export const NAPEDY: [Naped, string][] = [
  ['spalinowy', 'spalinowy / hybryda (CO₂ od 50 g/km) – limit 100 000 zł'],
  ['niskoemisyjny', 'hybryda plug-in (CO₂ poniżej 50 g/km) – limit 150 000 zł'],
  ['elektryczny', 'elektryczny lub wodorowy – limit 225 000 zł'],
  ['ciezarowy', 'ciężarowy / dostawczy (homologacja N1) – bez limitu'],
];

export const OPODATKOWANIE: [Opodatkowanie, string, number][] = [
  ['skala12', 'skala 12%', 0.12 + 0.09],
  ['skala32', 'skala 32%', 0.32 + 0.09],
  // na liniowym zapłacona zdrowotna (4,9%) obniża dochód do limitu, stąd odjęcie 19% × 4,9%
  ['liniowy', 'liniowy 19%', 0.19 + 0.049 - 0.19 * 0.049],
  ['ryczalt', 'ryczałt', 0],
  ['cit9', 'spółka – CIT 9%', 0.09],
  ['cit19', 'spółka – CIT 19%', 0.19],
];
export const stawkaOszczednosci = (p: Opodatkowanie) => OPODATKOWANIE.find((x) => x[0] === p)![2];

/** Rata annuitetowa: finansowanie F, wykup K płatny po ostatniej racie, n rat, stopa miesięczna r. */
export function rataAnnuitetowa(F: number, K: number, n: number, r: number): number {
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return (F - K) / n;
  const v = Math.pow(1 + r, -n);
  return ((F - K * v) * r) / (1 - v);
}

/** Stopa miesięczna, przy której n rat R i wykup K są warte dziś F (bisekcja). */
export function stopaZRaty(F: number, K: number, n: number, R: number): number {
  const f = (r: number) => {
    if (Math.abs(r) < 1e-12) return R * n + K - F;
    const v = Math.pow(1 + r, -n);
    return (R * (1 - v)) / r + K * v - F;
  };
  let lo = -0.03, hi = 0.1;
  if (f(lo) < 0 || f(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

export interface DaneLeasingu {
  kto: Kto;
  cena: number;
  /** cena (i rata z oferty) podana z VAT */
  brutto?: boolean;
  /** opłata wstępna, % ceny */
  wplata: number;
  okres: number;
  /** wykup, % ceny */
  wykup: number;
  tryb?: TrybOprocentowania;
  /** oprocentowanie roczne, % */
  stopa?: number;
  /** rata z oferty (netto albo brutto – jak cena) */
  rata?: number;
  /** suma opłat z oferty, % ceny */
  suma?: number;
  naped?: Naped;
  vatowiec?: boolean;
  tylkoFirma?: boolean;
  podatek?: Opodatkowanie;
  /** paliwo, serwis itp. – miesięcznie, z VAT */
  eksploatacja?: number;
  wykupDoFirmy?: boolean;
}

export interface MiesiacHarmonogramu { nr: number; rata: number; odsetki: number; kapital: number; saldo: number }
export interface RokUmowy { rok: number; oplaty: number; odsetki: number; kup: number; vat: number; oszczednosc: number }

export function obliczLeasing(d: DaneLeasingu, porownaj = true) {
  const firma = d.kto === 'firma';
  const naped: Naped = d.naped ?? 'spalinowy';
  const podatek: Opodatkowanie = d.podatek ?? 'liniowy';
  const n = Math.max(1, Math.round(d.okres));
  const N = r2(d.brutto ? d.cena / (1 + VAT) : d.cena);
  const W = r2((N * d.wplata) / 100);
  const K = r2((N * d.wykup) / 100);
  const F = r2(N - W);
  const tryb = d.tryb ?? 'stopa';
  const uwagi: string[] = [];

  let R: number;
  let rMies: number;
  if (tryb === 'stopa') {
    rMies = (d.stopa ?? 0) / 100 / 12;
    R = r2(rataAnnuitetowa(F, K, n, rMies));
  } else {
    R = tryb === 'rata'
      ? r2(d.brutto ? (d.rata ?? 0) / (1 + VAT) : d.rata ?? 0)
      : r2(((d.suma ?? 0) / 100 * N - W - K) / n);
    rMies = stopaZRaty(F, K, n, R);
  }
  const stopa = Number.isFinite(rMies) ? rMies * 12 * 100 : NaN;
  if (tryb !== 'stopa' && Number.isFinite(stopa) && stopa < 0) uwagi.push('Oprocentowanie wychodzi ujemne – suma opłat jest niższa od ceny. Zwykle to promocja dopłacana przez producenta albo dealera.');

  // harmonogram – kapitał spłaca saldo F do poziomu wykupu K, ostatnia rata wyrównuje grosze
  const harmonogram: MiesiacHarmonogramu[] = [];
  let saldo = F;
  const rr = Number.isFinite(rMies) ? rMies : 0;
  for (let i = 1; i <= n; i++) {
    let odsetki = r2(saldo * rr);
    let kapital = r2(R - odsetki);
    if (i === n) { kapital = r2(saldo - K); odsetki = r2(R - kapital); }
    saldo = r2(saldo - kapital);
    harmonogram.push({ nr: i, rata: R, odsetki, kapital, saldo });
  }
  const sumaRat = r2(R * n);
  const odsetki = r2(harmonogram.reduce((s, m) => s + m.odsetki, 0));
  const sumaOplat = r2(W + sumaRat + K);
  const sumaProc = N > 0 ? (sumaOplat / N) * 100 : 0;
  const kosztFinansowania = r2(sumaOplat - N);

  // --- skutki podatkowe w firmie ---
  const vatOdl = !firma || !d.vatowiec ? 0 : naped === 'ciezarowy' || d.tylkoFirma ? 1 : 0.5;
  const nieodl = 1 + VAT * (1 - vatOdl); // mnożnik: netto + nieodliczony VAT (art. 23 ust. 5a)
  const limit = naped === 'ciezarowy' ? Infinity : LIMITY[naped];
  const wartoscDoLimitu = r2(N * nieodl);
  const proporcja = Number.isFinite(limit) ? Math.min(1, limit / wartoscDoLimitu) : 1;
  const stawka = firma ? stawkaOszczednosci(podatek) : 0;
  const kupWlaczone = firma && podatek !== 'ryczalt';
  const zaKrotko = firma && n < MIN_OKRES;

  const kupKapital = (x: number) => (kupWlaczone && !zaKrotko ? x * nieodl * proporcja : 0);
  const kupOdsetki = (x: number) => (kupWlaczone && !zaKrotko ? x * nieodl : 0);
  const vatZ = (x: number) => (firma ? x * VAT * vatOdl : 0);

  const doFirmy = firma && (d.wykupDoFirmy ?? true);
  const wartoscWykupu = r2(K * (doFirmy ? 1 + VAT * (1 - vatOdl) : 1 + VAT));
  const kupWykup = doFirmy && kupWlaczone ? wartoscWykupu : 0;
  const wykupJednorazowo = wartoscWykupu <= LIMIT_JEDNORAZOWO;

  const eksBrutto = Math.max(0, d.eksploatacja ?? 0);
  const eksNetto = eksBrutto / (1 + VAT);
  const eksVatOdl = firma ? eksNetto * VAT * vatOdl : 0;
  const eksUdzial = naped === 'ciezarowy' || d.tylkoFirma ? 1 : 0.75;
  const eksKupMies = kupWlaczone ? (eksBrutto - eksVatOdl) * eksUdzial : 0;

  // podział na lata umowy (wpłata w 1. roku, wykup w ostatnim)
  const lata: RokUmowy[] = [];
  for (let rok = 1; rok <= Math.ceil(n / 12); rok++) lata.push({ rok, oplaty: 0, odsetki: 0, kup: 0, vat: 0, oszczednosc: 0 });
  lata[0].oplaty += W; lata[0].kup += kupKapital(W); lata[0].vat += vatZ(W);
  for (const m of harmonogram) {
    const l = lata[Math.ceil(m.nr / 12) - 1];
    l.oplaty += m.rata; l.odsetki += m.odsetki;
    l.kup += kupKapital(m.kapital) + kupOdsetki(m.odsetki) + eksKupMies;
    l.vat += vatZ(m.rata) + eksVatOdl;
  }
  const ost = lata[lata.length - 1];
  ost.oplaty += K; ost.kup += kupWykup; ost.vat += doFirmy ? vatZ(K) : 0;
  for (const l of lata) {
    l.oplaty = r2(l.oplaty); l.odsetki = r2(l.odsetki); l.kup = r2(l.kup); l.vat = r2(l.vat);
    l.oszczednosc = r2(l.kup * stawka);
  }

  const kupLeasing = r2(kupKapital(W + sumaRat - odsetki) + kupOdsetki(odsetki));
  const kupEksploatacja = r2(eksKupMies * n);
  const kup = r2(kupLeasing + kupEksploatacja + kupWykup);
  const kupUtracony = kupWlaczone && !zaKrotko ? r2((W + sumaRat - odsetki) * nieodl * (1 - proporcja)) : 0;
  const vatOdliczony = r2(lata.reduce((s, l) => s + l.vat, 0));
  const oszczednosc = r2(kup * stawka);
  const wydatek = r2(sumaOplat * (1 + VAT) + eksBrutto * n);
  const kosztRealny = r2(wydatek - vatOdliczony - oszczednosc);
  const rataBrutto = r2(R * (1 + VAT));
  const rataPoPodatkach = firma
    ? r2(rataBrutto - vatZ(R) - (kupWlaczone && !zaKrotko ? (kupLeasing - kupKapital(W)) / n : 0) * stawka)
    : rataBrutto;

  // porównanie form opodatkowania przy tych samych danych
  const porownanie = firma && porownaj
    ? OPODATKOWANIE.map(([k, nazwa]) => {
        const w = k === podatek ? null : obliczLeasing({ ...d, podatek: k, kto: 'firma' }, false);
        return { podatek: k, nazwa, oszczednosc: w ? w.oszczednosc : oszczednosc, kosztRealny: w ? w.kosztRealny : kosztRealny, rataPoPodatkach: w ? w.rataPoPodatkach : rataPoPodatkach };
      })
    : [];

  // leasing konsumencki vs kredyt przy tym samym oprocentowaniu (odsetki kredytu bez VAT)
  let kredyt: { rata: number; suma: number; roznica: number } | null = null;
  if (!firma && Number.isFinite(rMies)) {
    const Fb = (N - W) * (1 + VAT);
    const rk = r2(rataAnnuitetowa(Fb, 0, n, rMies));
    const suma = r2(W * (1 + VAT) + rk * n);
    kredyt = { rata: rk, suma, roznica: r2(sumaOplat * (1 + VAT) - suma) };
  }

  if (zaKrotko) uwagi.push(`Leasing operacyjny samochodu musi trwać co najmniej ${MIN_OKRES} miesiące (40% okresu amortyzacji, art. 23b ustawy o PIT). Przy krótszej umowie raty nie są kosztem.`);
  if (firma && kupWlaczone && proporcja < 1 && !zaKrotko)
    uwagi.push(`Auto przekracza limit ${limit.toLocaleString('pl-PL')} zł: kosztem jest ${(proporcja * 100).toFixed(2).replace('.', ',')}% części kapitałowej opłat, a część odsetkowa w całości.`);
  if (firma && podatek === 'ryczalt') uwagi.push('Na ryczałcie raty nie są kosztem i nie obniżają składki zdrowotnej – odzyskujesz tylko VAT (jeśli jesteś czynnym podatnikiem VAT).');
  if (firma && !d.vatowiec) uwagi.push('Bez rejestracji VAT cały podatek VAT z faktur jest kosztem (w granicach limitu).');
  if (doFirmy && kupWlaczone && !wykupJednorazowo) uwagi.push(`Wykup przekracza ${LIMIT_JEDNORAZOWO.toLocaleString('pl-PL')} zł – trafi do kosztów przez amortyzację, a nie jednorazowo.`);
  if (firma && !doFirmy) uwagi.push('Auto wykupione prywatnie i sprzedane przed upływem 6 lat (licząc od miesiąca po wykupie) – cena sprzedaży jest przychodem z działalności.');
  if (firma && d.vatowiec && d.tylkoFirma && naped !== 'ciezarowy') uwagi.push('100% VAT tylko przy aucie wyłącznie firmowym: zgłoszenie VAT-26, ewidencja przebiegu i regulamin wykluczający jazdy prywatne.');

  return {
    netto: N, brutto: r2(N * (1 + VAT)), wplata: W, wykup: K, finansowanie: F,
    rata: R, rataBrutto, stopa, sumaRat, odsetki, sumaOplat, sumaProc, kosztFinansowania,
    vatOdl, proporcja, limit, wartoscDoLimitu, kupLeasing, kupEksploatacja, kupWykup, kup, kupUtracony,
    wykupJednorazowo, vatOdliczony, oszczednosc, stawka, wydatek, kosztRealny, rataPoPodatkach,
    harmonogram, lata, porownanie, kredyt, uwagi,
  };
}
export type WynikLeasingu = ReturnType<typeof obliczLeasing>;
