import { describe, expect, it } from 'vitest';
import { lot, oblicz, parsujInflacje, porownaj, stopa, TYPY, wykupPoLatach } from '../src/lib/obligacje';

const z = (inflacja: number | number[], ref = 3.75, ike = false) => ({ inflacja: Array.isArray(inflacja) ? inflacja : [inflacja], ref, ike });
const suma = (fl: { kwota: number }[]) => Math.round(fl.reduce((s, p) => s + p.kwota, 0) * 100) / 100;

describe('obligacje – parametry z listów emisyjnych', () => {
  it('oferta: pierwsze oprocentowanie, marże, opłaty', () => {
    expect([TYPY.EDO.pierwsza, TYPY.EDO.marza, TYPY.EDO.oplata]).toEqual([5.35, 2, 3]);
    expect([TYPY.COI.pierwsza, TYPY.COI.marza, TYPY.COI.oplata]).toEqual([4.75, 1.5, 2]);
    expect([TYPY.TOS.pierwsza, TYPY.TOS.oplata, TYPY.ROR.oplata, TYPY.DOR.oplata]).toEqual([4.4, 1, 0.5, 0.7]);
    expect([TYPY.ROS.oplata, TYPY.ROD.oplata, TYPY.ROD.marza]).toEqual([2, 3, 2.5]);
  });
  it('oprocentowanie od 2. okresu: inflacja + marża, stopa NBP + marża', () => {
    expect(stopa('EDO', 2, z(3))).toBe(5);
    expect(stopa('EDO', 3, z([3.5, 2]))).toBe(4);
    expect(stopa('EDO', 2, z(-1))).toBe(2); // ujemna inflacja = 0
    expect(stopa('DOR', 2, z(3))).toBeCloseTo(3.9, 9);
    expect(stopa('TOS', 3, z(9))).toBe(4.4);
  });
});

describe('obligacje – wykup w terminie', () => {
  it('EDO 10 000 zł na 10 lat przy inflacji 2,5%: 15 656 zł brutto, 14 581,36 zł netto', () => {
    const w = oblicz({ sym: 'EDO', kwota: 10000, H: 120, z: z(2.5) });
    expect([w.odsetki, w.podatek, w.koniec]).toEqual([5656, 1074.64, 14581.36]);
  });
  it('COI: odsetki co roku, podatek od każdej wypłaty', () => {
    const w = oblicz({ sym: 'COI', kwota: 10000, H: 48, z: z(3) });
    expect(w.koniec).toBe(11478.25);
    expect(w.przeplywy.filter((p) => p.opis === 'odsetki')).toHaveLength(3);
  });
  it('OTS: 100,50 zł za obligację po 3 miesiącach', () => {
    expect(suma(lot('OTS', 1, 0, 3, z(3)))).toBe(100.4); // 0,50 zł odsetek − 0,10 zł podatku
  });
  it('ROR: 12 wypłat odsetek co miesiąc', () => {
    expect(lot('ROR', 100, 0, 12, z(3))).toHaveLength(12);
  });
  it('IKE – bez podatku Belki', () => {
    expect(oblicz({ sym: 'EDO', kwota: 10000, H: 120, z: z(2.5, 3.75, true) }).koniec).toBe(15656);
  });
});

describe('obligacje – przedterminowy wykup', () => {
  it('EDO 10 000 zł po 5 latach przy inflacji 3%: 12 029,05 zł (opłata 3 zł/szt.)', () => {
    const w = oblicz({ sym: 'EDO', kwota: 10000, H: 60, z: z(3) });
    expect(w.koniec).toBe(12029.05);
    expect(w.oplaty).toBe(300);
  });
  it('EDO po miesiącu: opłata nie wyższa niż narosłe odsetki – zwrot 100 zł', () => {
    const [p] = lot('EDO', 1, 0, 1, z(3));
    expect(p.kwota).toBe(100);
    expect(p.oplata).toBeCloseTo(p.odsetki, 2);
  });
  it('COI w 2. roku: opłata 2 zł pobierana w pełnej wysokości, nawet poniżej 100 zł', () => {
    const fl = lot('COI', 1, 0, 13, z(3));
    expect(fl.at(-1)!.kwota).toBe(98.38);
  });
  it('TOS po 18 miesiącach', () => {
    expect(suma(lot('TOS', 1, 0, 18, z(3)))).toBe(104.61);
  });
  it('OTS przed terminem – bez odsetek i bez opłaty', () => {
    expect(suma(lot('OTS', 1, 0, 2, z(3)))).toBe(100);
  });
  it('tabela „gdybyś wykupił” – ostatni rok bez opłaty', () => {
    const t = wykupPoLatach('EDO', z(3));
    expect(t).toHaveLength(10);
    expect(t[4].netto).toBe(120.29);
    expect(t[9].oplata).toBe(0);
  });
});

describe('obligacje – zamiana, zakupy co miesiąc, porównanie', () => {
  it('TOS na 5 lat: wykup po 3 latach i zamiana po 99,90 zł', () => {
    const w = oblicz({ sym: 'TOS', kwota: 10000, H: 60, z: z(3) });
    expect(w.przeplywy.some((p) => p.opis.startsWith('zamiana'))).toBe(true);
    expect(w.koniec).toBeGreaterThan(11500);
  });
  it('ROS nie podlega zamianie – po 6 latach gotówka czeka', () => {
    const a = oblicz({ sym: 'ROS', kwota: 10000, H: 72, z: z(3) }).koniec;
    expect(oblicz({ sym: 'ROS', kwota: 10000, H: 120, z: z(3) }).koniec).toBe(a);
  });
  it('dokupowanie 500 zł co miesiąc', () => {
    const w = oblicz({ sym: 'EDO', kwota: 0, H: 120, miesiecznie: 500, z: z(3) });
    expect(w.kupiono).toBe(595);
    expect(w.stopaNetto).toBeGreaterThan(0.035);
  });
  it('kwota niepodzielna przez 100 – reszta zostaje', () => {
    const w = oblicz({ sym: 'EDO', kwota: 1050, H: 120, z: z(3) });
    expect(w.kupiono).toBe(10);
    expect(w.uwagi.some((u) => u.includes('50'))).toBe(true);
  });
  it('porównanie na 3 miesiące: najlepsze OTS, na 10 lat – EDO (bez rodzinnych)', () => {
    expect(porownaj({ kwota: 10000, H: 3, z: z(3) })[0].sym).toBe('OTS');
    expect(porownaj({ kwota: 10000, H: 120, z: z(3) })[0].sym).toBe('EDO');
    expect(porownaj({ kwota: 10000, H: 120, z: z(3) }, true)[0].sym).toBe('ROD');
  });
  it('inflacja z listy', () => {
    expect(parsujInflacje('3,5; 3 / 2,5')).toEqual([3.5, 3, 2.5]);
  });
});
