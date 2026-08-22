// Client-safe recap helpers. No DOM, no astro:content — this module is imported
// from the /recap/ page script and must stay runnable in the browser.

export const TYPES = {
  lore: { label: 'Lore & História', emoji: '📜' },
  npcs: { label: 'NPCs', emoji: '🧠' },
  characters: { label: 'Personagens', emoji: '🎭' },
  events: { label: 'Acontecimentos', emoji: '⚡' },
  maps: { label: 'Mapas & Locais', emoji: '🗺️' }
} as const

export type RecapType = keyof typeof TYPES
export const TYPE_KEYS = Object.keys(TYPES) as RecapType[]
export const isRecapType = (s: string): s is RecapType => s in TYPES

export interface RecapEntry {
  campaign: string
  type: RecapType
  slug: string
  title: string
  emoji?: string
  summary?: string
  tags: string[]
  status?: string
  faction?: string
  role?: string
  location?: string
  date?: string
  order?: number
  draft?: boolean
  body: string
}

export interface RecapFile extends RecapEntry {
  relativePath: string
}

export interface RecapDefaults {
  campaign: string
  date?: string
  location?: string
}

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function recapPath(campaign: string, type: RecapType, slug: string): string {
  return `src/content/entries/${campaign}/${type}/${slug}.md`
}

// Quote a YAML plain scalar when an unquoted value would be misparsed
// (colon, comment hash, flow indicators, booleans, numbers, leading markers).
function yamlScalar(value: string): string {
  const collapsed = value.replace(/\s*\r?\n\s*/g, ' ').trim()
  if (collapsed === '') return '""'
  const needsQuotes =
    /[:#{}[\],&*!|>'"%@`\\]/.test(collapsed) ||
    /^\s|\s$/.test(collapsed) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(collapsed) ||
    /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(collapsed) ||
    /^(0x|0o|0b)/i.test(collapsed) ||
    /^[-?:&*!|>@`]/.test(collapsed)
  if (!needsQuotes) return collapsed
  return `"${collapsed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function yamlTags(tags: string[]): string {
  return `[${tags.map(yamlScalar).join(', ')}]`
}

function fmLine(key: string, value: string | number | boolean | undefined): string | null {
  if (value === undefined) return null
  if (typeof value === 'string') {
    if (value.trim() === '') return null
    return `${key}: ${yamlScalar(value)}`
  }
  return `${key}: ${value}`
}

export function renderEntryMarkdown(entry: RecapEntry): string {
  const order = entry.order ?? 0
  const lines = [
    fmLine('title', entry.title),
    fmLine('emoji', entry.emoji),
    fmLine('summary', entry.summary),
    `tags: ${yamlTags(entry.tags ?? [])}`,
    fmLine('status', entry.status),
    fmLine('faction', entry.faction),
    fmLine('role', entry.role),
    fmLine('location', entry.location),
    fmLine('date', entry.date),
    `order: ${order}`,
    entry.draft ? 'draft: true' : null
  ].filter((l): l is string => l !== null)

  const body = (entry.body ?? '').replace(/^\n+/, '').replace(/\s+$/, '')
  return `---\n${lines.join('\n')}\n---\n${body ? `\n${body}\n` : ''}`
}

export function buildRecapFile(entry: RecapEntry): RecapFile {
  const campaign = slugify(entry.campaign) || 'campanha'
  const slug = slugify(entry.slug || entry.title) || 'entrada'
  const type: RecapType = isRecapType(entry.type) ? entry.type : 'events'
  return {
    ...entry,
    campaign,
    type,
    slug,
    tags: entry.tags ?? [],
    emoji: entry.emoji || TYPES[type].emoji,
    relativePath: recapPath(campaign, type, slug)
  }
}

// ── Session-notes parser ──────────────────────────────────────────────────
// Heuristic (deliberately loose — post-session notes are messy):
//
// 1. Split the text into a header (everything before the first section) and
//    named sections. A section heading is a line that is only a type keyword,
//    with or without markdown heading markers / trailing colon. Keywords
//    (case-insensitive, accents stripped):
//      NPCs / NPC              → npcs
//      Personagens / PCs       → characters
//      Lore / História         → lore
//      Eventos / Acontecimentos→ events
//      Mapas / Locais          → maps
//
// 2. Header:
//    - `Data:` / `Date:`, `Local:` / `Location:` fill those fields.
//    - `Tags: a, b` plus hashtags like `#foo` (not markdown `# headings`)
//      are collected onto the main event.
//    - The first non-empty, non-meta line can be the session title (used
//      for the main `events` file). A markdown `# Title` counts. A long
//      first paragraph is treated as body, not a title.
//    - Remaining unlabeled body → one `events` entry (the session recap).
//
// 3. Inside NPC / character / map (and lore/event) sections, list items
//      - Name: text
//      - **Name** — text
//    become one stub file each (title=Name, summary/body=text). Empty
//    sections are skipped. Leftover prose in lore → one lore file;
//    leftover prose in events is appended to the main recap.
//
// 4. Defaults.date / defaults.location apply to files that didn't set them.

const SECTION_ALIASES: Record<string, RecapType> = {
  lore: 'lore',
  historia: 'lore',
  npc: 'npcs',
  npcs: 'npcs',
  personagem: 'characters',
  personagens: 'characters',
  pc: 'characters',
  pcs: 'characters',
  character: 'characters',
  characters: 'characters',
  evento: 'events',
  eventos: 'events',
  acontecimento: 'events',
  acontecimentos: 'events',
  event: 'events',
  events: 'events',
  mapa: 'maps',
  mapas: 'maps',
  locais: 'maps',
  map: 'maps',
  maps: 'maps',
  locations: 'maps'
}

function foldKey(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function matchSectionHeading(line: string): RecapType | null {
  // Only a heading when the line is the keyword itself (optional `#`, bold,
  // trailing colon). `Local: Pedravale` is metadata, not a maps section —
  // `local` is intentionally not an alias; `Locais:` is.
  const trimmed = line.trim()
  if (!trimmed) return null
  const stripped = trimmed
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/^__(.+)__$/, '$1')
    .trim()
  const key = foldKey(stripped.replace(/:$/, '').trim())
  return SECTION_ALIASES[key] ?? null
}

function matchMeta(line: string): { key: 'date' | 'location' | 'tags'; value: string } | null {
  const m = line.trim().match(/^(data|date|local|location|tags)\s*:\s*(.+)$/i)
  if (!m) return null
  const k = m[1].toLowerCase()
  const value = m[2].trim()
  if (!value) return null
  if (k === 'data' || k === 'date') return { key: 'date', value }
  if (k === 'local' || k === 'location') return { key: 'location', value }
  return { key: 'tags', value }
}

function splitTags(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean)
}

function collectHashtags(text: string): string[] {
  const tags: string[] = []
  // `#tag` as a word token. Markdown headings are `# Title` (space after #)
  // and do not match. `##` headings also fail the letter-class capture.
  const re = /(?:^|[^\p{L}\p{N}_-])#([\p{L}\p{N}_-]{2,})/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) tags.push(m[1])
  return tags
}

function parseListItem(line: string): { name: string; text: string } | null {
  const m = line.match(/^\s*[-*+]\s+(.+)$/)
  if (!m) return null
  const rest = m[1].trim()
  const bold = rest.match(/^\*\*(.+?)\*\*\s*(?:[:—–]|-{1,2})\s*(.*)$/)
  if (bold) return { name: bold[1].trim(), text: bold[2].trim() }
  const boldOnly = rest.match(/^\*\*(.+?)\*\*\s*$/)
  if (boldOnly) return { name: boldOnly[1].trim(), text: '' }
  const colon = rest.match(/^(.+?):\s*(.*)$/)
  if (colon) return { name: stripWrap(colon[1]), text: colon[2].trim() }
  const dash = rest.match(/^(.+?)\s+[—–]\s+(.*)$/)
  if (dash) return { name: stripWrap(dash[1]), text: dash[2].trim() }
  return { name: stripWrap(rest), text: '' }
}

function stripWrap(s: string): string {
  return s
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .replace(/^__(.+)__$/, '$1')
    .trim()
}

function firstSentence(text: string, max = 160): string | undefined {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return undefined
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const at = cut.search(/[.!?…](?:\s|$)/)
  if (at > 40) return cut.slice(0, at + 1).trim()
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`
}

function uniqueSlug(used: Set<string>, base: string): string {
  let slug = base || 'entrada'
  if (!used.has(slug)) {
    used.add(slug)
    return slug
  }
  let n = 2
  while (used.has(`${slug}-${n}`)) n++
  const next = `${slug}-${n}`
  used.add(next)
  return next
}

function isTitleLine(line: string): boolean {
  const t = line.trim()
  if (!t || t.startsWith('-') || t.startsWith('*') || t.startsWith('+')) return false
  if (/^#{1,6}\s+\S/.test(t)) return true
  return t.length <= 90
}

function headingText(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .trim()
}

interface Chunk {
  type: RecapType | null
  lines: string[]
}

function splitChunks(raw: string): Chunk[] {
  const chunks: Chunk[] = [{ type: null, lines: [] }]
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const heading = matchSectionHeading(line)
    if (heading) {
      chunks.push({ type: heading, lines: [] })
      continue
    }
    chunks[chunks.length - 1]!.lines.push(line)
  }
  return chunks
}

function parseStubs(lines: string[]): {
  stubs: { title: string; body: string }[]
  leftover: string
} {
  const stubs: { title: string; body: string }[] = []
  const leftover: string[] = []
  let inList = false
  for (const line of lines) {
    const item = parseListItem(line)
    if (item) {
      inList = true
      stubs.push({ title: item.name, body: item.text })
      continue
    }
    if (inList && line.trim() === '') {
      leftover.push(line)
      continue
    }
    // Continuation of the last stub (indented / wrapped description).
    if (inList && stubs.length && /^\s+\S/.test(line)) {
      const last = stubs[stubs.length - 1]!
      last.body = [last.body, line.trim()].filter(Boolean).join(' ')
      continue
    }
    inList = false
    leftover.push(line)
  }
  return { stubs, leftover: leftover.join('\n').trim() }
}

export function parseSessionNotes(raw: string, defaults: RecapDefaults): RecapFile[] {
  const campaign = slugify(defaults.campaign) || 'campanha'
  const chunks = splitChunks(raw)
  const header = chunks[0] && chunks[0].type === null ? chunks[0] : null
  const sections = chunks.filter((c) => c.type !== null) as { type: RecapType; lines: string[] }[]

  let date = defaults.date?.trim() || undefined
  let location = defaults.location?.trim() || undefined
  const tags: string[] = []
  const seenTag = new Set<string>()
  const addTags = (list: string[]) => {
    for (const t of list) {
      const key = foldKey(t)
      if (!key || seenTag.has(key)) continue
      seenTag.add(key)
      tags.push(t.trim())
    }
  }

  const bodyLines: string[] = []
  let sessionTitle: string | undefined
  if (header) {
    let titleTaken = false
    for (const line of header.lines) {
      const meta = matchMeta(line)
      if (meta) {
        if (meta.key === 'date' && !date) date = meta.value
        else if (meta.key === 'location' && !location) location = meta.value
        else if (meta.key === 'tags') addTags(splitTags(meta.value))
        continue
      }
      if (!titleTaken && line.trim() && isTitleLine(line) && !parseListItem(line)) {
        sessionTitle = headingText(line)
        titleTaken = true
        continue
      }
      if (line.trim()) titleTaken = true
      bodyLines.push(line)
    }
  }

  const unlabeled = bodyLines.join('\n').trim()
  addTags(collectHashtags(raw))

  const files: RecapFile[] = []
  const used = new Map<RecapType, Set<string>>()
  const takeSlug = (type: RecapType, title: string) => {
    let set = used.get(type)
    if (!set) {
      set = new Set()
      used.set(type, set)
    }
    return uniqueSlug(set, slugify(title))
  }

  const push = (partial: Omit<RecapEntry, 'campaign' | 'slug'> & { slug?: string }) => {
    const title = partial.title.trim()
    if (!title) return
    const slug = takeSlug(partial.type, partial.slug || title)
    const body = (partial.body ?? '').trim()
    const summary = partial.summary ?? firstSentence(body)
    files.push(
      buildRecapFile({
        campaign,
        type: partial.type,
        slug,
        title,
        emoji: partial.emoji || TYPES[partial.type].emoji,
        summary,
        tags: partial.tags ?? [],
        status: partial.status,
        faction: partial.faction,
        role: partial.role,
        location: partial.location ?? location,
        date: partial.date ?? date,
        order: partial.order ?? 0,
        draft: partial.draft,
        body
      })
    )
  }

  const extraEventProse: string[] = []
  const pending: { type: RecapType; title: string; body: string }[] = []

  for (const section of sections) {
    const { stubs, leftover } = parseStubs(section.lines)
    for (const stub of stubs) {
      if (!stub.title) continue
      pending.push({ type: section.type, title: stub.title, body: stub.body })
    }
    if (!leftover) continue
    if (section.type === 'events') {
      extraEventProse.push(leftover)
      continue
    }
    // Prose in a typed section with no list items → one file. A short first
    // line is the title only when more body follows; a single paragraph is
    // the body (title falls back to the session title or the type label).
    if (stubs.length === 0) {
      const lines = leftover.split('\n')
      const firstIdx = lines.findIndex((l) => l.trim())
      const first = firstIdx >= 0 ? lines[firstIdx]! : ''
      const rest =
        firstIdx >= 0
          ? lines
              .slice(firstIdx + 1)
              .join('\n')
              .trim()
          : ''
      let title = sessionTitle
        ? `${sessionTitle} — ${TYPES[section.type].label}`
        : TYPES[section.type].label
      let body = leftover
      if (first && rest && isTitleLine(first) && !parseListItem(first)) {
        title = headingText(first)
        body = rest
      }
      pending.push({ type: section.type, title, body })
    }
  }

  const mainBody = [unlabeled, ...extraEventProse].filter(Boolean).join('\n\n').trim()

  // Unlabeled body (and leftover event prose) → the session recap. A title
  // without body still yields a stub so the GM has a file to drop in.
  // Reserved first so extra events cannot steal the session slug.
  if (sessionTitle || unlabeled || extraEventProse.length) {
    const title = sessionTitle || 'Sessão'
    push({
      type: 'events',
      title,
      body: mainBody,
      tags,
      location,
      date
    })
  }

  for (const item of pending) {
    push({ type: item.type, title: item.title, body: item.body, tags: [] })
  }

  return files
}

/*
  Examples (input → files). Campaign defaults to "demo".

  1) Header + unlabeled body + NPC list
     input:
       O Cerco de Pedravale
       Data: Inverno do 12º ano
       Local: Muralha de Pedravale
       Tags: batalha, fenda

       A noite em que a muralha quase caiu.

       NPCs:
       - Mestre Corvo: apareceu nas muralhas
       - **Rainha** — enviou reforços
     → events/o-cerco-de-pedravale.md
       title: O Cerco de Pedravale
       date: Inverno do 12º ano
       location: Muralha de Pedravale
       tags: [batalha, fenda]
     → npcs/mestre-corvo.md  (summary: apareceu nas muralhas)
     → npcs/rainha.md        (summary: enviou reforços)

  2) Markdown headings, PT + EN keywords
     ## NPCs / ## Personagens / ## Lore / ## Eventos / ## Mapas / ## Locais
     also work as `NPCs:`, `Personagens:`, `Lore:` (case-insensitive).

  3) Hashtags land on the main event
     "Os jogadores venceram #batalha na #fenda"
     → tags: [batalha, fenda]
     `# Título` (space after #) is a heading, not a tag.

  4) First line too long → body, title defaults to "Sessão"
     "Os jogadores chegaram à muralha e lutaram a noite inteira contra as criaturas."
     → events/sessao.md with that paragraph as body.

  5) Empty sections are skipped
     "Sessão 1\n\nNPCs:\n\nLore:\nA fenda cresce."
     → events/sessao-1.md + lore file; no npcs file.

  6) Locais: is a maps section; Local: is metadata
     "Local: Pedravale\n\nLocais:\n- A muralha: o trecho leste"
     → main event location Pedravale + maps/a-muralha.md

  7) slugify strips accents
     "Ação de Graças" → acao-de-gracas

  8) YAML quoting
     title "Foo: bar" → title: "Foo: bar"
     title "O Cerco de Pedravale" → title: O Cerco de Pedravale  (unquoted)

  9) Character list
     "Personagens:\n- **Lyra** — liderou a retomada"
     → characters/lyra.md

  10) Defaults fill date/location when the header omits them
      parseSessionNotes("Sessão\n\nTexto.", { campaign: 'demo', date: 'Ano 12', location: 'Norte' })
      → events/sessao.md with those date/location values.

  11) relativePath is always src/content/entries/<campaign>/<type>/<slug>.md
*/
