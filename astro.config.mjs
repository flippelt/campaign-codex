// @ts-check
import { defineConfig } from 'astro/config'

// Static site. For GitHub Pages (project repo) the build base is the repo
// name; on a custom domain / Netlify it's served at the root. Override the
// base at build time with `BASE` (e.g. BASE=/campaign-codex/).
const base = process.env.BASE ?? '/'

export default defineConfig({
  base,
  trailingSlash: 'always',
  build: { format: 'directory' }
})
