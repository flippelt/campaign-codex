import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import { THEME_IDS } from './lib/themes'

// THEME_IDS is the single source of truth (src/lib/themes.ts); palettes/fonts
// live in src/styles/themes.css keyed by the same data-theme id.
export { THEME_IDS }

// One file per campaign: src/content/campaigns/<id>.md
const campaigns = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/campaigns' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      theme: z.enum(THEME_IDS).default('fantasy'),
      emoji: z.string().default('📖'),
      summary: z.string().optional(),
      // Hero cover. `cover` is a passthrough string (/public path or URL);
      // `coverArt` is a local raster (./cover.jpg) imported + optimized
      // (AVIF/WebP, responsive) via <Image>. coverArt wins when both are set.
      cover: z.string().optional(),
      coverArt: image().optional(),
      order: z.number().default(0),
      // Marks a campaign as a shared demo/showcase campaign. demo:true hides it
      // from the build — used by the private repo (contracodex) to keep the
      // demo campaigns off its site. This public repo leaves its own campaigns
      // unflagged, so its main build IS the public demo.
      demo: z.boolean().default(false)
    })
})

// Every other page is an "entry" filed under a campaign and a type:
//   src/content/entries/<campaign>/<type>/<slug>.md
// campaign + type are derived from the folder path (see src/lib/codex.ts),
// so authoring is just: drop a markdown file in the right folder.
const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entries' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      emoji: z.string().optional(),
      summary: z.string().optional(),
      tags: z.array(z.string()).default([]),
      // optional "stat line" fields shown on cards / entry headers
      status: z.string().optional(), // alive · dead · unknown · active ...
      faction: z.string().optional(),
      role: z.string().optional(),
      location: z.string().optional(),
      // in-world date (events). Accept a quoted string or an unquoted YAML
      // date; normalize a real date to YYYY-MM-DD so authors needn't quote.
      date: z
        .union([z.string(), z.date()])
        .transform((v) => (typeof v === 'string' ? v : v.toISOString().slice(0, 10)))
        .optional(),
      // `image` is a passthrough string (e.g. /maps/x.svg, https://…) rendered as
      // a plain <img>. `art` is a local raster (./portrait.jpg) imported +
      // optimized (AVIF/WebP, responsive) via <Image>. art wins when both set.
      image: z.string().optional(),
      art: image().optional(),
      order: z.number().default(0),
      draft: z.boolean().default(false)
    })
})

export const collections = { campaigns, entries }
