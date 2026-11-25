// Procent składany – symulacja miesiąc po miesiącu z kapitalizacją co 1/365, 1, 3, 6, 12 miesięcy albo ciągłą,
// regularnymi wpłatami/wypłatami (z indeksacją), podatkiem Belki liczonym na 4 sposoby, inflacją i trybem „cel”.
import ike from '../data/ike-ikze.json';

export type Kapitalizacja = 'ciagla' | 'dzienna' | 'miesieczna' | 'kwartalna' | 'polroczna' | 'roczna';
export type Podatek = 'kapitalizacja' | 'koniec' | 'brak' | 'ikze';
export type Czestotliwosc = 1 | 3 | 12; // wpłata co ile miesięcy

export const BELKA = 0.19;
export const RYCZALT_IKZE = ike.ryczaltIkze / 100;
export const LIMITY = ike.lata as Record<string, { ike: number; ikze: number; ikzeJdg: number }>;

export const KAPITALIZACJE: [Kapitalizacja, string][] = [
  ['miesieczna', 'miesięczna'], ['kwartalna', 'kwartalna'], ['polroczna', 'półroczna'], ['roczna', 'roczna'], ['dzienna', 'dzienna'], ['ciagla', 'ciągła'],
];
const OKRES: Record<Kapitalizacja, number> = { ciagla: 0, dzienna: 0, miesieczna: 1, kwartalna: 3, polroczna: 6, roczna: 12 };

export interface DaneProcentu {
  kapital: number;
  /** regularna kwota: dodatnia = wpłata, ujemna = wypłata */
  wplata?: number;
  co?: Czestotliwosc;
  /** wpłata na początku okresu (true) czy na końcu */
  poczatek?: boolean;
  /** coroczny wzrost wpłat, % */
  wzrostWplat?: number;
  /** stopa roczna, % */
  stopa: number;
  lata: number;
  kapitalizacja?: Kapitalizacja;
  podatek?: Podatek;
  inflacja?: number;
}

export interface Rok { rok: number; wplaty: number; odsetki: number; podatek: number; saldo: number; realnie: number }

/** Stopa efektywna roczna (EAR) dla danej kapitalizacji. */
export function stopaEfektywna(stopa: number, k: Kapitalizacja): number {
  const r = stopa / 100;
  if (k === 'ciagla') return Math.exp(r) - 1;
  if (k === 'dzienna') return Math.pow(1 + r / 365, 365) - 1;
  const n = 12 / OKRES[k];
  return Math.pow(1 + r / n, n) - 1;
}

export function oblicz(d: DaneProcentu) {
  const k = d.kapitalizacja ?? 'miesieczna';
  const pod = d.podatek ?? 'kapitalizacja';
  const co = d.co ?? 1;
  const r = d.stopa / 100;
  const miesiecy = Math.max(1, Math.round(d.lata * 12));
  // wzrost w ciągu miesiąca przy kapitalizacji częstszej niż miesięczna
  const czynnikMies = k === 'ciagla' ? Math.exp(r / 12) : k === 'dzienna' ? Math.pow(1 + r / 365, 365 / 12) : 1 + r / 12;
  const okres = OKRES[k] || 1;
  const infl = (d.inflacja ?? 0) / 100;

  // koszt = wpłacony kapitał jeszcze nie wypłacony (do podatku od zysku przy wypłacie)
  let saldo = d.kapital, naliczone = 0, wplaty = d.kapital, koszt = d.kapital, odsetki = 0, podatek = 0, wyplacono = 0;
  let wplataTeraz = d.wplata ?? 0;
  const lata: Rok[] = [];
  let rW = 0, rO = 0, rP = 0;
  const wplac = () => {
    const x = wplataTeraz;
    if (x >= 0) { saldo += x; wplaty += x; koszt += x; rW += x; return; }
    const g = Math.min(-x, Math.max(0, saldo)); // wypłata brutto z konta
    if (g <= 0) return;
    const czescZysku = saldo > 0 ? Math.max(0, (saldo - koszt) / saldo) : 0;
    const t = pod === 'koniec' ? g * czescZysku * BELKA : pod === 'ikze' ? g * RYCZALT_IKZE : 0;
    koszt = Math.max(0, koszt - g * (1 - czescZysku));
    saldo -= g; podatek += t; rP += t; wyplacono += g - t;
  };
  for (let m = 1; m <= miesiecy; m++) {
    if (m > 1 && (m - 1) % 12 === 0) wplataTeraz *= 1 + (d.wzrostWplat ?? 0) / 100;
    const termin = (m - 1) % co === 0; // wpłata w tym okresie
    if (termin && d.poczatek) wplac();
    // odsetki za miesiąc (przy kapitalizacji rzadszej – proste, dopisywane na koniec okresu)
    const o = saldo * (czynnikMies - 1);
    naliczone += o;
    if (m % okres === 0 || m === miesiecy) {
      const p = pod === 'kapitalizacja' ? naliczone * BELKA : 0;
      saldo += naliczone - p; odsetki += naliczone; podatek += p; rO += naliczone; rP += p; naliczone = 0;
    }
    if (m % co === 0 && !d.poczatek) wplac();
    if (m % 12 === 0 || m === miesiecy) {
      const t = m / 12;
      lata.push({ rok: Math.ceil(t), wplaty: rW, odsetki: rO, podatek: rP, saldo, realnie: saldo / Math.pow(1 + infl, t) });
      rW = rO = rP = 0;
    }
  }
  // podatek płacony na końcu
  let podatekKoniec = 0;
  if (pod === 'koniec' && saldo > koszt) podatekKoniec = (saldo - koszt) * BELKA;
  if (pod === 'ikze') podatekKoniec = Math.max(0, saldo) * RYCZALT_IKZE;
  const koncowy = saldo - podatekKoniec;
  podatek += podatekKoniec;
  const lat = miesiecy / 12;
  const realnie = koncowy / Math.pow(1 + infl, lat);
  const ear = stopaEfektywna(d.stopa, k);
  const podwojenie = ear > 0 ? Math.log(2) / Math.log(1 + ear) : Infinity;

  const uwagi: string[] = [];
  const rocznie = (d.wplata ?? 0) * (12 / co);
  const limit = LIMITY[String(new Date().getFullYear())] ?? Object.values(LIMITY).at(-1)!;
  if (pod === 'brak' && d.kapital + rocznie > limit.ike) uwagi.push(`Na IKE wpłacisz najwyżej ${limit.ike.toLocaleString('pl-PL')} zł w roku – nadwyżki nie obejmie zwolnienie z podatku.`);
  if (pod === 'ikze' && d.kapital + rocznie > limit.ikzeJdg) uwagi.push(`Limit IKZE to ${limit.ikze.toLocaleString('pl-PL')} zł w roku (${limit.ikzeJdg.toLocaleString('pl-PL')} zł przy działalności gospodarczej).`);
  if (pod === 'ikze') uwagi.push('IKZE: przy wypłacie po 65. roku życia płacisz 10% ryczałtu od całej kwoty, ale wpłaty co roku odliczasz od dochodu w PIT – ta ulga nie jest wliczona w wynik.');
  if (pod === 'koniec') uwagi.push('Podatek płacony dopiero przy sprzedaży (np. fundusz albo ETF akumulujący) – do tego czasu pracuje cały zysk, dlatego wynik jest wyższy niż przy podatku od każdej kapitalizacji.');
  if (wyplacono > 0 && saldo <= 0.005) uwagi.push('Wypłaty wyczerpały kapitał przed końcem okresu.');

  return {
    koncowy, wplaty, wyplacono, odsetki, podatek, zysk: koncowy - wplaty + wyplacono, realnie, ear, podwojenie,
    regula72: d.stopa > 0 ? 72 / d.stopa : Infinity, lat, lata, uwagi,
  };
}
export type WynikProcentu = ReturnType<typeof oblicz>;

/** Ile wpłacać (co `co` miesięcy), żeby osiągnąć cel netto. */
export function wplataNaCel(cel: number, d: Omit<DaneProcentu, 'wplata'>): number {
  if (oblicz({ ...d, wplata: 0 }).koncowy >= cel) return 0;
  let lo = 0, hi = Math.max(100, cel);
  while (oblicz({ ...d, wplata: hi }).koncowy < cel && hi < 1e12) hi *= 2;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (oblicz({ ...d, wplata: m }).koncowy >= cel) hi = m; else lo = m; }
  return Math.ceil(hi * 100) / 100;
}

/** Po ilu miesiącach kapitał netto osiągnie cel (null, gdy nie w 100 lat). */
export function miesiecyDoCelu(cel: number, d: Omit<DaneProcentu, 'lata'>): number | null {
  const ok = (m: number) => oblicz({ ...d, lata: m / 12 }).koncowy >= cel;
  if (!ok(1200)) return null;
  let lo = 0, hi = 1200; // przy wpłatach ≥ 0 i stopie ≥ 0 wynik rośnie z czasem
  while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (ok(m)) hi = m; else lo = m; }
  return hi;
}
