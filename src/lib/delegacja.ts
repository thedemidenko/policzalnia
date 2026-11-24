// Delegacja krajowa: należności z tytułu podróży służbowej (rozporządzenie MPiPS z 29.01.2013, Dz.U. 2013 poz. 167 ze zm.).
// Dieta (§ 7): podróż ≤ 1 doby – < 8 h brak, 8–12 h 50%, > 12 h 100%; dłuższa – każda doba 100%, reszta ≤ 8 h 50%, > 8 h 100%.
// Posiłki zmniejszają dietę: śniadanie 25%, obiad 50%, kolacja 25% (liczone od pełnej diety). Nocleg (§ 8): rachunek do 20× diety
// za dobę hotelową, bez rachunku ryczałt 150% diety, gdy nocleg trwa co najmniej 6 h między 21 a 7. Komunikacja miejscowa (§ 9):
// 20% diety za każdą rozpoczętą dobę. Samochód prywatny (§ 3 ust. 4): km × stawka nie wyższa niż w rozporządzeniu MI.
import dane from '../data/delegacje.json';

export type Pojazd = 'brak' | 'do900' | 'pow900' | 'motocykl' | 'motorower';
export const POJAZDY: Record<Pojazd, string> = {
  brak: 'bez auta prywatnego', do900: 'auto do 900 cm³', pow900: 'auto pow. 900 cm³', motocykl: 'motocykl', motorower: 'motorower',
};
export type Nocleg = 'brak' | 'ryczalt' | 'hotel';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const CZAS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ms = (t: string) => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13), +t.slice(14, 16));
const H = 3_600_000;

export function stawkaDiety(data: string): number {
  let k = dane.dieta[0].kwota;
  for (const d of dane.dieta) if (d.od <= data) k = d.kwota;
  return k;
}
export function stawkaKm(pojazd: Exclude<Pojazd, 'brak'>, data: string): number {
  let s = dane.kilometrowka[0];
  for (const k of dane.kilometrowka) if (k.od <= data) s = k;
  return s[pojazd];
}

export interface DaneDelegacji {
  wyjazd: string;
  powrot: string;
  sniadania?: number;
  obiady?: number;
  kolacje?: number;
  nocleg?: Nocleg;
  /** liczba noclegów (domyślnie: noce z co najmniej 6 h między 21 a 7) */
  noce?: number;
  hotelKwota?: number;
  komunikacja?: boolean;
  pojazd?: Pojazd;
  km?: number;
  /** stawka za km ustalona przez pracodawcę (nie wyższa niż maksymalna) */
  stawkaKmFirmy?: number;
  bilety?: number;
  inne?: number;
  zaliczka?: number;
  /** dieta z regulaminu pracodawcy spoza budżetówki (nie niższa niż ustawowa) */
  dietaFirmy?: number;
}
export interface Pozycja { nazwa: string; opis: string; kwota: number }
export interface WynikDelegacji {
  godziny: number;
  pelneDoby: number;
  resztaGodzin: number;
  stawka: number;
  /** liczba diet (np. 1,5) przed potrąceniami */
  diety: number;
  dieta: number;
  potracenia: number;
  noceUprawnione: number;
  pozycje: Pozycja[];
  razem: number;
  doWyplaty: number;
  /** część diety ponad stawkę ustawową – przychód podlegający PIT i ZUS */
  nadwyzka: number;
  uwagi: string[];
  blad?: string;
}

/** Noce, w których podróż obejmuje co najmniej 6 godzin między 21:00 a 7:00 (§ 8 ust. 4). */
export function noceRyczaltowe(od: number, doT: number): number {
  let n = 0;
  for (let d = Date.UTC(new Date(od).getUTCFullYear(), new Date(od).getUTCMonth(), new Date(od).getUTCDate()) - 86_400_000; d <= doT; d += 86_400_000) {
    const a = d + 21 * H, b = d + 31 * H;
    if (Math.min(b, doT) - Math.max(a, od) >= 6 * H) n++;
  }
  return n;
}

export function obliczDelegacje(x: DaneDelegacji): WynikDelegacji {
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikDelegacji => ({ godziny: 0, pelneDoby: 0, resztaGodzin: 0, stawka: 45, diety: 0, dieta: 0, potracenia: 0, noceUprawnione: 0, pozycje: [], razem: 0, doWyplaty: 0, nadwyzka: 0, uwagi, blad });
  if (!CZAS.test(x.wyjazd) || !CZAS.test(x.powrot)) return pusty('Podaj datę i godzinę wyjazdu oraz powrotu.');
  const od = ms(x.wyjazd), doT = ms(x.powrot);
  if (doT <= od) return pusty('Powrót musi być później niż wyjazd.');

  const godziny = (doT - od) / H;
  const stawka = stawkaDiety(x.wyjazd.slice(0, 10));
  const p = dane.projekt;
  if (x.powrot.slice(0, 10) >= p.od) uwagi.push(`Projekt rozporządzenia podnosi dietę do ${p.kwota} zł od ${p.od.split('-').reverse().join('.')} – liczymy według stawki obowiązującej (${stawka} zł), dopóki zmiana nie zostanie ogłoszona.`);
  const dietaBaza = x.dietaFirmy && x.dietaFirmy > stawka ? x.dietaFirmy : stawka;
  if (x.dietaFirmy && x.dietaFirmy > 0 && x.dietaFirmy < stawka) uwagi.push(`Dieta w firmie nie może być niższa niż ${stawka} zł (art. 77⁵ § 4 KP) – przyjęliśmy ${stawka} zł.`);

  // liczba diet
  let pelneDoby = 0, reszta = godziny, diety = 0;
  if (godziny <= 24) {
    diety = godziny < 8 ? 0 : godziny <= 12 ? 0.5 : 1;
    pelneDoby = godziny === 24 ? 1 : 0; reszta = godziny === 24 ? 0 : godziny;
  } else {
    pelneDoby = Math.floor(godziny / 24 + 1e-9);
    reszta = r2(godziny - pelneDoby * 24);
    diety = pelneDoby + (reszta <= 0 ? 0 : reszta <= 8 ? 0.5 : 1);
  }
  const dietaBrutto = r2(diety * dietaBaza);
  const s = Math.max(0, x.sniadania ?? 0), o = Math.max(0, x.obiady ?? 0), k = Math.max(0, x.kolacje ?? 0);
  const potraceniaPelne = r2((0.25 * s + 0.5 * o + 0.25 * k) * dietaBaza);
  const potracenia = Math.min(potraceniaPelne, dietaBrutto);
  if (potraceniaPelne > dietaBrutto) uwagi.push('Zapewnione posiłki są warte więcej niż należna dieta – dieta wynosi 0 zł.');
  const dieta = r2(dietaBrutto - potracenia);
  // nadwyżka ponad dietę ustawową (zwolnienie z PIT – art. 21 ust. 1 pkt 16 lit. a)
  const dietaUstawowa = r2(Math.max(0, diety * stawka - Math.min(r2((0.25 * s + 0.5 * o + 0.25 * k) * stawka), diety * stawka)));
  const nadwyzka = r2(Math.max(0, dieta - dietaUstawowa));

  const pozycje: Pozycja[] = [];
  const zl = (n: number) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
  const opisDiet = godziny <= 24 ? `${diety === 0 ? 'poniżej 8 h' : diety === 0.5 ? '8–12 h – 50%' : 'ponad 12 h – 100%'}` : `${pelneDoby} ${pelneDoby === 1 ? 'doba' : 'doby'}${reszta > 0 ? ` + ${r2(reszta).toLocaleString('pl-PL')} h (${reszta <= 8 ? '50%' : '100%'})` : ''}`;
  pozycje.push({ nazwa: 'Dieta', opis: `${opisDiet} × ${zl(dietaBaza)}`, kwota: dietaBrutto });
  if (potracenia > 0) pozycje.push({ nazwa: 'Zapewnione posiłki', opis: [s && `${s} × śniadanie 25%`, o && `${o} × obiad 50%`, k && `${k} × kolacja 25%`].filter(Boolean).join(', '), kwota: -potracenia });

  // noclegi
  const noceUprawnione = noceRyczaltowe(od, doT);
  const rodzaj = x.nocleg ?? 'brak';
  const noce = x.noce !== undefined && x.noce >= 0 ? Math.floor(x.noce) : noceUprawnione;
  if (rodzaj === 'ryczalt' && noce > 0) {
    const n = Math.min(noce, noceUprawnione);
    if (noce > noceUprawnione) uwagi.push(`Ryczałt za nocleg przysługuje tylko za noce, w których nocleg trwał co najmniej 6 godzin między 21:00 a 7:00 – w tej podróży to ${noceUprawnione}.`);
    if (n > 0) pozycje.push({ nazwa: 'Ryczałt za nocleg', opis: `${n} × 150% diety (${zl(r2(1.5 * stawka))})`, kwota: r2(n * 1.5 * stawka) });
  } else if (rodzaj === 'hotel' && (x.hotelKwota ?? 0) > 0) {
    const limit = r2(Math.max(1, noce) * 20 * stawka), kw = r2(x.hotelKwota!);
    const zwrot = Math.min(kw, limit);
    pozycje.push({ nazwa: 'Hotel (rachunek)', opis: `limit ${zl(20 * stawka)} za dobę hotelową × ${Math.max(1, noce)}`, kwota: zwrot });
    if (kw > limit) uwagi.push(`Rachunek za hotel przekracza limit o ${zl(r2(kw - limit))}. Nadwyżkę pracodawca zwraca tylko, jeśli się na to zgodzi (§ 8 ust. 2).`);
  }

  // komunikacja miejscowa
  if (x.komunikacja) {
    const doby = Math.ceil(godziny / 24 - 1e-9);
    pozycje.push({ nazwa: 'Ryczałt na komunikację miejscową', opis: `${doby} × 20% diety (${zl(r2(0.2 * stawka))})`, kwota: r2(doby * 0.2 * stawka) });
  }

  // przejazd
  const pojazd = x.pojazd ?? 'brak';
  if (pojazd !== 'brak' && (x.km ?? 0) > 0) {
    const max = stawkaKm(pojazd, x.wyjazd.slice(0, 10));
    const st = x.stawkaKmFirmy && x.stawkaKmFirmy > 0 ? Math.min(x.stawkaKmFirmy, max) : max;
    if (x.stawkaKmFirmy && x.stawkaKmFirmy > max) uwagi.push(`Stawka za kilometr nie może przekroczyć ${zl(max)} – przyjęliśmy stawkę maksymalną.`);
    pozycje.push({ nazwa: 'Samochód prywatny', opis: `${x.km} km × ${zl(st)}`, kwota: r2(x.km! * st) });
  }
  if ((x.bilety ?? 0) > 0) pozycje.push({ nazwa: 'Bilety', opis: 'według biletów', kwota: r2(x.bilety!) });
  if ((x.inne ?? 0) > 0) pozycje.push({ nazwa: 'Inne wydatki', opis: 'parking, autostrada, bagaż…', kwota: r2(x.inne!) });

  const razem = r2(pozycje.reduce((a, q) => a + q.kwota, 0));
  const zaliczka = Math.max(0, x.zaliczka ?? 0);
  if (diety === 0) uwagi.push('Podróż krótsza niż 8 godzin – dieta nie przysługuje.');
  if (nadwyzka > 0) uwagi.push(`${zl(nadwyzka)} diety ponad stawkę ustawową to przychód – podlega PIT i składkom ZUS.`);
  return { godziny: r2(godziny), pelneDoby, resztaGodzin: reszta, stawka, diety, dieta, potracenia, noceUprawnione, pozycje, razem, doWyplaty: r2(razem - zaliczka), nadwyzka, uwagi };
}
