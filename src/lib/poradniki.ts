// Pomocnicze dla poradników: czas czytania i nazwy działów.
export const DZIALY: Record<string, string> = { praca: 'Praca i płace', firma: 'Firma i podatki', kredyty: 'Kredyty i leasing', oszczedzanie: 'Oszczędzanie i inwestycje' };
/** Minuty czytania przy ~200 słowach na minutę (tabele liczone jak tekst). */
export const czasCzytania = (body = '') => Math.max(1, Math.round(body.replace(/^---[\s\S]*?---/, '').split(/\s+/).filter(Boolean).length / 200));
