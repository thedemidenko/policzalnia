const SITE = 'https://policzalnia.pl';
export const abs = (p: string) => new URL(p, SITE).href;

export const breadcrumbs = (sciezka: { nazwa: string; url: string }[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: sciezka.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.nazwa, item: abs(s.url) })),
});

export const faqPage = (faq: { pytanie: string; odpowiedz: string }[]) => faq.length ? ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.pytanie, acceptedAnswer: { '@type': 'Answer', text: f.odpowiedz } })),
}) : null;

export const graf = (...nodes: (object | null)[]) => ({ '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) });
