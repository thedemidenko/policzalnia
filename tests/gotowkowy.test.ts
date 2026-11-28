import { describe, expect, it } from 'vitest';
import { oblicz, odsetkiMaksymalne, zwrotPrzySplacie } from '../src/lib/gotowkowy';

describe('kredyt gotówkowy – zgodnie z Bankier.pl (XI 2026, 20 000 zł na 48 mies., bez prowizji)', () => {
  it.each([
    [7.6, 484.51, 7.87], [7.69, 485.35, 7.97], [7.73, 485.73, 8.01], [7.75, 485.91, 8.03], [8.79, 495.71, 9.15],
  ])('oprocentowanie %s%% → rata %s zł, RRSO %s%%', (opr, rata, rrso) => {
    const w = oblicz({ kwota: 20000, miesiace: 48, oprocentowanie: opr });
    expect(w.rata).toBe(rata);
    expect(w.rrso).toBe(rrso);
  });
  it('100 000 zł na 60 mies. przy 7,6%: rata 2008,55 zł i łączny koszt ok. 20 513 zł (VeloBank w rankingu)', () => {
    const w = oblicz({ kwota: 100000, miesiace: 60, oprocentowanie: 7.6 });
    expect(w.rata).toBe(2008.55);
    expect(Math.abs(w.koszt - 20513)).toBeLessThan(2);
  });
});

describe('RRSO z prowizją – przykład Totalmoney (20 000 zł, 48 mies., 9,5%, prowizja 1,5%: RRSO 10,79%)', () => {
  it('różnica najwyżej 0,02 pp (zaokrąglenia)', () => {
    expect(Math.abs(oblicz({ kwota: 20000, miesiace: 48, oprocentowanie: 9.5, prowizja: 1.5, kredytowane: true }).rrso - 10.79)).toBeLessThanOrEqual(0.02);
  });
});

describe('koszty i limity ustawowe', () => {
  it('prowizja płatna z góry zmniejsza wypłatę i podnosi RRSO; kredytowana – zwiększa kapitał', () => {
    const z = oblicz({ kwota: 50000, miesiace: 60, oprocentowanie: 9, prowizja: 5 });
    const k = oblicz({ kwota: 50000, miesiace: 60, oprocentowanie: 9, prowizja: 5, kredytowane: true });
    expect(z.kapital).toBe(50000);
    expect(k.kapital).toBe(52500);
    expect(z.rrso).toBeGreaterThan(9.38);
    expect(k.rata).toBeGreaterThan(z.rata);
  });
  it('MPKK (art. 36a): 10% + 10% rocznie, najwyżej 45% kwoty', () => {
    expect(oblicz({ kwota: 10000, miesiace: 12, oprocentowanie: 10 }).mpkk).toBe(2000);
    expect(oblicz({ kwota: 10000, miesiace: 60, oprocentowanie: 10 }).mpkk).toBe(4500);
    const w = oblicz({ kwota: 10000, miesiace: 12, oprocentowanie: 10, prowizja: 15, ubezpieczenie: 1000 });
    expect(w.ponadLimit).toBe(500);
  });
  it('odsetki maksymalne: 2 × (stopa referencyjna 3,75% + 3,5 pp) = 14,5%', () => {
    expect(odsetkiMaksymalne('2026-11-28')).toBe(14.5);
  });
  it('wcześniejsza spłata: zwrot prowizji proporcjonalnie do skróconego okresu (art. 49)', () => {
    const x = { kwota: 30000, miesiace: 48, oprocentowanie: 9, prowizja: 8 };
    const w = oblicz(x);
    const z = zwrotPrzySplacie(x, w, 12);
    expect(z.zwrot).toBe(1800);
    expect(z.saldo).toBe(w.raty[11].saldo);
  });
});
