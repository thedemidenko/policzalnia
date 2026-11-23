import { describe, expect, it } from 'vitest';
import stawki from '../src/data/stawki.json';
import stopy from '../src/data/stopy-nbp.json';

const r2 = (n: number) => Math.round(n * 100) / 100;

describe('stawki.json – spójność z opublikowanymi kwotami', () => {
  it('podstawa ZUS JDG 2027 = 60% prognozowanego', () => expect(r2(stawki.lata['2027'].prognozowane_przecietne.wartosc * 0.6)).toBe(6019.8));
  it('limit 30-krotności 2027', () => expect(stawki.lata['2027'].prognozowane_przecietne.wartosc * 30).toBe(stawki.lata['2027'].limit_30_krotnosci.wartosc));
  it('limit 30-krotności 2026', () => expect(stawki.lata['2026'].prognozowane_przecietne.wartosc * 30).toBe(stawki.lata['2026'].limit_30_krotnosci.wartosc));
  it('min. zdrowotna JDG 2026 = 432,54 zł', () => expect(r2(stawki.lata['2026'].placa_minimalna.wartosc * 0.09)).toBe(432.54));
  it('wariant PIT 2027 musi zostać wybrany po decyzji prezydenta (przypomnienie od 28.11.2026)', () => {
    const p = stawki.lata['2027'].pit;
    if (new Date() >= new Date('2026-11-28')) expect(p.wariant).not.toBe('do_decyzji');
  });
});

describe('stopy NBP', () => {
  it('daty rosnąco', () => {
    const d = stopy.zmiany.map((z) => z.od);
    expect([...d].sort()).toEqual(d);
  });
  it('lombardowa = referencyjna + 0,5 pp (od 2020-03-18)', () => {
    for (const z of stopy.zmiany.filter((z) => z.od >= '2020-03-18')) expect(r2(z.lomb - z.ref)).toBe(0.5);
  });
});
