// @ts-check
import { defineConfig } from 'astro/config'

// Static site. For GitHub Pages (project repo) the build base is the repo
// name; on a custom domain / Netlify it's served at the root. Override the
// base at build time with `BASE` (e.g. BASE=/campaign-codex/).
const base = process.env.BASE ?? '/'

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
                children: [
                  { type: 'text', value: `${meta.emoji} ${titleText || meta.label}` }
                ]
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
            properties: { href: `#${id}`, class: 'heading-anchor', 'aria-label': 'Link permanente' },
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
    typeof v === 'string' && v.length > 0 &&
    !/^[a-z][a-z0-9+.-]*:/i.test(v) && // scheme: http:, mailto:, data:
    !v.startsWith('/') && !v.startsWith('#')

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
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: {
    remarkPlugins: [remarkCallouts],
    rehypePlugins: [rehypeHeadingAnchors, rehypeContentLinks]
  }
})
