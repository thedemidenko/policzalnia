// Zwolnienie lekarskie (L4): wynagrodzenie chorobowe (art. 92 KP) i zasiłek chorobowy (ustawa zasiłkowa, Dz.U. 2026 poz. 854).
// Pracownik: pierwsze 33 dni choroby w roku (14 dni od roku po 50. urodzinach) płaci pracodawca, potem ZUS. Zlecenie i JDG –
// zasiłek z ZUS od pierwszego dnia. Stawka 80%, 100% w ciąży, po wypadku w drodze do/z pracy i u dawców; od 2022 r. także
// w szpitalu 80% (uchylono 70%). Podstawa = przeciętne wynagrodzenie z 12 mies. (JDG – zadeklarowana podstawa) − 13,71%;
// za dzień 1/30. Okres zasiłkowy 182 dni (270 w ciąży i przy gruźlicy); okres wyczekiwania 30 dni (obowiązkowe) / 90 (dobrowolne).
export type Forma = 'uop' | 'zlecenie' | 'jdg';
export type Przyczyna = 'choroba' | 'ciaza' | 'wypadek' | 'dawca';
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const PROCENT: Record<Przyczyna, number> = { choroba: 80, ciaza: 100, wypadek: 100, dawca: 100 };

export interface DaneL4 {
  forma: Forma;
  brutto: number;
  dni: number;
  przyczyna?: Przyczyna;
  /** pracownik ukończył 50 lat przed bieżącym rokiem */
  po50?: boolean;
  /** dni L4 wcześniej w tym roku (pracownik) / w okresie zasiłkowym */
  wczesniej?: number;
  /** ubezpieczenie chorobowe trwa krócej niż okres wyczekiwania (30 / 90 dni) */
  krotko?: boolean;
}
export interface WynikL4 {
  podstawa: number;
  stawkaDzienna: number;
  procent: number;
  dniPracodawca: number;
  dniZus: number;
  dniBez: number;
  kwotaPracodawca: number;
  kwotaZus: number;
  razem: number;
  nettoMin: number;
  /** o ile mniej niż pensja za te dni (brutto) – tylko umowa o pracę */
  mniejNizPensja?: number;
  uwagi: string[];
  blad?: string;
}

export function obliczL4(x: DaneL4): WynikL4 {
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikL4 => ({ podstawa: 0, stawkaDzienna: 0, procent: 0, dniPracodawca: 0, dniZus: 0, dniBez: 0, kwotaPracodawca: 0, kwotaZus: 0, razem: 0, nettoMin: 0, uwagi, blad });
  if (!(x.brutto > 0)) return pusty(x.forma === 'jdg' ? 'Podaj podstawę składki chorobowej.' : 'Podaj wynagrodzenie brutto.');
  const dni = Math.max(0, Math.floor(x.dni));
  if (dni === 0) return pusty('Podaj liczbę dni zwolnienia.');
  const przyczyna = x.przyczyna ?? 'choroba';
  const procent = PROCENT[przyczyna];
  const podstawa = r2(x.brutto * (1 - 0.1371));
  const stawkaDzienna = r2(r2(podstawa / 30) * procent / 100);
  const wczesniej = Math.max(0, Math.floor(x.wczesniej ?? 0));

  if (x.krotko && przyczyna !== 'wypadek') {
    uwagi.push(`Zasiłek przysługuje dopiero po ${x.forma === 'uop' ? '30 dniach nieprzerwanego ubezpieczenia (umowa o pracę)' : '90 dniach dobrowolnego ubezpieczenia chorobowego'}. Wyjątki: wypadek w drodze do lub z pracy, absolwenci zgłoszeni do ubezpieczenia w ciągu 90 dni od ukończenia szkoły lub studiów oraz osoby z co najmniej 10-letnim wcześniejszym ubezpieczeniem obowiązkowym.`);
    return { ...pusty(''), blad: undefined, podstawa, stawkaDzienna, procent, dniBez: dni };
  }

  const maks = przyczyna === 'ciaza' ? 270 : 182;
  const platne = Math.max(0, Math.min(dni, maks - wczesniej));
  const dniBez = dni - platne;
  if (dniBez > 0) uwagi.push(`Okres zasiłkowy to ${maks} dni – za ${dniBez} dni po jego wyczerpaniu można wnioskować o świadczenie rehabilitacyjne.`);

  let dniPracodawca = 0;
  if (x.forma === 'uop') {
    const limit = x.po50 ? 14 : 33;
    dniPracodawca = Math.max(0, Math.min(platne, limit - wczesniej));
    if (platne > dniPracodawca) uwagi.push(`Pracodawca płaci wynagrodzenie chorobowe za pierwsze ${limit} dni choroby w roku – od ${limit + 1}. dnia zasiłek wypłaca ZUS (albo pracodawca w jego imieniu, jeśli zatrudnia ponad 20 osób).`);
  }
  const dniZus = platne - dniPracodawca;
  const kwotaPracodawca = r2(dniPracodawca * stawkaDzienna), kwotaZus = r2(dniZus * stawkaDzienna);
  const razem = r2(kwotaPracodawca + kwotaZus);
  const nettoMin = r2(razem - Math.round(razem * 0.12));
  const wynik: WynikL4 = { podstawa, stawkaDzienna, procent, dniPracodawca, dniZus, dniBez, kwotaPracodawca, kwotaZus, razem, nettoMin, uwagi };
  if (x.forma === 'uop') wynik.mniejNizPensja = r2(Math.max(0, (x.brutto / 30) * dni - razem));
  if (x.forma !== 'uop') uwagi.push('Na zleceniu i w działalności zasiłek przysługuje tylko przy opłacanej dobrowolnej składce chorobowej – od pierwszego dnia L4 wypłaca go ZUS.');
  return wynik;
}
