import { describe, expect, it } from 'vitest';
import { normalizuj, obliczStaz, opisLMD, roznica } from '../src/lib/staz';

const lmd = (lata: number, miesiace: number, dni: number) => ({ lata, miesiace, dni });

describe('roznica – okres od–do włącznie', () => {
  it('pełny rok, miesiąc, dni', () => {
    expect(roznica('2020-01-01', '2020-12-31')).toEqual(lmd(1, 0, 0));
    expect(roznica('2021-03-15', '2021-04-14')).toEqual(lmd(0, 1, 0));
    expect(roznica('2021-03-15', '2021-03-20')).toEqual(lmd(0, 0, 6));
    expect(roznica('2024-02-01', '2024-02-29')).toEqual(lmd(0, 1, 0));
    expect(roznica('2023-01-31', '2023-02-27')).toEqual(lmd(0, 0, 28));
  });
  it('przeniesienie 30 dni → miesiąc, 12 miesięcy → rok', () => {
    expect(normalizuj(lmd(1, 11, 65))).toEqual(lmd(2, 1, 5));
  });
});

describe('obliczStaz', () => {
  it('okres trwający: staż na dziś i data 26 dni urlopu', () => {
    const w = obliczStaz([{ od: '2020-01-01' }], '2026-11-24');
    expect(w.laczny).toEqual(lmd(6, 10, 24));
    expect(w.wymiarUrlopu).toBe(20);
    expect(w.dataProgu).toBe('2029-12-31');
  });
  it('sumowanie dni z kilku okresów', () => {
    const w = obliczStaz([{ od: '2018-01-01', do: '2018-01-20' }, { od: '2019-02-01', do: '2019-02-15' }], '2026-11-24');
    expect(w.laczny).toEqual(lmd(0, 1, 5));
    expect(w.dniLaczny).toBe(35);
    expect(w.dataProgu).toBeUndefined();
    expect(w.doProgu).toEqual(lmd(9, 10, 25));
  });
  it('nakładające się okresy liczone raz; porównanie z samą umową o pracę', () => {
    const w = obliczStaz([
      { od: '2015-01-01', do: '2017-12-31', rodzaj: 'uop' },
      { od: '2017-06-01', do: '2019-05-31', rodzaj: 'jdg' },
    ], '2026-11-24');
    expect(w.laczny).toEqual(lmd(4, 5, 0));
    expect(w.tylkoUop).toEqual(lmd(3, 0, 0));
    expect(w.nakladanie).toBe(true);
    expect(w.maInneOkresy).toBe(true);
  });
  it('studia dają 8 lat stażu urlopowego', () => {
    const w = obliczStaz([{ od: '2024-10-01', do: '2026-09-30' }], '2026-11-24', 'wyzsza');
    expect(w.urlopowy).toEqual(lmd(10, 0, 0));
    expect(w.wymiarUrlopu).toBe(26);
  });
  it('praca w czasie studiów: nauka + praca po dyplomie, jeśli korzystniejsze', () => {
    const w = obliczStaz([{ od: '2010-10-01', do: '2015-09-30' }], '2026-11-24', 'wyzsza', '2014-06-30');
    expect(w.laczny).toEqual(lmd(5, 0, 0));
    expect(w.urlopowy).toEqual(lmd(9, 3, 0));
  });
  it('praca w czasie szkoły: liczy się sama praca, gdy daje więcej', () => {
    const w = obliczStaz([{ od: '2005-09-01', do: '2011-08-31' }], '2026-11-24', 'zasadnicza2', '2008-05-31');
    expect(w.urlopowy).toEqual(lmd(6, 0, 0));
    expect(w.naukaPominieta).toBe(true);
  });
  it('data progu z nauką i trwającym okresem', () => {
    const w = obliczStaz([{ od: '2022-07-01' }], '2026-11-24', 'liceum');
    expect(w.urlopowy).toEqual(lmd(8, 4, 24));
    expect(w.dataProgu).toBe('2028-06-30');
  });
  it('błędy', () => {
    expect(obliczStaz([], '2026-11-24').blad).toBeTruthy();
    expect(obliczStaz([{ od: '2027-01-01' }], '2026-11-24').blad).toMatch(/po dniu/);
  });
  it('opis z odmianą', () => {
    expect(opisLMD(lmd(1, 2, 5))).toBe('1 rok, 2 miesiące, 5 dni');
    expect(opisLMD(lmd(12, 1, 22))).toBe('12 lat, 1 miesiąc, 22 dni');
    expect(opisLMD(lmd(22, 0, 1))).toBe('22 lata, 0 miesięcy, 1 dzień');
  });
});
