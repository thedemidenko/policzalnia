// Wspólna obsługa formularzy kalkulatorów: parametry z URL, „Link do wyliczenia”, „Kopiuj wynik”, animacja liczb.
import { zl } from './format';

type Pole = HTMLInputElement | HTMLSelectElement;

export function podlaczKalkulator(form: HTMLFormElement, przelicz: () => void) {
  const pola = () => Array.from(form.elements).filter((el): el is Pole => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && !!el.name);
  const params = new URLSearchParams(location.search);
  for (const el of pola()) {
    const v = params.get(el.name);
    if (v === null) continue;
    if (el instanceof HTMLInputElement && el.type === 'radio') el.checked = el.value === v;
    else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v === '1';
    else el.value = v;
  }
  form.addEventListener('input', przelicz);
  form.addEventListener('change', przelicz);
  form.addEventListener('submit', (e) => e.preventDefault());

  const ramka = form.closest('.kalkulator');
  const komunikat = (t: string) => {
    const k = ramka?.querySelector<HTMLElement>('[data-komunikat]');
    if (!k) return;
    k.textContent = t;
    setTimeout(() => (k.textContent = ''), 2500);
  };
  ramka?.querySelector('[data-udostepnij]')?.addEventListener('click', async () => {
    const p = new URLSearchParams();
    for (const el of pola()) {
      if (el instanceof HTMLInputElement && el.type === 'radio') { if (el.checked) p.set(el.name, el.value); }
      else if (el instanceof HTMLInputElement && el.type === 'checkbox') p.set(el.name, el.checked ? '1' : '0');
      else p.set(el.name, el.value);
    }
    const url = `${location.origin}${location.pathname}?${p}`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: document.title, url }); return; } catch { /* anulowano */ } }
    await navigator.clipboard?.writeText(url);
    komunikat('✓ Link skopiowany');
  });
  ramka?.querySelector('[data-kopiuj]')?.addEventListener('click', async () => {
    const wynik = ramka.querySelector<HTMLElement>('[data-wynik]');
    if (!wynik) return;
    const linie = Array.from(wynik.querySelectorAll('dt')).map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
    const g = wynik.querySelector<HTMLElement>('[data-glowny]');
    if (g) linie.push(`${g.dataset.glowny}: ${g.dataset.wartosc}`);
    await navigator.clipboard?.writeText(`${linie.join('\n')}\n${location.origin}${location.pathname}`);
    komunikat('✓ Wynik skopiowany');
  });
  przelicz();
}

// Płynna zmiana kwoty (licznik), z poszanowaniem prefers-reduced-motion.
const animacje = new WeakMap<HTMLElement, number>();
export function ustawKwote(el: HTMLElement | null, wartosc: number, fmt: (n: number) => string = zl) {
  if (!el) return;
  const tekst = fmt(wartosc);
  if (el.dataset.glowny !== undefined) el.dataset.wartosc = tekst;
  const poprzednia = Number(el.dataset.n ?? NaN);
  el.dataset.n = String(wartosc);
  if (!Number.isFinite(poprzednia) || poprzednia === wartosc || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = tekst; return; }
  cancelAnimationFrame(animacje.get(el) ?? 0);
  const start = performance.now(), czas = 280;
  const krok = (t: number) => {
    const p = Math.min(1, (t - start) / czas), e = 1 - Math.pow(1 - p, 3);
    el.textContent = p < 1 ? fmt(poprzednia + (wartosc - poprzednia) * e) : tekst;
    if (p < 1) animacje.set(el, requestAnimationFrame(krok));
  };
  animacje.set(el, requestAnimationFrame(krok));
}
