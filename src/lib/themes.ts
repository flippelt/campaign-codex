// Single source of truth for theme ids + display metadata.
// Palettes and fonts for each id live in src/styles/themes.css (keyed by the
// same id via [data-theme=...]); the @font-face declarations are pulled in by
// src/lib/fonts.ts. Add a theme by adding one entry here, one CSS block there,
// and (if it needs a new font) one import in fonts.ts.
export const THEMES = {
  fantasy: { label: 'Fantasia', emoji: '⚔️' },
  'sci-fi': { label: 'Sci-Fi', emoji: '🚀' },
  cthulhu: { label: 'Cthulhu', emoji: '🐙' },
  'warhammer-inquisition': { label: 'WH40K · Inquisition', emoji: '⚜️' },
  'warhammer-astra-militarum': { label: 'WH40K · Astra Militarum', emoji: '🎖️' },
  'warhammer-space-marines': { label: 'WH40K · Space Marines', emoji: '🛡️' },
  deathwatch: { label: 'WH40K · Deathwatch', emoji: '🗡️' },
  'cyberpunk-red': { label: 'Cyberpunk RED', emoji: '🌃' },
  'blade-runner': { label: 'Blade Runner', emoji: '🌧️' },
  lancer: { label: 'LANCER', emoji: '🤖' },
  fallout: { label: 'Fallout', emoji: '☢️' }
} as const

export type ThemeId = keyof typeof THEMES

// Tuple form for z.enum() in content.config.ts.
export const THEME_IDS = Object.keys(THEMES) as [ThemeId, ...ThemeId[]]

// Back-compat alias: existing call sites import THEME_LABELS.
export const THEME_LABELS: Record<string, { label: string; emoji: string }> = THEMES
