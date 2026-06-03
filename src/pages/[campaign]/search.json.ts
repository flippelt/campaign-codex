import type { APIRoute } from 'astro'
import {
  getCampaigns, getEntries, parseEntryId, TYPES, isTypeKey, entryHref, withBase
} from '../../lib/codex'

export async function getStaticPaths() {
  const campaigns = await getCampaigns()
  return campaigns.map((c) => ({ params: { campaign: c.id } }))
}

// Strip front matter, code fences and most markdown syntax so the search
// body is plain-text. Cheap & good enough for substring matching.
function plain(md: string): string {
  return md
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const GET: APIRoute = async ({ params }) => {
  const id = params.campaign!
  const entries = await getEntries(id)
  const items = entries.map((e) => {
    const { type, slug } = parseEntryId(e.id)
    const meta = isTypeKey(type) ? TYPES[type] : undefined
    return {
      id: e.id,
      slug,
      type,
      typeLabel: meta?.label ?? type,
      typeEmoji: meta?.emoji ?? '📄',
      title: e.data.title,
      emoji: e.data.emoji ?? meta?.emoji ?? '📄',
      summary: e.data.summary ?? '',
      tags: e.data.tags,
      body: plain((e as any).body ?? ''),
      href: withBase(entryHref(e))
    }
  })
  return new Response(JSON.stringify({ campaign: id, items }), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}
