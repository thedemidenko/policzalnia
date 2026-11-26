import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { KALKULATORY } from './lib/rejestr';

export const SEKCJE = ['praca', 'firma', 'kredyty', 'oszczedzanie'] as const;

const zrodla = z.array(z.object({ nazwa: z.string(), url: z.string().url() })).default([]);
const faq = z.array(z.object({ pytanie: z.string(), odpowiedz: z.string() })).default([]);

const kalkulatory = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/kalkulatory' }),
  schema: z.object({
    slug: z.string(),
    sekcja: z.enum(SEKCJE),
    title: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    kalkulator: z.enum(KALKULATORY),
    nazwa_krotka: z.string().optional(),
    lead: z.string(),
    faq,
    powiazane: z.array(z.string()).default([]),
    poradniki: z.array(z.string()).default([]),
    zrodla,
    autor: reference('autorzy'),
    updated: z.coerce.date(),
    draft: z.boolean().default(true),
  }),
});

const dzialy = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/dzialy' }),
  schema: z.object({
    slug: z.enum(SEKCJE),
    title: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    lead: z.string(),
    kolejnosc: z.number().default(0),
  }),
});

const poradniki = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/poradniki' }),
  schema: ({ image }) => z.object({
    slug: z.string(),
    title: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    lead: z.string(),
    /** dział, do którego należy poradnik (kolor, filtr na liście) */
    sekcja: z.enum(SEKCJE),
    /** 3–5 najważniejszych faktów w ramce „W skrócie” */
    w_skrocie: z.array(z.string()).default([]),
    kalkulatory: z.array(z.string()).default([]),
    /** adresy innych poradników do „Czytaj też” (domyślnie z tego samego działu) */
    czytaj_tez: z.array(z.string()).default([]),
    /** okładka 16:9 (src/assets/poradniki/<slug>/), alt = tytuł */
    okladka: image().optional(),
    /** źródło zdjęć, np. „Freepik” – pokazywane pod okładką */
    zdjecia: z.string().optional(),
    faq,
    zrodla,
    autor: reference('autorzy'),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(true),
  }),
});

const strony = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/strony' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    stopka: z.boolean().default(true),
  }),
});

const autorzy = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/autorzy' }),
  schema: z.object({
    slug: z.string(),
    imie: z.string(),
    rola: z.string(),
    url: z.string().optional(),
  }),
});

export const collections = { kalkulatory, dzialy, poradniki, strony, autorzy };
