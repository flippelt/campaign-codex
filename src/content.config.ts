import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

// THEMES — palettes/fonts live in src/styles/themes.css keyed by data-theme.
export const THEME_IDS = ['sci-fi', 'fantasy', 'cyberpunk', 'fallout', 'warhammer'] as const

// One file per campaign: src/content/campaigns/<id>.md
const campaigns = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/campaigns' }),
  schema: z.object({
    name: z.string(),
    theme: z.enum(THEME_IDS).default('fantasy'),
    emoji: z.string().default('📖'),
    summary: z.string().optional(),
    order: z.number().default(0),
    // Include this campaign in the public demo build (GitHub Pages). Your
    // private campaigns stay off the demo unless you opt them in.
    demo: z.boolean().default(false)
  })
})

// Every other page is an "entry" filed under a campaign and a type:
//   src/content/entries/<campaign>/<type>/<slug>.md
// campaign + type are derived from the folder path (see src/lib/codex.ts),
// so authoring is just: drop a markdown file in the right folder.
const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entries' }),
  schema: z.object({
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
    image: z.string().optional(), // portrait / map (URL or /public path)
    order: z.number().default(0),
    draft: z.boolean().default(false)
  })
})

export const collections = { campaigns, entries }
