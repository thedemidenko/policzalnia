import { getCollection } from 'astro:content';

const SITE = 'https://policzalnia.pl';
const iso = (d?: Date) => (d ? `<lastmod>${d.toISOString().slice(0, 10)}</lastmod>` : '');

export async function GET() {
  const kalk = await getCollection('kalkulatory', (e) => !e.data.draft);
  const por = await getCollection('poradniki', (p) => !p.data.draft);
  const dzialy = await getCollection('dzialy');
  const strony = await getCollection('strony');
  // lastmod listingów = najnowsza zmiana wśród stron, które na nich są
  const max = (ds: (Date | undefined)[]) => ds.filter((d): d is Date => !!d).sort((a, b) => +b - +a)[0];
  const datyPor = por.map((p) => p.data.updated ?? p.data.date);
  const urls = [
    ['/', max([...kalk.map((e) => e.data.updated), ...datyPor])],
    ...dzialy.map((d) => [`/${d.data.slug}/`, max(kalk.filter((e) => e.data.sekcja === d.data.slug).map((e) => e.data.updated))]),
    ...kalk.map((e) => [`/${e.data.sekcja}/${e.data.slug}/`, e.data.updated]),
    ['/poradniki/', max(datyPor)],
    ...por.map((p) => [`/poradniki/${p.data.slug}/`, p.data.updated ?? p.data.date]),
    ...strony.map((s) => [`/${s.data.slug}/`, undefined]),
  ] as [string, Date | undefined][];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `<url><loc>${SITE}${u}</loc>${iso(d)}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
