import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const kalkulatory = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/kalkulatory' }),
  schema: z.object({
    slug: z.string().optional(),
    title: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    kalkulator: z.enum(['vat', 'marza']),
    kategoria: z.string().default('Inne'),
    lead: z.string().optional(),
    faq: z
      .array(z.object({ pytanie: z.string(), odpowiedz: z.string() }))
      .default([]),
    draft: z.boolean().default(false),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { kalkulatory };
