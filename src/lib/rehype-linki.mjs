// Linki zewnętrzne w treści Markdown: rel="nofollow noopener" i nowa karta (jak lista źródeł w Autor.astro).
// Linki wewnętrzne (/…, #…) i do policzalnia.pl zostają bez zmian.
export default function rehypeLinki() {
  const odwiedz = (n) => {
    if (n.type === 'element' && n.tagName === 'a') {
      const href = String(n.properties?.href ?? '');
      if (/^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?policzalnia\.pl/i.test(href)) {
        n.properties.rel = ['nofollow', 'noopener'];
        n.properties.target = '_blank';
      }
    }
    (n.children ?? []).forEach(odwiedz);
  };
  return (tree) => odwiedz(tree);
}
