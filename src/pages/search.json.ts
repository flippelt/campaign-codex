import type { APIRoute } from 'astro'
import {
  getCampaigns,
  getEntries,
  parseEntryId,
  TYPES,
  isTypeKey,
  entryHref,
  withBase
} from '../lib/codex'

function plain(md: string): string {
  return md
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/[#>*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const GET: APIRoute = async () => {
  const campaigns = await getCampaigns()
  const items: unknown[] = []
  for (const c of campaigns) {
    const entries = await getEntries(c.id)
    for (const e of entries) {
      const { type, slug } = parseEntryId(e.id)
      const meta = isTypeKey(type) ? TYPES[type] : undefined
      items.push({
        id: e.id,
        slug,
        type,
        typeLabel: meta?.label ?? type,
        typeEmoji: meta?.emoji ?? '📄',
        campaign: c.id,
        campaignName: c.data.name,
        campaignEmoji: c.data.emoji,
        title: e.data.title,
        emoji: e.data.emoji ?? meta?.emoji ?? '📄',
        summary: e.data.summary ?? '',
        tags: e.data.tags,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: plain((e as any).body ?? ''),
        href: withBase(entryHref(e))
      })
    }
  }
  return new Response(JSON.stringify({ items }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}
