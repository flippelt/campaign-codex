// @ts-check
import { defineConfig } from 'astro/config'

// Static site. For GitHub Pages (project repo) the build base is the repo
// name; on a custom domain / Netlify it's served at the root. Override the
// base at build time with `BASE` (e.g. BASE=/campaign-codex/).
const base = process.env.BASE ?? '/'

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
    rehypePlugins: [rehypeContentLinks]
  }
})
