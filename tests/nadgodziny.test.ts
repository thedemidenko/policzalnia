import { describe, expect, it } from 'vitest';
import { godzinyMiesiaca, obliczNadgodziny } from '../src/lib/nadgodziny';

describe('nadgodziny', () => {
  it('wymiar miesiąca z kalendarza', () => {
    expect(godzinyMiesiaca(2026, 7)).toBe(184);
    expect(godzinyMiesiaca(2026, 2)).toBe(160);
  });
  it('8800 zł, luty 2026 (160 h): 55 zł/h; 10 h z dodatkiem 50%', () => {
    const w = obliczNadgodziny({ rok: 2026, miesiac: 2, tryb: 'miesieczna', pensja: 8800, h50: 10 });
    expect(w.stawkaNormalna).toBe(55);
    expect(w.normalne).toBe(550);
    expect(w.dodatek50).toBe(275);
    expect(w.razem).toBe(825);
  });
  it('100% i dodatek nocny (płaca minimalna 4806 zł / 160 h × 20% = 6,01 zł)', () => {
    const w = obliczNadgodziny({ rok: 2026, miesiac: 2, tryb: 'miesieczna', pensja: 8800, h100: 4, hNoc: 4 });
    expect(w.dodatek100).toBe(220);
    expect(w.dodatekNocny).toBe(24.04);
    expect(w.razem).toBe(220 + 220 + 24.04);
  });
  it('stałe dodatki podnoszą normalne wynagrodzenie, nie podstawę dodatku; wariant 60%', () => {
    const a = obliczNadgodziny({ rok: 2026, miesiac: 2, tryb: 'miesieczna', pensja: 8000, dodatki: 800, h50: 2 });
    expect([a.stawkaNormalna, a.podstawaDodatku]).toEqual([55, 50]);
    const b = obliczNadgodziny({ rok: 2026, miesiac: 2, tryb: 'miesieczna', pensja: 8800, bez60: true, h50: 2 });
    expect(b.podstawaDodatku).toBe(33);
  });
  it('stawka godzinowa i czas wolny', () => {
    const w = obliczNadgodziny({ rok: 2026, miesiac: 7, tryb: 'godzinowa', stawka: 40, h50: 6, h100: 2 });
    expect(w.razem).toBe(40 * 8 + 120 + 80);
    expect([w.wolne1do1, w.wolneBezWniosku]).toEqual([8, 12]);
  });
  it('limit 150 godzin', () => {
    expect(obliczNadgodziny({ rok: 2026, miesiac: 7, tryb: 'godzinowa', stawka: 40, h50: 10, wczesniejWRoku: 145 }).uwagi.some((u) => u.includes('150'))).toBe(true);
  });
  it('pół etatu – wymiar 92 h w lipcu', () => {
    expect(obliczNadgodziny({ rok: 2026, miesiac: 7, tryb: 'miesieczna', pensja: 3000, etat: 0.5, h50: 1 }).wymiarGodzin).toBe(92);
  });
});
