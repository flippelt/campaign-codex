// Build-time OpenGraph image generation (astro-og-canvas). One PNG per page,
// served at /og/<key>.png. BaseLayout references these via the `ogKey` prop
// (default 'index'). Keys: 'index', each campaign id, and each entry
// '<campaign>/<type>/<slug>'. Respects the demo/main split via getCampaigns().
//
// Cards are themed per campaign (see ogPalette / OG_THEME_COLORS in lib/themes).
// Fonts: the library's default (Noto Sans latin, fetched + cached at build)
// covers Portuguese diacritics, so we don't ship a TTF.
import { OGImageRoute } from 'astro-og-canvas'
import { getCampaigns, getEntries, parseEntryId } from '../../lib/codex'
import { ogPalette } from '../../lib/themes'

interface OGPage {
  title: string
  description: string
  theme?: string
}

const pages: Record<string, OGPage> = {
  index: { title: 'Campaign Codex', description: 'Wiki de campanhas de RPG' }
}

for (const c of await getCampaigns()) {
  pages[c.id] = {
    title: c.data.name,
    description: c.data.summary ?? 'Campaign Codex',
    theme: c.data.theme
  }
  for (const e of await getEntries(c.id)) {
    const { type, slug } = parseEntryId(e.id)
    pages[`${c.id}/${type}/${slug}`] = {
      title: e.data.title,
      description: e.data.summary ?? c.data.name,
      theme: c.data.theme
    }
  }
}

export const { getStaticPaths, GET } = await OGImageRoute({
  // astro-og-canvas ≥0.12 infers the route param from the filename
  // (`[...route].ts` → `route`); the old `param` option was removed.
  pages,
  getImageOptions: (_path, page: OGPage) => {
    const c = ogPalette(page.theme)
    return {
      title: page.title,
      description: page.description,
      bgGradient: [c.from, c.to],
      border: { color: c.border, width: 12, side: 'inline-start' },
      padding: 70,
      font: {
        title: { color: c.title, size: 66, lineHeight: 1.1 },
        description: { color: c.body, size: 32, lineHeight: 1.3 }
      }
    }
  }
})
