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

export const THEME_LABELS: Record<string, { label: string; emoji: string }> = {
  'sci-fi': { label: 'Sci-Fi', emoji: '🚀' },
  fantasy: { label: 'Fantasia', emoji: '⚔️' },
  cyberpunk: { label: 'Cyberpunk', emoji: '🌃' },
  fallout: { label: 'Fallout', emoji: '☢️' },
  warhammer: { label: 'Warhammer 40K', emoji: '💀' }
}

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

// The Pages build runs with `--mode demo`: only campaigns opted in with
// `demo: true` are published there. Every other build shows everything.
export const IS_DEMO = import.meta.env.MODE === 'demo'

export async function getCampaigns(): Promise<Campaign[]> {
  const all = await getCollection('campaigns')
  return all
    .filter((c) => !IS_DEMO || c.data.demo)
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
    .sort(
      (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title)
    )
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
