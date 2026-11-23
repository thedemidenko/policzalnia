import { getCollection } from 'astro:content';

const SITE = 'https://policzalnia.pl';
const iso = (d?: Date) => (d ? `<lastmod>${d.toISOString().slice(0, 10)}</lastmod>` : '');

export async function GET() {
  const kalk = await getCollection('kalkulatory', (e) => !e.data.draft);
  const por = await getCollection('poradniki', (p) => !p.data.draft);
  const dzialy = await getCollection('dzialy');
  const strony = await getCollection('strony');
  const urls = [
    ['/', undefined],
    ...dzialy.map((d) => [`/${d.data.slug}/`, undefined]),
    ...kalk.map((e) => [`/${e.data.sekcja}/${e.data.slug}/`, e.data.updated]),
    ['/poradniki/', undefined],
    ...por.map((p) => [`/poradniki/${p.data.slug}/`, p.data.updated ?? p.data.date]),
    ...strony.map((s) => [`/${s.data.slug}/`, undefined]),
  ] as [string, Date | undefined][];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `<url><loc>${SITE}${u}</loc>${iso(d)}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
