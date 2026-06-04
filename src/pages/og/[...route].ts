// Build-time OpenGraph image generation (astro-og-canvas). One PNG per page,
// served at /og/<key>.png. BaseLayout references these via the `ogKey` prop
// (default 'index'). Keys: 'index', each campaign id, and each entry
// '<campaign>/<type>/<slug>'. Respects the demo/main split via getCampaigns().
//
// Fonts: the library's default (Noto Sans latin, fetched + cached at build)
// covers Portuguese diacritics, so we don't ship a TTF.
import { OGImageRoute } from 'astro-og-canvas'
import { getCampaigns, getEntries, parseEntryId } from '../../lib/codex'

interface OGPage {
  title: string
  description: string
}

const pages: Record<string, OGPage> = {
  index: { title: 'Campaign Codex', description: 'Wiki de campanhas de RPG' }
}

for (const c of await getCampaigns()) {
  pages[c.id] = { title: c.data.name, description: c.data.summary ?? 'Campaign Codex' }
  for (const e of await getEntries(c.id)) {
    const { type, slug } = parseEntryId(e.id)
    pages[`${c.id}/${type}/${slug}`] = {
      title: e.data.title,
      description: e.data.summary ?? c.data.name
    }
  }
}

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page: OGPage) => ({
    title: page.title,
    description: page.description,
    bgGradient: [
      [28, 23, 18],
      [12, 10, 8]
    ],
    border: { color: [227, 179, 65], width: 12, side: 'inline-start' },
    padding: 70,
    font: {
      title: { color: [241, 231, 214], size: 66, lineHeight: 1.1 },
      description: { color: [184, 169, 143], size: 32, lineHeight: 1.3 }
    }
  })
})
