import { describe, expect, it } from 'vitest';
import { analiza, dzien33, koniecWypowiedzenia, opis } from '../src/lib/umowy-terminowe';

describe('umowy na czas określony – limit 33 miesięcy i 3 umów', () => {
  it('ciągłe umowy od 1.01.2024 – czas nieokreślony od 1.10.2026', () => {
    const a = analiza([{ od: '2024-01-01', do: '2024-12-31', typ: 'okreslony' }, { od: '2025-01-01', do: '2026-12-31', typ: 'okreslony' }], '2026-11-26');
    expect([a.d33, a.nieokreslonyOd, a.powod]).toEqual(['2026-09-30', '2026-10-01', 'okres']);
  });
  it('33 miesiące liczone kalendarzowo od 31 stycznia', () => {
    expect(dzien33([{ od: '2024-01-31', do: '2027-12-31' }])).toBe('2026-10-30');
  });
  it('czwarta umowa – czas nieokreślony od jej zawarcia, choć nie minęło 33 miesięcy', () => {
    const a = analiza([1, 4, 7, 10].map((m, i) => ({ od: `2024-${String(m).padStart(2, '0')}-01`, do: i < 3 ? `2024-${String(m + 2).padStart(2, '0')}-${m + 2 === 9 ? 30 : m + 2 === 6 ? 30 : 31}` : '2025-03-31', typ: 'okreslony' as const })), '2025-01-01');
    expect([a.nieokreslonyOd, a.powod]).toEqual(['2024-10-01', 'liczba']);
  });
  it('przerwa nie zeruje limitu (przykład PIP: 8 + 12 miesięcy)', () => {
    const a = analiza([{ od: '2022-01-01', do: '2022-08-31', typ: 'okreslony' }, { od: '2023-07-01', do: '2024-06-30', typ: 'okreslony' }], '2024-06-01');
    expect(opis(a.laczny)).toBe('1 rok 8 miesięcy');
    expect(a.pozostaloUmow).toBe(1);
  });
  it('ile może trwać kolejna umowa', () => {
    const a = analiza([{ od: '2024-03-01', do: '2025-02-28', typ: 'okreslony' }], '2025-02-01', '2025-03-01');
    expect(a.maksKoniec).toBe('2026-11-30');
    expect(a.brakuje).toEqual({ miesiace: 21, dni: 0 });
  });
  it('okres próbny i wyjątki nie wliczają się do limitu, ale próbny wlicza się do stażu', () => {
    const a = analiza([
      { od: '2023-01-15', do: '2023-04-14', typ: 'probny' },
      { od: '2023-04-15', do: '2026-04-14', typ: 'okreslony' },
      { od: '2024-02-01', do: '2025-01-31', typ: 'wyjatek' },
    ], '2026-01-10');
    expect(a.liczba).toBe(1);
    expect(a.nieokreslonyOd).toBe('2026-01-15');
    expect(opis(a.staz)).toBe('2 lata 11 miesięcy 27 dni');
  });
});

describe('okres wypowiedzenia', () => {
  it('według stażu u pracodawcy: 2 tygodnie, 1 miesiąc, 3 miesiące', () => {
    expect(analiza([{ od: '2026-08-01', do: '2027-07-31', typ: 'okreslony' }], '2026-11-26').okresWyp.opis).toBe('2 tygodnie');
    expect(analiza([{ od: '2026-01-01', do: '2027-07-31', typ: 'okreslony' }], '2026-11-26').okresWyp.opis).toBe('1 miesiąc');
    expect(analiza([{ od: '2023-01-01', typ: 'nieokreslony' }], '2026-11-26').okresWyp.opis).toBe('3 miesiące');
  });
  it('data wydłużenia okresu wypowiedzenia', () => {
    const a = analiza([{ od: '2026-08-01', do: '2028-07-31', typ: 'okreslony' }], '2026-11-26');
    expect([a.od1mies, a.od3mies]).toEqual(['2027-01-31', null]);
  });
  it('koniec okresu wypowiedzenia: tygodnie w sobotę, miesiące ostatniego dnia', () => {
    expect(koniecWypowiedzenia('2026-11-25', { tygodnie: 2 })).toBe('2026-12-12'); // środa
    expect(koniecWypowiedzenia('2026-11-28', { tygodnie: 2 })).toBe('2026-12-12'); // sobota
    expect(koniecWypowiedzenia('2026-11-26', { miesiace: 1 })).toBe('2026-12-31');
    expect(koniecWypowiedzenia('2026-11-30', { miesiace: 3 })).toBe('2027-02-28');
  });
});
