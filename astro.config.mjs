// Note: no `// @ts-check` here — the remark/rehype plugins below walk mdast/hast
// trees whose nodes are untyped `any` without pulling in @types/mdast/@types/hast
// and heavy annotations. `npm run check` (astro check) type-checks the app code
// (.ts/.astro); this build config is exercised by the build itself.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// Build-time lint: warn about tags that appear on a single entry. These are
// usually typos ("magos" vs "mago") that fragment the tag system. Walks the
// raw frontmatter rather than the loaded collection so it runs without
// initializing Astro internals.
function tagLint() {
  return {
    name: 'campaign-codex:tag-lint',
    hooks: {
      'astro:build:start': async ({ logger }) => {
        const root = path.resolve('./src/content/entries')
        const tagMap = new Map()
        const walk = async (dir) => {
          let kids
          try {
            kids = await readdir(dir, { withFileTypes: true })
          } catch {
            return
          }
          for (const k of kids) {
            const p = path.join(dir, k.name)
            if (k.isDirectory()) await walk(p)
            else if (k.name.endsWith('.md')) {
              const src = (await readFile(p, 'utf8')).replace(/\r\n/g, '\n')
              const m = src.match(/^---\n([\s\S]*?)\n---/)
              if (!m) continue
              const tagsLine = m[1].match(/^tags:\s*\[([^\]]*)\]/m)
              if (!tagsLine) continue
              const tags = tagsLine[1]
                .split(',')
                .map((s) => s.replace(/['"\s]/g, ''))
                .filter(Boolean)
              for (const t of tags) {
                const arr = tagMap.get(t) ?? []
                arr.push(path.relative(root, p))
                tagMap.set(t, arr)
              }
            }
          }
        }
        await walk(root)
        const orphans = [...tagMap].filter(([, files]) => files.length === 1)
        if (orphans.length) {
          // Use console.warn so the message survives Astro's logger formatting
          // and appears verbatim in CI logs / dev terminal.
          console.warn(
            `\n⚠️  [tag-lint] ${orphans.length} tag(s) aparecem em apenas 1 entrada (possível typo):`
          )
          for (const [t, files] of orphans) {
            console.warn(`     #${t} — em ${files[0]}`)
          }
          logger.warn(`${orphans.length} tag(s) aparecem em apenas 1 entrada — veja stderr`)
        }
      }
    }
  }
}

// Static site. For GitHub Pages (project repo) the build base is the repo
// name; on a custom domain / Netlify it's served at the root. Override the
// base at build time with `BASE` (e.g. BASE=/campaign-codex/). Netlify serves
// at the root, so it leaves BASE unset (defaults to '/').
const base = process.env.BASE ?? '/'

// Canonical site URL for sitemap and absolute OG/Twitter URLs. Resolution:
//   1. SITE          — set explicitly (the GitHub Pages workflow does this).
//   2. URL           — injected automatically by Netlify (the site's main URL),
//                      so Netlify deploys get the right canonical with no config.
//   3. fallback      — used only for local builds with neither set.
const site = process.env.SITE ?? process.env.URL ?? 'https://contracodex.netlify.app'

// Wiki-style [[links]] in markdown:
//   [[mestre-corvo]]                  → link to first entry in current campaign whose slug is "mestre-corvo"
//   [[Mestre Corvo]]                  → matches by case-insensitive title or slug
//   [[npcs/mestre-corvo]]             → forces the type
//   [[mestre-corvo|conselheiro]]      → custom display text
// Unknown links become a styled "(?) link not found" span so the author can fix it.
function remarkWikiLinks() {
  return async (tree, file) => {
    // Lazy-load the project's content to resolve targets. Read the raw
    // entry filenames so this doesn't need Astro's content collection
    // runtime at config-load time.
    const { readdir } = await import('node:fs/promises')
    const path = await import('node:path')
    const root = path.resolve('./src/content/entries')

    const filePath = String(file?.path ?? file?.history?.[0] ?? '').replace(/\\/g, '/')
    const m = filePath.match(/\/content\/entries\/([^/]+)\//i)
    if (!m) return
    const myCampaign = m[1]

    // Build a lookup: { "slug": "type", "type/slug": "type" } scoped to this campaign.
    const index = new Map()
    const walk = async (dir, type) => {
      let kids
      try {
        kids = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const k of kids) {
        const p = path.join(dir, k.name)
        if (k.isDirectory()) {
          await walk(p, type ?? k.name)
        } else if (k.isFile() && k.name.endsWith('.md')) {
          const slug = k.name.replace(/\.md$/, '')
          if (type) {
            index.set(slug.toLowerCase(), { type, slug })
            index.set(`${type}/${slug}`.toLowerCase(), { type, slug })
          }
        }
      }
    }
    await walk(path.join(root, myCampaign))

    const resolve = (target) => {
      const key = target.toLowerCase().trim()
      if (index.has(key)) return index.get(key)
      // Try slugifying ("Mestre Corvo" → "mestre-corvo").
      const slug = key
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9/]+/g, '-')
        .replace(/^-|-$/g, '')
      if (index.has(slug)) return index.get(slug)
      return null
    }

    const walkTree = (node) => {
      if (!node?.children) return
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (child.type === 'text' && child.value.includes('[[')) {
          const parts = []
          let lastIdx = 0
          const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
          let mm
          while ((mm = re.exec(child.value))) {
            if (mm.index > lastIdx) {
              parts.push({ type: 'text', value: child.value.slice(lastIdx, mm.index) })
            }
            const target = mm[1].trim()
            const label = (mm[2] ?? target).trim()
            const hit = resolve(target)
            if (hit) {
              parts.push({
                type: 'link',
                url: `../${hit.type}/${hit.slug}/`,
                children: [{ type: 'text', value: label }]
              })
            } else {
              parts.push({
                type: 'html',
                value: `<span class="wikilink wikilink--missing" title="Entrada não encontrada: ${target}">${label} (?)</span>`
              })
            }
            lastIdx = mm.index + mm[0].length
          }
          if (parts.length === 0) continue
          if (lastIdx < child.value.length) {
            parts.push({ type: 'text', value: child.value.slice(lastIdx) })
          }
          node.children.splice(i, 1, ...parts)
          i += parts.length - 1
        } else {
          walkTree(child)
        }
      }
    }
    walkTree(tree)
  }
}

// GFM-style callouts: a blockquote whose first paragraph starts with
// `[!note]`, `[!warning]`, `[!lore]`, `[!spoiler]`, `[!tip]` becomes a
// styled callout. An optional title follows on the same line; if absent,
// a default per-kind title is used.
function remarkCallouts() {
  const KINDS = {
    note: { label: 'Nota', emoji: '📝' },
    tip: { label: 'Dica', emoji: '💡' },
    warning: { label: 'Atenção', emoji: '⚠️' },
    lore: { label: 'Lore', emoji: '📜' },
    spoiler: { label: 'Spoiler', emoji: '🙈' }
  }
  return (tree) => {
    const walk = (parent) => {
      if (!parent?.children) return
      for (const node of parent.children) {
        if (node.type === 'blockquote' && node.children?.[0]?.type === 'paragraph') {
          const p = node.children[0]
          const first = p.children?.[0]
          if (first?.type === 'text') {
            const m = first.value.match(/^\[!(\w+)\]\s*(.*)$/)
            if (m && KINDS[m[1].toLowerCase()]) {
              const kind = m[1].toLowerCase()
              const meta = KINDS[kind]
              // Pull a title off the marker line; the rest of that text
              // node (after possible \n) stays as body.
              const newlineIdx = m[2].indexOf('\n')
              const titleText = (newlineIdx >= 0 ? m[2].slice(0, newlineIdx) : m[2]).trim()
              const remainder = newlineIdx >= 0 ? m[2].slice(newlineIdx + 1) : ''
              if (remainder) first.value = remainder
              else p.children.shift()
              // Drop a leading <br> the original line break may leave behind.
              if (p.children[0]?.type === 'break') p.children.shift()
              const titleNode = {
                type: 'paragraph',
                data: { hProperties: { className: ['callout__title'] } },
                children: [{ type: 'text', value: `${meta.emoji} ${titleText || meta.label}` }]
              }
              if (p.children.length === 0) node.children.shift()
              node.children.unshift(titleNode)
              node.data = node.data || {}
              node.data.hName = 'aside'
              node.data.hProperties = { className: ['callout', `callout--${kind}`] }
            }
          }
        }
        walk(node)
      }
    }
    walk(tree)
  }
}

// Add an id to every h2/h3 (slugified from text) and prepend a clickable
// anchor (#) that copies the section link. Astro's `render()` exposes the
// resulting headings list (with these ids) so the entry page can build a TOC.
function rehypeHeadingAnchors() {
  const slugify = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const textOf = (node) => {
    if (node.type === 'text') return node.value
    if (node.children) return node.children.map(textOf).join('')
    return ''
  }

  return (tree) => {
    const used = new Map()
    const walk = (node) => {
      if (node?.type === 'element' && /^h[2-4]$/.test(node.tagName)) {
        const text = textOf(node).trim()
        let slug = slugify(text)
        if (!slug) slug = node.tagName
        const n = used.get(slug) ?? 0
        used.set(slug, n + 1)
        const id = n === 0 ? slug : `${slug}-${n + 1}`
        node.properties = { ...(node.properties || {}), id }
        // Prepend a permalink anchor (kept small + decorative).
        node.children = [
          {
            type: 'element',
            tagName: 'a',
            properties: {
              href: `#${id}`,
              class: 'heading-anchor',
              'aria-label': 'Link permanente'
            },
            children: [{ type: 'text', value: '#' }]
          },
          ...(node.children || [])
        ]
      }
      node?.children?.forEach(walk)
    }
    walk(tree)
  }
}

// Rewrite in-content links/images to absolute, base-prefixed URLs.
//
// Entry pages are served as directories (trailingSlash: 'always' +
// format: 'directory'), so a page lives at `/<campaign>/<type>/<slug>/`.
// Authors write cross-links relative to the entry *as a file* — e.g.
// `[x](../lore/x/)` or a sibling `[y](atisok/)`. Resolved against the
// directory URL those land one level too deep. Here we resolve each
// relative href against the entry's own file-like path (derived from the
// source filename) and prefix the build base, so links are correct under
// both the domain root and the Pages subpath.
function rehypeContentLinks() {
  const basePrefix = base.replace(/\/$/, '')
  const isRelative = (v) =>
    typeof v === 'string' &&
    v.length > 0 &&
    !/^[a-z][a-z0-9+.-]*:/i.test(v) && // scheme: http:, mailto:, data:
    !v.startsWith('/') &&
    !v.startsWith('#')

  return (tree, file) => {
    const path = String(file?.path ?? file?.history?.[0] ?? '').replace(/\\/g, '/')
    const m = path.match(/\/content\/entries\/(.+)\.mdx?$/i)
    if (!m) return
    // File-like base URL: /<campaign>/<type>/<slug> (no trailing slash).
    const baseUrl = new URL(m[1], 'https://codex.local/')

    const rewrite = (node) => {
      if (node?.type === 'element' && node.properties) {
        const attr = node.tagName === 'a' ? 'href' : node.tagName === 'img' ? 'src' : null
        const val = attr && node.properties[attr]
        if (attr && isRelative(val)) {
          const u = new URL(val, baseUrl)
          node.properties[attr] = basePrefix + u.pathname + u.search + u.hash
        }
      }
      node?.children?.forEach(rewrite)
    }
    rewrite(tree)
  }
}

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap(), tagLint()],
  markdown: {
    remarkPlugins: [remarkWikiLinks, remarkCallouts],
    rehypePlugins: [rehypeHeadingAnchors, rehypeContentLinks]
  }
})
