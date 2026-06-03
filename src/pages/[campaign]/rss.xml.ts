import type { APIRoute } from 'astro'
import {
  getCampaigns,
  getCampaign,
  getEntries,
  parseEntryId,
  TYPES,
  isTypeKey,
  entryHref,
  withBase
} from '../../lib/codex'

export async function getStaticPaths() {
  const campaigns = await getCampaigns()
  return campaigns.map((c) => ({ params: { campaign: c.id } }))
}

const xmlEscape = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!
  )

export const GET: APIRoute = async ({ params, site }) => {
  const id = params.campaign!
  const campaign = await getCampaign(id)
  if (!campaign) return new Response('Not found', { status: 404 })

  const entries = await getEntries(id)
  // Sort by in-world date (ISO) when present, then by title as fallback.
  const sorted = [...entries].sort((a, b) => {
    const ad = a.data.date ?? ''
    const bd = b.data.date ?? ''
    if (ad && bd) return bd.localeCompare(ad)
    if (ad) return -1
    if (bd) return 1
    return a.data.title.localeCompare(b.data.title)
  })

  const origin = site?.toString().replace(/\/$/, '') ?? ''
  const campaignUrl = origin + withBase(`/${id}/`)
  const feedUrl = origin + withBase(`/${id}/rss.xml`)

  const items = sorted
    .slice(0, 50)
    .map((e) => {
      const { type } = parseEntryId(e.id)
      const meta = isTypeKey(type) ? TYPES[type] : undefined
      const url = origin + withBase(entryHref(e))
      const cat = meta?.label ?? type
      return `    <item>
      <title>${xmlEscape(`${e.data.emoji ?? meta?.emoji ?? ''} ${e.data.title}`.trim())}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <category>${xmlEscape(cat)}</category>
      ${e.data.summary ? `<description>${xmlEscape(e.data.summary)}</description>` : ''}
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(`${campaign.data.emoji} ${campaign.data.name}`)} · Campaign Codex</title>
    <link>${xmlEscape(campaignUrl)}</link>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(campaign.data.summary ?? 'Wiki de campanha de RPG')}</description>
    <language>pt-br</language>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' }
  })
}
