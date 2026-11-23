import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KALKULATORY } from '../src/lib/rejestr';

describe('rejestr kalkulatorów', () => {
  const pagesYml = readFileSync('.pages.yml', 'utf8');
  const komponenty = readFileSync('src/components/Kalkulator.astro', 'utf8');
  for (const k of KALKULATORY) {
    it(`${k}: jest w .pages.yml`, () => expect(pagesYml).toContain(`value: ${k}`));
    it(`${k}: jest w mapie komponentów`, () => expect(komponenty).toMatch(new RegExp(`\\b${k}:`)));
  }
  it('każdy plik komponentu jest zarejestrowany', () => {
    const pliki = readdirSync('src/components/kalkulatory').map((f) => f.replace('.astro', '').toLowerCase());
    for (const p of pliki) expect(KALKULATORY.map((k) => k.replace(/-/g, ''))).toContain(p.replace(/-/g, ''));
  });
});
