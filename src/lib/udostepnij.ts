// Wspólna obsługa formularzy kalkulatorów: odczyt parametrów z URL, „Udostępnij” i „Kopiuj wynik”.
export function podlaczKalkulator(form: HTMLFormElement, przelicz: () => void) {
  const pola = () => Array.from(form.elements).filter(
    (el): el is HTMLInputElement | HTMLSelectElement => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && !!el.name,
  );
  const params = new URLSearchParams(location.search);
  for (const el of pola()) {
    const v = params.get(el.name);
    if (v === null) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v === '1';
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
    for (const el of pola()) p.set(el.name, el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value);
    const url = `${location.origin}${location.pathname}?${p}`;
    if (navigator.share) { try { await navigator.share({ title: document.title, url }); return; } catch { /* anulowano */ } }
    await navigator.clipboard?.writeText(url);
    komunikat('Link do wyliczenia skopiowany');
  });
  ramka?.querySelector('[data-kopiuj]')?.addEventListener('click', async () => {
    const wynik = ramka.querySelector<HTMLElement>('[data-wynik]');
    if (!wynik) return;
    const tekst = Array.from(wynik.querySelectorAll('dt')).map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`).join('\n');
    await navigator.clipboard?.writeText(`${tekst}\n${location.origin}${location.pathname}`);
    komunikat('Wynik skopiowany');
  });
  przelicz();
}
