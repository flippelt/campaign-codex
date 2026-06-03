import { getCollection, type CollectionEntry } from 'astro:content'

export type Campaign = CollectionEntry<'campaigns'>
export type Entry = CollectionEntry<'entries'>

// Content types. The key is also the folder name under entries/<campaign>/.
export const TYPES = {
  lore: { label: 'Lore & História', emoji: '📜', singular: 'lore' },
  npcs: { label: 'NPCs', emoji: '🧠', singular: 'NPC' },
  characters: { label: 'Personagens', emoji: '🎭', singular: 'personagem' },
  events: { label: 'Acontecimentos', emoji: '⚡', singular: 'evento' },
  maps: { label: 'Mapas & Locais', emoji: '🗺️', singular: 'mapa' }
} as const

export type TypeKey = keyof typeof TYPES
export const TYPE_KEYS = Object.keys(TYPES) as TypeKey[]
export const isTypeKey = (s: string): s is TypeKey => s in TYPES

// Theme display metadata lives in one place (src/lib/themes.ts).
export { THEME_LABELS } from './themes'

// Prefix an internal path with the configured build base (so links work
// under a GitHub Pages subpath as well as the domain root).
export function withBase(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return base + (path.startsWith('/') ? path : '/' + path)
}

// Resolve an image/asset path: external URLs and data URIs pass through;
// site-relative paths get the build base prefix.
export function asset(path?: string): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path
  return withBase(path)
}

// entries/<campaign>/<type>/<slug...> — derive the parts from the id.
export function parseEntryId(id: string) {
  const parts = id.split('/')
  return {
    campaign: parts[0] ?? '',
    type: parts[1] ?? '',
    slug: parts.slice(2).join('/')
  }
}

// URL for an entry, e.g. /nostromo/npcs/ash/
export function entryHref(entry: Entry) {
  const { campaign, type, slug } = parseEntryId(entry.id)
  return `/${campaign}/${type}/${slug}/`
}

const visible = (e: Entry) => import.meta.env.DEV || !e.data.draft

// The Pages build runs with `--mode demo`: it publishes ONLY the campaigns
// opted in with `demo: true`. The main build (Netlify) is the inverse — it
// publishes everything EXCEPT the demo campaigns, so the two deploys show
// disjoint sets and the demo campaigns never appear on the main site.
export const IS_DEMO = import.meta.env.MODE === 'demo'

export async function getCampaigns(): Promise<Campaign[]> {
  const all = await getCollection('campaigns')
  return all
    .filter((c) => (IS_DEMO ? c.data.demo : !c.data.demo))
    .sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name))
}

// Campaign ids visible in the current build (used to gate entry pages).
export async function allowedCampaignIds(): Promise<Set<string>> {
  return new Set((await getCampaigns()).map((c) => c.id))
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return (await getCollection('campaigns')).find((c) => c.id === id)
}

export async function getEntries(campaign: string, type?: string): Promise<Entry[]> {
  const all = await getCollection('entries', visible)
  return all
    .filter((e) => {
      const p = parseEntryId(e.id)
      return p.campaign === campaign && (!type || p.type === type)
    })
    .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title))
}

// URL-safe slug for a tag (preserves diacritics-stripped lowercase form).
export function tagSlug(tag: string): string {
  return tag
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// All unique tags for a campaign, with counts and slugs, sorted by count desc.
export async function getTags(
  campaign: string
): Promise<{ tag: string; slug: string; count: number }[]> {
  const entries = await getEntries(campaign)
  const map = new Map<string, { tag: string; count: number }>()
  for (const e of entries) {
    for (const t of e.data.tags) {
      const slug = tagSlug(t)
      if (!slug) continue
      const cur = map.get(slug)
      if (cur) cur.count++
      else map.set(slug, { tag: t, count: 1 })
    }
  }
  return Array.from(map, ([slug, v]) => ({ slug, ...v })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
  )
}

// Entries in a campaign whose tags include the given slug.
export async function getEntriesByTag(campaign: string, slug: string): Promise<Entry[]> {
  return (await getEntries(campaign)).filter((e) => e.data.tags.some((t) => tagSlug(t) === slug))
}

// Find entries whose body links to `target`. Matches both relative forms an
// author would write (e.g. `(atisok/)` or `(../lore/x/)`) and the absolute
// `/<campaign>/<type>/<slug>/` form. Same-entry self-links are excluded.
export async function getBacklinks(target: Entry): Promise<Entry[]> {
  const { campaign, type, slug } = parseEntryId(target.id)
  const candidates = await getEntries(campaign)
  const abs = `/${campaign}/${type}/${slug}/`
  const slugTail = `${slug}/`
  const relFromType = `../${type}/${slug}/`
  const hits: Entry[] = []
  for (const e of candidates) {
    if (e.id === target.id) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: string = (e as any).body ?? ''
    if (!body) continue
    // Cheap textual probe: only inspect markdown link bodies `(...)`.
    const re = /\]\(([^)]+)\)/g
    let m: RegExpExecArray | null
    let matched = false
    while ((m = re.exec(body))) {
      const href = m[1].split(/\s/)[0] // drop optional "title"
      if (
        href === abs ||
        href === abs.replace(/\/$/, '') ||
        href === relFromType ||
        href === slugTail ||
        href.endsWith(abs) ||
        href.endsWith(relFromType)
      ) {
        matched = true
        break
      }
    }
    if (matched) hits.push(e)
  }
  return hits.sort((a, b) => a.data.title.localeCompare(b.data.title))
}

// Count entries per type for a campaign (for the nav + campaign home).
export async function typeCounts(campaign: string): Promise<Record<string, number>> {
  const entries = await getEntries(campaign)
  const counts: Record<string, number> = {}
  for (const k of TYPE_KEYS) counts[k] = 0
  for (const e of entries) {
    const { type } = parseEntryId(e.id)
    if (type in counts) counts[type]++
  }
  return counts
}
