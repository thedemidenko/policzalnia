// Lista kluczy kalkulatorów. Nowy kalkulator: dodaj klucz tutaj, komponent w
// src/components/kalkulatory/ i wpis w mapie KOMPONENTY (src/components/Kalkulator.astro)
// oraz opcję w .pages.yml (test „rejestr” pilnuje zgodności).
export const KALKULATORY = ['vat', 'odsetki', 'odsetki-podatkowe', 'staz', 'urlop', 'delegacja', 'macierzynski', 'ekwiwalent', 'l4', 'dni-robocze', 'nadgodziny', 'dzielo', 'zlecenie', 'leasing', 'lokaty', 'nadplata', 'ppk', 'procent-skladany', 'obligacje', 'ike', 'inflacja', 'inwestycje', 'ikze'] as const;
export type KluczKalkulatora = (typeof KALKULATORY)[number];
