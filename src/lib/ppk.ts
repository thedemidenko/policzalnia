// PPK – symulacja oszczędzania i wypłat. Ustawa o PPK (Dz.U. 2026 poz. 192): art. 26 (pracodawca 1,5% + do 2,5%),
// art. 27 (uczestnik 2% albo 0,5–2% przy wynagrodzeniu ≤ 1,2× płacy minimalnej, + do 2%), art. 31 (wpłata powitalna 250 zł),
// art. 32 (dopłata roczna 240 zł, próg: wpłaty ≥ 3,5% × 6× płaca minimalna, przy obniżonej wpłacie 25% tej kwoty),
// art. 99 (po 60. r.ż. 25% jednorazowo + 75% w ≥120 ratach – bez podatku), art. 105 (zwrot: 30% wpłat pracodawcy do ZUS,
// dopłaty państwa do Funduszu Pracy). PIT: art. 30a ust. 1 pkt 11b i 11d (19% od zysku), wpłata pracodawcy = przychód pracownika.
import stawki from '../data/stawki.json';
import { r2 } from './format';

export const POWITALNA = 250;
export const DOPLATA = 240;
export const BELKA = 0.19;
const lata = stawki.lata as Record<string, { placa_minimalna?: { wartosc: number } }>;
export function placaMinimalna(rok: number): number {
  const znane = Object.keys(lata).map(Number).filter((r) => lata[r]?.placa_minimalna).sort();
  const r = Math.min(Math.max(rok, znane[0]), znane.at(-1)!);
  return lata[r].placa_minimalna!.wartosc;
}
export const progObnizonej = (rok: number) => r2(1.2 * placaMinimalna(rok));
export const progDoplaty = (rok: number) => r2(0.035 * 6 * placaMinimalna(rok));
const podatekBelki = (zysk: number) => (zysk <= 0 ? 0 : Math.ceil(r2(zysk) * BELKA * 100 - 1e-7) / 100);

export interface DanePPK {
  brutto: number;
  wiek: number;
  wiekWyplaty?: number;
  /** wpłata podstawowa uczestnika, % (2 albo 0,5–2) */
  wplata?: number;
  dodatkowa?: number;
  pracodawcaDodatkowa?: number;
  /** stopa zwrotu rocznie (po opłatach), % */
  stopa?: number;
  wzrostPlac?: number;
  /** stawka PIT od wpłaty pracodawcy: 12, 32 albo 0 */
  pit?: number;
  inflacja?: number;
  rok?: number;
}

interface Zrodlo { wartosc: number; wplaty: number }

/** Wartość netto przy zwrocie (art. 105) z podziałem źródeł. */
export function zwrot(wlasne: Zrodlo, pracodawca: Zrodlo, panstwo: Zrodlo) {
  const zyskW = wlasne.wartosc - wlasne.wplaty;
  const doZus = r2(0.3 * pracodawca.wartosc);
  const pr70 = r2(0.7 * pracodawca.wartosc);
  const zyskP = 0.7 * (pracodawca.wartosc - pracodawca.wplaty);
  const podatek = r2(podatekBelki(zyskW) + podatekBelki(zyskP));
  const naKonto = r2(wlasne.wartosc + pr70 - podatek);
  return { naKonto, doZus, panstwo: r2(panstwo.wartosc), podatek, wlasne: r2(wlasne.wartosc), pracodawca70: pr70 };
}

export function obliczPPK(d: DanePPK) {
  const rok0 = d.rok ?? new Date().getFullYear();
  const wiekW = d.wiekWyplaty ?? 60;
  const miesiecy = Math.max(1, Math.round((wiekW - d.wiek) * 12));
  const pW = Math.min(2, Math.max(0.5, d.wplata ?? 2)) / 100;
  const pD = Math.min(2, Math.max(0, d.dodatkowa ?? 0)) / 100;
  const pP = (1.5 + Math.min(2.5, Math.max(0, d.pracodawcaDodatkowa ?? 0))) / 100;
  const rm = Math.pow(1 + (d.stopa ?? 5) / 100, 1 / 12) - 1;
  const g = (d.wzrostPlac ?? 3) / 100;
  const pit = (d.pit ?? 12) / 100;
  const obnizona = pW < 0.02;
  const uwagi: string[] = [];
  if (obnizona && d.brutto > progObnizonej(rok0)) uwagi.push(`Obniżoną wpłatę (poniżej 2%) możesz wybrać tylko przy wynagrodzeniu do ${progObnizonej(rok0).toLocaleString('pl-PL')} zł brutto (1,2× płaca minimalna w ${rok0} r.).`);

  const W: Zrodlo = { wartosc: 0, wplaty: 0 }, P: Zrodlo = { wartosc: 0, wplaty: 0 }, S: Zrodlo = { wartosc: 0, wplaty: 0 };
  let pitSuma = 0, wplatyRoku = 0, doplaty = 0;
  const lataTab: { rok: number; wiek: number; wartosc: number; wlasne: number; pracodawca: number; panstwo: number }[] = [];
  let mies1 = { wlasna: 0, pracodawcy: 0, pit: 0 };
  for (let m = 1; m <= miesiecy; m++) {
    for (const z of [W, P, S]) z.wartosc *= 1 + rm;
    const rokS = Math.floor((m - 1) / 12);
    const pensja = d.brutto * Math.pow(1 + g, rokS);
    const w = r2(pensja * (pW + pD)), p = r2(pensja * pP), t = r2(p * pit);
    if (m === 1) mies1 = { wlasna: w, pracodawcy: p, pit: t };
    W.wartosc += w; W.wplaty += w; P.wartosc += p; P.wplaty += p; pitSuma += t; wplatyRoku += w + p;
    if (m === 4) { S.wartosc += POWITALNA; S.wplaty += POWITALNA; doplaty += POWITALNA; }
    if (m % 12 === 0) {
      // dopłata roczna za rok kalendarzowy (próg rośnie razem z płacą minimalną – przyjmujemy wzrost jak płace)
      const prog = progDoplaty(rok0) * Math.pow(1 + g, rokS) * (obnizona ? 0.25 : 1);
      if (wplatyRoku >= prog && m + 4 <= miesiecy) { S.wartosc += DOPLATA; S.wplaty += DOPLATA; doplaty += DOPLATA; }
      wplatyRoku = 0;
      lataTab.push({ rok: rokS + 1, wiek: d.wiek + rokS + 1, wartosc: r2(W.wartosc + P.wartosc + S.wartosc), wlasne: r2(W.wplaty), pracodawca: r2(P.wplaty), panstwo: r2(S.wplaty) });
    }
  }
  const wartosc = r2(W.wartosc + P.wartosc + S.wartosc);
  const wplatyRazem = r2(W.wplaty + P.wplaty + S.wplaty);
  const zysk = r2(wartosc - wplatyRazem);
  const kosztTwoj = r2(W.wplaty + pitSuma);

  // wypłata po 60. r.ż.: 25% jednorazowo + 75% w 120 ratach bez podatku; albo całość od razu z podatkiem od 75% zysku
  const po60 = wiekW >= 60;
  const jednorazowo25 = r2(0.25 * wartosc);
  const rata120 = r2((0.75 * wartosc) / 120);
  const podatekCalosc = podatekBelki(0.75 * zysk);
  const calosc = r2(wartosc - podatekCalosc);
  const zw = zwrot(
    { wartosc: W.wartosc, wplaty: W.wplaty },
    { wartosc: P.wartosc, wplaty: P.wplaty },
    { wartosc: S.wartosc, wplaty: S.wplaty },
  );

  // alternatywa: te same pieniądze z własnej kieszeni (wpłaty + PIT) odkładane samodzielnie na ten sam procent, z podatkiem Belki
  let sam = 0, samWplaty = 0;
  for (let m = 1; m <= miesiecy; m++) {
    sam *= 1 + rm;
    const pensja = d.brutto * Math.pow(1 + g, Math.floor((m - 1) / 12));
    const x = r2(pensja * (pW + pD)) + r2(r2(pensja * pP) * pit);
    sam += x; samWplaty += x;
  }
  const samNetto = r2(sam - podatekBelki(sam - samWplaty));
  const inf = (d.inflacja ?? 0) / 100;
  const realnie = (x: number) => r2(x / Math.pow(1 + inf, miesiecy / 12));

  return {
    miesiecy, lat: miesiecy / 12, mies1, naRekeMniej: r2(mies1.wlasna + mies1.pit), naKontoMiesiecznie: r2(mies1.wlasna + mies1.pracodawcy),
    wartosc, wlasne: r2(W.wplaty), pracodawca: r2(P.wplaty), panstwo: r2(S.wplaty), doplaty, zysk, pit: r2(pitSuma), kosztTwoj,
    mnoznik: kosztTwoj > 0 ? (po60 ? wartosc : zw.naKonto) / kosztTwoj : 0,
    po60, jednorazowo25, rata120, calosc, podatekCalosc, zwrot: zw,
    sam: samNetto, przewaga: r2((po60 ? wartosc : zw.naKonto) - samNetto),
    realnie: { wartosc: realnie(wartosc), rata120: realnie(rata120) },
    lata: lataTab, uwagi, obnizona,
  };
}
export type WynikPPK = ReturnType<typeof obliczPPK>;

/** Tryb „zwrot teraz”: dane z wyciągu – sumy wpłat i obecna wartość konta (zysk rozkładany proporcjonalnie). */
export function zwrotTeraz(wlasne: number, pracodawcy: number, panstwa: number, wartosc: number, pit = 12) {
  const suma = wlasne + pracodawcy + panstwa;
  const k = suma > 0 ? wartosc / suma : 1;
  const z = zwrot({ wartosc: wlasne * k, wplaty: wlasne }, { wartosc: pracodawcy * k, wplaty: pracodawcy }, { wartosc: panstwa * k, wplaty: panstwa });
  const koszt = r2(wlasne + pracodawcy * (pit / 100));
  return { ...z, koszt, zyskNaZwrocie: r2(z.naKonto - koszt), wynik: k };
}
