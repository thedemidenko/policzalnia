// Nadpłata kredytu – symulacja miesiąc po miesiącu: raty równe/malejące, nadpłata jednorazowa i cykliczna,
// skutek: skrócenie okresu, obniżenie raty albo „mix” (obniżenie raty + nadpłacanie różnicą do pierwotnej raty),
// zmiana oprocentowania w trakcie, prowizja, porównanie z inwestowaniem tych samych pieniędzy.
// Prawo: art. 39–40 ustawy o kredycie hipotecznym (Dz.U. 2025 poz. 720), art. 48–50 ustawy o kredycie konsumenckim (Dz.U. 2025 poz. 1362).
import { r2 } from './format';

export type Raty = 'rowne' | 'malejace';
export type Skutek = 'okres' | 'rata' | 'mix';

export interface Nadplaty {
  /** jednorazowa: kwota i miesiąc (1 = przy najbliższej racie) */
  jednorazowa?: number;
  miesiacJednorazowej?: number;
  /** cykliczna: kwota, co ile miesięcy, od którego miesiąca, ile razy (0 = do końca) */
  cykliczna?: number;
  coIle?: number;
  odMiesiaca?: number;
  ileRazy?: number;
}

export interface DaneNadplaty extends Nadplaty {
  saldo: number;
  /** oprocentowanie roczne, % */
  stopa: number;
  /** liczba pozostałych rat */
  rat: number;
  raty?: Raty;
  skutek?: Skutek;
  /** zmiana oprocentowania od miesiąca */
  nowaStopa?: number;
  odMiesiacaStopa?: number;
  /** prowizja od nadpłaty, % – pobierana przez pierwsze prowizjaMiesiecy miesięcy */
  prowizja?: number;
  prowizjaMiesiecy?: number;
}

export interface Miesiac { nr: number; rata: number; odsetki: number; kapital: number; nadplata: number; prowizja: number; saldo: number }

export const rataRowna = (S: number, r: number, n: number) => (n <= 0 ? S : Math.abs(r) < 1e-12 ? S / n : (S * r) / (1 - Math.pow(1 + r, -n)));
/** ile rat przy racie R spłaci saldo S */
export function ileRat(S: number, r: number, R: number): number {
  if (S <= 0) return 0;
  if (Math.abs(r) < 1e-12) return Math.ceil(S / R - 1e-9);
  if (R <= S * r) return Infinity;
  return Math.ceil(-Math.log(1 - (S * r) / R) / Math.log(1 + r) - 1e-9);
}

function nadplataW(m: number, d: Nadplaty): number {
  let x = 0;
  if ((d.jednorazowa ?? 0) > 0 && m === Math.max(1, d.miesiacJednorazowej ?? 1)) x += d.jednorazowa!;
  const c = d.cykliczna ?? 0, co = Math.max(1, Math.round(d.coIle ?? 1)), od = Math.max(1, Math.round(d.odMiesiaca ?? 1));
  if (c > 0 && m >= od && (m - od) % co === 0) {
    const ktora = (m - od) / co + 1;
    if (!d.ileRazy || ktora <= d.ileRazy) x += c;
  }
  return x;
}

/** Symulacja spłaty. bezNadplat = scenariusz bazowy. */
export function symuluj(d: DaneNadplaty, bezNadplat = false) {
  const raty = d.raty ?? 'rowne';
  const skutek = d.skutek ?? 'okres';
  let S = r2(d.saldo);
  let nPozostalo = Math.max(1, Math.round(d.rat));
  let r = d.stopa / 1200;
  const rataPocz = r2(raty === 'rowne' ? rataRowna(S, r, nPozostalo) : S / nPozostalo + S * r);
  let R = r2(rataRowna(S, r, nPozostalo));
  let C = S / nPozostalo; // część kapitałowa przy ratach malejących
  const harm: Miesiac[] = [];
  let m = 0;
  while (S > 0.005 && m < 1200) {
    m++;
    if (d.nowaStopa !== undefined && d.odMiesiacaStopa && m === Math.max(1, d.odMiesiacaStopa) && d.nowaStopa !== d.stopa) {
      r = d.nowaStopa / 1200;
      if (raty === 'rowne') R = r2(rataRowna(S, r, nPozostalo)); // bank przelicza ratę na pozostały okres
    }
    const odsetki = r2(S * r);
    let kapital = raty === 'rowne' ? r2(R - odsetki) : r2(C);
    if (kapital >= S || nPozostalo <= 1) kapital = S;
    S = r2(S - kapital);
    nPozostalo--;
    let nad = 0, prow = 0;
    if (!bezNadplat && S > 0) {
      nad = nadplataW(m, d);
      if (skutek === 'mix') nad += Math.max(0, rataPocz - r2(kapital + odsetki)); // dopłata różnicy do pierwotnej raty
      nad = r2(Math.min(nad, S));
      if (nad > 0) {
        if ((d.prowizja ?? 0) > 0 && m <= (d.prowizjaMiesiecy ?? 0)) prow = r2((nad * d.prowizja!) / 100);
        S = r2(S - nad);
        if (S > 0) {
          if (skutek === 'okres') {
            if (raty === 'rowne') nPozostalo = ileRat(S, r, R);
            else nPozostalo = Math.ceil(S / C - 1e-9);
          } else {
            if (raty === 'rowne') R = r2(rataRowna(S, r, nPozostalo));
            else C = S / nPozostalo;
          }
        }
      }
    }
    harm.push({ nr: m, rata: r2(kapital + odsetki), odsetki, kapital, nadplata: nad, prowizja: prow, saldo: S });
    if (S > 0 && nPozostalo <= 0) nPozostalo = 1;
  }
  const odsetki = r2(harm.reduce((s, x) => s + x.odsetki, 0));
  const nadplaty = r2(harm.reduce((s, x) => s + x.nadplata, 0));
  const prowizje = r2(harm.reduce((s, x) => s + x.prowizja, 0));
  const pierwszaPo = harm.find((x) => x.nadplata > 0);
  const rataPo = pierwszaPo ? harm[pierwszaPo.nr]?.rata ?? 0 : rataPocz;
  return { harm, odsetki, nadplaty, prowizje, rat: harm.length, rataPocz, rataPo, ostatniaRata: harm.at(-1)?.rata ?? 0 };
}

export function obliczNadplate(d: DaneNadplaty, inwestycja?: { stopa: number; belka: boolean }) {
  const baza = symuluj(d, true);
  const wynik = symuluj(d);
  const warianty = (['okres', 'rata', 'mix'] as Skutek[]).map((s) => {
    const w = s === (d.skutek ?? 'okres') ? wynik : symuluj({ ...d, skutek: s });
    return { skutek: s, odsetki: w.odsetki, oszczednosc: r2(baza.odsetki - w.odsetki - w.prowizje), rat: w.rat, rataPo: w.rataPo, nadplaty: w.nadplaty };
  });
  const oszczednosc = r2(baza.odsetki - wynik.odsetki - wynik.prowizje);
  const skrocenie = baza.rat - wynik.rat;

  // nadpłata czy inwestowanie: te same miesięczne wydatki w obu scenariuszach, różnicę inwestujemy do końca pierwotnego okresu
  let inw: { wartosc: number; lepsze: 'nadplata' | 'inwestycja'; roznica: number } | null = null;
  if (inwestycja && inwestycja.stopa > 0) {
    const rn = (inwestycja.stopa / 100) * (inwestycja.belka ? 0.81 : 1) / 12;
    let konto = 0; // >0: przewaga scenariusza „inwestuję zamiast nadpłacać”
    for (let i = 0; i < baza.rat; i++) {
      const wyd = (x?: Miesiac) => (x ? x.rata + x.nadplata + x.prowizja : 0);
      konto = konto * (1 + rn) + (wyd(wynik.harm[i]) - wyd(baza.harm[i]));
    }
    inw = { wartosc: r2(konto), lepsze: konto > 0 ? 'inwestycja' : 'nadplata', roznica: r2(Math.abs(konto)) };
  }

  // podsumowanie roczne
  const lata: { rok: number; raty: number; odsetki: number; nadplaty: number; saldo: number }[] = [];
  for (const x of wynik.harm) {
    const i = Math.ceil(x.nr / 12) - 1;
    lata[i] ??= { rok: i + 1, raty: 0, odsetki: 0, nadplaty: 0, saldo: 0 };
    lata[i].raty = r2(lata[i].raty + x.rata); lata[i].odsetki = r2(lata[i].odsetki + x.odsetki);
    lata[i].nadplaty = r2(lata[i].nadplaty + x.nadplata); lata[i].saldo = x.saldo;
  }

  const uwagi: string[] = [];
  if (wynik.nadplaty === 0) uwagi.push('Wpisz kwotę nadpłaty – jednorazowej albo cyklicznej.');
  if ((d.skutek ?? 'okres') === 'mix') uwagi.push('Strategia mix: po każdej nadpłacie rata spada, a różnicę do pierwotnej raty nadpłacasz co miesiąc. Dzięki temu masz niższą ratę obowiązkową i prawie taki sam efekt jak przy skróceniu okresu.');
  if (inw && inw.lepsze === 'inwestycja') uwagi.push('Przy tej stopie zwrotu inwestowanie wychodzi lepiej niż nadpłata – ale zysk z inwestycji nie jest pewny, a oszczędność na odsetkach jest.');
  return { baza, wynik, warianty, oszczednosc, skrocenie, inwestycja: inw, lata, uwagi };
}
export type WynikNadplaty = ReturnType<typeof obliczNadplate>;

/** Saldo kredytu po spłaceniu k rat (do trybu „znam kwotę kredytu”). */
export function saldoPo(kwota: number, stopa: number, rat: number, k: number, raty: Raty = 'rowne'): number {
  const s = symuluj({ saldo: kwota, stopa, rat, raty }, true);
  return k <= 0 ? kwota : s.harm[Math.min(k, s.harm.length) - 1]?.saldo ?? 0;
}

export const opisMiesiecy = (n: number) => {
  const l = Math.floor(n / 12), m = n % 12;
  const lat = l === 1 ? 'rok' : l % 10 >= 2 && l % 10 <= 4 && (l % 100 < 10 || l % 100 >= 20) ? 'lata' : 'lat';
  const mies = m === 1 ? 'miesiąc' : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 10 || m % 100 >= 20) ? 'miesiące' : 'miesięcy';
  return [l ? `${l} ${lat}` : '', m ? `${m} ${mies}` : ''].filter(Boolean).join(' ') || '0 miesięcy';
};
