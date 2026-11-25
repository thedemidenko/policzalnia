// IKE – symulacja oszczędzania i porównanie z IKZE i zwykłym kontem.
// Ustawa o IKE i IKZE (Dz.U. 2026 poz. 91): art. 3 (od 16 lat), art. 13 (limit 3× prognozowane wynagrodzenie),
// art. 13a (IKZE 1,2× / 1,8× dla działalności), art. 34 (wypłata IKE: 60 lat albo 55 + uprawnienia emerytalne,
// wpłaty w ≥5 latach albo >50% wpłat ≥5 lat przed wypłatą), art. 34a (IKZE od 65 lat, wpłaty w ≥5 latach).
// PIT: art. 21 ust. 1 pkt 58a (IKE bez podatku), art. 26 ust. 1 pkt 2b (odliczenie wpłat IKZE), art. 30 ust. 1 pkt 14 (10%).
import dane from '../data/ike-ikze.json';

export type Inwestycja = 'konto' | 'obligacje' | 'fundusz';
export const LIMITY = dane.lata as Record<string, { ike: number; ikze: number; ikzeJdg: number }>;
export const RYCZALT_IKZE = dane.ryczaltIkze / 100;
const BELKA = 0.19;
const ostatniRok = Math.max(...Object.keys(LIMITY).map(Number));

/** Limit na rok – znane z obwieszczeń, dalej rosnący o wzrost płac. */
const pierwszyRok = Math.min(...Object.keys(LIMITY).map(Number));
export function limit(rok: number, rodzaj: 'ike' | 'ikze' | 'ikzeJdg', wzrost = 0): number {
  if (LIMITY[rok]) return LIMITY[rok][rodzaj];
  if (rok < pierwszyRok) return LIMITY[pierwszyRok][rodzaj];
  return LIMITY[ostatniRok][rodzaj] * Math.pow(1 + wzrost / 100, rok - ostatniRok);
}

export interface DaneIke {
  /** wpłata co miesiąc (zł) – gdy pelnyLimit = false */
  miesiecznie: number;
  pelnyLimit?: boolean;
  /** kwota już zgromadzona na IKE (traktowana jak wpłata na start) */
  start?: number;
  lata: number;
  stopa: number;
  wzrostPlac?: number;
  inwestycja?: Inwestycja;
  /** stawka PIT do ulgi IKZE: 12, 19, 32 */
  pit?: number;
  rokStartu?: number;
}

interface Konto { wartosc: number; koszt: number; podatek: number }
const nowe = (): Konto => ({ wartosc: 0, koszt: 0, podatek: 0 });
function realizuj(k: Konto) { const z = k.wartosc - k.koszt; if (z > 0) { const p = z * BELKA; k.wartosc -= p; k.podatek += p; } k.koszt = k.wartosc; }

export function oblicz(d: DaneIke) {
  const inw = d.inwestycja ?? 'fundusz';
  const mies = Math.max(1, Math.round(d.lata * 12));
  const rm = Math.pow(1 + d.stopa / 100, 1 / 12) - 1;
  const rok0 = d.rokStartu ?? new Date().getFullYear();
  const pit = (d.pit ?? 12) / 100;
  const ike = nowe(), zwykle = nowe(), ikze = nowe(), zwroty = nowe(), zwykleIkze = nowe();
  let wplatyIke = 0, wplatyIkze = 0, ulga = 0, przekroczenie = false;
  const lataTab: { rok: number; wplaty: number; ike: number; zwykle: number }[] = [];
  const dodaj = (k: Konto, x: number) => { k.wartosc += x; k.koszt += x; };
  if (d.start) { dodaj(ike, d.start); dodaj(zwykle, d.start); wplatyIke += d.start; }
  let rocznieIke = 0, rocznieIkze = 0;
  for (let m = 1; m <= mies; m++) {
    const rok = rok0 + Math.floor((m - 1) / 12);
    const limIke = limit(rok, 'ike', d.wzrostPlac ?? 4), limIkze = limit(rok, 'ikze', d.wzrostPlac ?? 4);
    if ((m - 1) % 12 === 0) { rocznieIke = 0; rocznieIkze = 0; }
    // wpłaty na początku miesiąca
    let w = d.pelnyLimit ? limIke / 12 : d.miesiecznie;
    if (rocznieIke + w > limIke + 1e-6) { przekroczenie = true; w = Math.max(0, limIke - rocznieIke); }
    rocznieIke += w; wplatyIke += w;
    dodaj(ike, w); dodaj(zwykle, w);
    // IKZE: ta sama wpłata, ale w limicie IKZE
    let wz = Math.min(w, Math.max(0, limIkze - rocznieIkze));
    rocznieIkze += wz; wplatyIkze += wz;
    dodaj(ikze, wz); dodaj(zwykleIkze, wz);
    for (const k of [ike, zwykle, ikze, zwroty, zwykleIkze]) k.wartosc *= 1 + rm;
    // podatek na zwykłym koncie: konto – co rok, obligacje (EDO) – co 10 lat
    if (m % 12 === 0) {
      // ulga IKZE z rozliczenia rocznego trafia na zwykłe konto (inwestowana dalej)
      const zw = rocznieIkze * pit; ulga += zw; dodaj(zwroty, zw);
      if (inw === 'konto' || (inw === 'obligacje' && m % 120 === 0)) for (const k of [zwykle, zwroty, zwykleIkze]) realizuj(k);
      lataTab.push({ rok: m / 12, wplaty: wplatyIke, ike: ike.wartosc, zwykle: zwykle.wartosc - Math.max(0, zwykle.wartosc - zwykle.koszt) * BELKA });
    }
  }
  for (const k of [zwykle, zwroty, zwykleIkze]) realizuj(k);
  const ikeKoniec = ike.wartosc;
  const zysk = ikeKoniec - wplatyIke;
  const zwrot = ikeKoniec - Math.max(0, zysk) * BELKA; // zwrot przed wiekiem emerytalnym
  const ikzeNetto = ikze.wartosc * (1 - RYCZALT_IKZE);
  return {
    wplaty: wplatyIke, ike: ikeKoniec, zysk, zwykle: zwykle.wartosc, podatekZwykle: zwykle.podatek, korzysc: ikeKoniec - zwykle.wartosc,
    zwrot, podatekZwrot: ikeKoniec - zwrot, przekroczenie,
    // porównanie przy tych samych wpłatach (w limicie IKZE): IKE rośnie tak samo jak IKZE, ale bez ryczałtu
    ikze: { wplaty: wplatyIkze, ike: ikze.wartosc, netto: ikzeNetto, ryczalt: ikze.wartosc * RYCZALT_IKZE, ulga, zwroty: zwroty.wartosc, razem: ikzeNetto + zwroty.wartosc, zwykle: zwykleIkze.wartosc },
    lata: lataTab,
  };
}
export type WynikIke = ReturnType<typeof oblicz>;

/** Warunki wypłaty bez podatku (art. 34): wiek i 5 lat wpłat. */
export function warunki(wiek: number, wiekWyplaty: number, lataWplat: number, uprawnieniaEmerytalne = false) {
  const minWiek = uprawnieniaEmerytalne ? 55 : 60;
  const uwagi: string[] = [];
  if (wiek < 16) uwagi.push('IKE możesz założyć od 16 lat.');
  if (wiekWyplaty < minWiek) uwagi.push(`Wypłata bez podatku przysługuje od ${minWiek} lat${uprawnieniaEmerytalne ? '' : ' (albo od 55, jeśli masz już uprawnienia emerytalne)'} – wcześniej to zwrot z podatkiem Belki od zysku.`);
  if (lataWplat < 5) uwagi.push('Do wypłaty bez podatku musisz wpłacać na IKE w co najmniej 5 latach kalendarzowych albo wpłacić ponad połowę pieniędzy co najmniej 5 lat przed wypłatą.');
  return { ok: uwagi.length === 0, uwagi };
}

/** Ile jeszcze można wpłacić w danym roku i ile miesięcznie do końca roku. */
export function pozostalyLimit(rok: number, wplacono: number, miesiacTeraz: number, rodzaj: 'ike' | 'ikze' | 'ikzeJdg' = 'ike') {
  const l = limit(rok, rodzaj);
  const zostalo = Math.max(0, l - wplacono);
  const miesiecy = Math.max(1, 12 - miesiacTeraz + 1);
  return { limit: l, zostalo, miesiecznie: Math.floor((zostalo / miesiecy) * 100) / 100, miesiecy, miesiecznyLimit: Math.round((l / 12) * 100) / 100 };
}
