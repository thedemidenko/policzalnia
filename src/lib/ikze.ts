// IKZE – zwrot podatku za rok (dokładnie z dochodu, z progami skali i kwotą wolną) oraz oszczędzanie do 65 lat.
// Ustawa o IKE i IKZE (Dz.U. 2026 poz. 91): art. 13a (limit 1,2× / 1,8× dla działalności), art. 34a (wypłata od 65 lat,
// wpłaty w ≥5 latach). PIT: art. 26 ust. 1 pkt 2b (odliczenie – skala), art. 30c ust. 2 pkt 3 (liniowy),
// art. 30 ust. 1 pkt 14 (10% przy wypłacie), art. 20 ust. 1 (zwrot = przychód); ryczałt: art. 11 ust. 1 ustawy o ryczałcie.
import stawki from '../data/stawki.json';
import { limit } from './ike';

export type Forma = 'skala' | 'liniowy' | 'ryczalt';
export const RYCZALT = 0.1;
const BELKA = 0.19;

interface Prog { do: number | null; stawka: number }
type Pit = { progi: Prog[]; kwota_zmniejszajaca: number; kwota_wolna: number; liniowy: number };
type PitRoku = Partial<Pit> & { wariant?: string; warianty?: Record<string, { progi: Prog[] }> };

/** Zasady PIT na rok; przy nierozstrzygniętej zmianie skali – wariant „bez zmian” (z flagą). */
export function pit(rok: number): Pit & { niepewne: boolean } {
  const lata = stawki.lata as unknown as Record<string, { pit?: PitRoku }>;
  const r = lata[rok]?.pit ?? lata[String(Math.max(...Object.keys(lata).map(Number)))].pit!;
  const wariant = r.warianty ? (r.wariant && r.warianty[r.wariant] ? r.wariant : 'bez_zmian') : null;
  const progi = wariant ? r.warianty![wariant].progi : r.progi!;
  return { progi, kwota_zmniejszajaca: r.kwota_zmniejszajaca!, kwota_wolna: r.kwota_wolna!, liniowy: r.liniowy!, niepewne: !!r.warianty && wariant !== r.wariant };
}

/** Podatek według skali od dochodu (po odliczeniach). */
export function podatekSkala(dochod: number, p: Pit): number {
  let pod = 0, dol = 0;
  for (const pr of p.progi) {
    const gora = pr.do ?? Infinity;
    if (dochod > dol) pod += (Math.min(dochod, gora) - dol) * pr.stawka;
    dol = gora;
  }
  return Math.max(0, pod - p.kwota_zmniejszajaca);
}

export interface DaneZwrotu {
  rok: number;
  forma: Forma;
  /** dochód (skala, liniowy) albo przychód (ryczałt) przed odliczeniem IKZE */
  podstawa: number;
  wplata: number;
  /** prowadzi działalność – wyższy limit; liniowy i ryczałt zawsze */
  dzialalnosc?: boolean;
  /** stawka ryczałtu, % */
  stawkaRyczaltu?: number;
}

export function zwrotPodatku(d: DaneZwrotu) {
  const p = pit(d.rok);
  const jdg = d.dzialalnosc || d.forma !== 'skala';
  const lim = limit(d.rok, jdg ? 'ikzeJdg' : 'ikze');
  const wplataWLimicie = Math.min(d.wplata, lim);
  const nadwyzka = Math.max(0, d.wplata - lim);
  const odliczenie = Math.max(0, Math.min(wplataWLimicie, d.podstawa));
  let zwrot = 0;
  const uwagi: string[] = [];
  if (d.forma === 'skala') {
    zwrot = podatekSkala(d.podstawa, p) - podatekSkala(d.podstawa - odliczenie, p);
    if (d.podstawa <= p.kwota_wolna) uwagi.push(`Dochód nie przekracza kwoty wolnej (${p.kwota_wolna.toLocaleString('pl-PL')} zł) – nie płacisz podatku, więc odliczenie IKZE nic nie zwróci. IKZE i tak pozwala oszczędzać bez podatku Belki, ale przy wypłacie zapłacisz 10%.`);
    else if (d.podstawa - odliczenie < p.kwota_wolna) uwagi.push(`Część wpłaty obniża dochód poniżej kwoty wolnej (${p.kwota_wolna.toLocaleString('pl-PL')} zł) – od tej części nie ma zwrotu.`);
    const prog = p.progi[0].do!;
    if (d.podstawa > prog && d.podstawa - odliczenie < prog) uwagi.push(`Wpłata „przechodzi” przez próg ${prog.toLocaleString('pl-PL')} zł: ${(d.podstawa - prog).toLocaleString('pl-PL')} zł odliczenia daje ${Math.round(p.progi[1].stawka * 100)}%, reszta ${Math.round(p.progi[0].stawka * 100)}%.`);
    if (p.niepewne) uwagi.push('Skala podatku na 2027 r. czeka na decyzję prezydenta – liczymy według obecnych progów.');
  } else if (d.forma === 'liniowy') {
    zwrot = odliczenie * p.liniowy;
  } else {
    zwrot = odliczenie * (d.stawkaRyczaltu ?? 12) / 100;
    uwagi.push('Na ryczałcie wpłaty na IKZE odliczasz od przychodu, więc zwrot to wpłata × twoja stawka ryczałtu.');
  }
  if (nadwyzka > 0) uwagi.push(`Wpłata przekracza limit ${lim.toLocaleString('pl-PL')} zł – nadwyżki ${nadwyzka.toLocaleString('pl-PL')} zł nie odliczysz, instytucja powinna ją zwrócić.`);
  zwrot = Math.round(zwrot * 100) / 100;
  return { limit: lim, odliczenie, nadwyzka, zwrot, stawkaEfektywna: odliczenie > 0 ? zwrot / odliczenie : 0, uwagi };
}

export type CoZeZwrotem = 'ike' | 'konto' | 'wydaje';
export interface DaneDlugie {
  /** wpłata roczna na IKZE */
  wplata: number;
  lata: number;
  /** stopa zwrotu rocznie, % */
  stopa: number;
  /** efektywna stawka zwrotu podatku (0–1) */
  stawkaZwrotu: number;
  zwrot: CoZeZwrotem;
  /** krańcowa stawka PIT – do zwrotu przed 65 lat */
  stawkaKrancowa?: number;
}

/** Wpłaty na początku roku, zwrot podatku rok później (po rozliczeniu PIT), inwestowany na IKE albo zwykłym koncie. */
export function dlugoterminowo(d: DaneDlugie) {
  const r = d.stopa / 100;
  let ikze = 0, zwroty = 0, zwrotyKoszt = 0, ike = 0, konto = 0, kontoKoszt = 0, wplaty = 0, ulga = 0;
  const tab: { rok: number; ikze: number; zwroty: number }[] = [];
  for (let t = 1; t <= d.lata; t++) {
    ikze += d.wplata; ike += d.wplata; konto += d.wplata; kontoKoszt += d.wplata; wplaty += d.wplata;
    if (t > 1) { const z = d.wplata * d.stawkaZwrotu; ulga += z; if (d.zwrot !== 'wydaje') { zwroty += z; zwrotyKoszt += z; } }
    ikze *= 1 + r; ike *= 1 + r; konto *= 1 + r; zwroty *= 1 + r;
    tab.push({ rok: t, ikze, zwroty });
  }
  // ostatni zwrot (za ostatni rok wpłat) dostajesz po zakończeniu – doliczamy bez inwestowania
  const ostatni = d.wplata * d.stawkaZwrotu; ulga += ostatni;
  const zwrotyNetto = d.zwrot === 'konto' ? zwroty - Math.max(0, zwroty - zwrotyKoszt) * BELKA : zwroty;
  const ryczalt = ikze * RYCZALT;
  const ikzeNetto = ikze - ryczalt;
  const razem = ikzeNetto + zwrotyNetto + (d.zwrot === 'wydaje' ? 0 : ostatni);
  const kontoNetto = konto - Math.max(0, konto - kontoKoszt) * BELKA;
  const zwrotPrzed65 = ikze * (1 - (d.stawkaKrancowa ?? 0.12)); // zwrot = przychód opodatkowany wg skali
  return { wplaty, ikze, ryczalt, ikzeNetto, ulga, zwroty: zwrotyNetto, razem, ike, kontoNetto, zwrotPrzed65, tab };
}
