// Tabele w treści Markdown opakowane w <div class="tabela-tresc"> – szeroka tabela przewija się w swojej ramce
// zamiast poszerzać stronę (na każdej szerokości ekranu).
export default function rehypeTabele() {
  const odwiedz = (n) => {
    (n.children ?? []).forEach((c, i) => {
      if (c.type === 'element' && c.tagName === 'table' && !String(c.properties?.className ?? '').includes('sr-only')) {
        n.children[i] = { type: 'element', tagName: 'div', properties: { className: ['tabela-tresc'] }, children: [c] };
      } else odwiedz(c);
    });
  };
  return (tree) => odwiedz(tree);
}
