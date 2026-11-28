import { describe, expect, it } from 'vitest';
import { dalszeTrwanie, nettoEmerytury, obliczEmeryture, MINIMALNA } from '../src/lib/emerytura';

describe('tablica GUS (komunikat z 25.03.2026, od 1.04.2026)', () => {
  it('60 lat – 268,9 mies., 65 lat – 222,7 mies., 67 lat – 205,4 mies.', () => {
    expect(dalszeTrwanie(60)).toBe(268.9);
    expect(dalszeTrwanie(65)).toBe(222.7);
    expect(dalszeTrwanie(67)).toBe(205.4);
  });
});

describe('emerytura – wzór z art. 26 ustawy o emeryturach z FUS', () => {
  it('bez wzrostu i wydłużania: 7000 zł przez 40 lat → 7000 × 12 × 19,52% × 40 / 222,7 = 2945,09 zł', () => {
    const w = obliczEmeryture({ wiek: 25, wiekEmerytalny: 65, kobieta: false, podstawa: 7000, kapital: 0.0001, staz: 0, wzrost: 0, wydluzanie: 0 });
    expect(w.brutto).toBe(2945.09);
  });
  it('każdy rok dłużej podnosi emeryturę (więcej składek, krótszy okres wypłaty)', () => {
    const b = { wiek: 35, kobieta: true, podstawa: 7000, staz: 10, wzrost: 2 };
    const a = obliczEmeryture({ ...b, wiekEmerytalny: 60 }).brutto, c = obliczEmeryture({ ...b, wiekEmerytalny: 65 }).brutto;
    expect(c).toBeGreaterThan(a * 1.4);
  });
  it('najniższa emerytura przy stażu 20 lat (kobieta) i 25 lat (mężczyzna)', () => {
    const k = obliczEmeryture({ wiek: 55, wiekEmerytalny: 60, kobieta: true, podstawa: 3000, staz: 15, wzrost: 0 });
    expect(k.minimalnaGwarantowana).toBe(true);
    expect(k.brutto).toBe(MINIMALNA);
    const m = obliczEmeryture({ wiek: 55, wiekEmerytalny: 65, kobieta: false, podstawa: 3000, staz: 10, wzrost: 0 });
    expect(m.minimalnaGwarantowana).toBe(false);
    expect(m.brutto).toBeLessThan(MINIMALNA);
  });
  it('limit 30-krotności ogranicza składki przy bardzo wysokiej pensji', () => {
    const a = obliczEmeryture({ wiek: 40, wiekEmerytalny: 65, kobieta: false, podstawa: 30000, kapital: 1, staz: 0, wzrost: 0, wydluzanie: 0 });
    const b = obliczEmeryture({ wiek: 40, wiekEmerytalny: 65, kobieta: false, podstawa: 23550, kapital: 1, staz: 0, wzrost: 0, wydluzanie: 0 });
    expect(Math.abs(a.brutto - b.brutto)).toBeLessThan(0.01);
  });
});

describe('emerytura netto', () => {
  it('do 2500 zł bez podatku (kwota zmniejszająca 300 zł), tylko zdrowotna 9%', () => {
    expect(nettoEmerytury(2500)).toBe(2275);
    expect(nettoEmerytury(MINIMALNA)).toBe(Math.round(MINIMALNA * 0.91 * 100) / 100);
  });
  it('4000 zł: zdrowotna 360 zł, zaliczka 180 zł → 3460 zł', () => {
    expect(nettoEmerytury(4000)).toBe(3460);
  });
});
