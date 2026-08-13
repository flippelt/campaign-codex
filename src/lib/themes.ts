// Single source of truth for theme ids + display metadata.
// Palettes and fonts for each id live in src/styles/themes.css (keyed by the
// same id via [data-theme=...]); the @font-face declarations are pulled in by
// src/lib/fonts.ts. Add a theme by adding one entry here, one CSS block there,
// and (if it needs a new font) one import in fonts.ts.
//
// `og` is OPTIONAL per theme: it mirrors the theme's dark-mode colors (as RGB,
// since the build-time OG generator can't read the CSS) so /og/*.png cards are
// themed per campaign. Omit `og` on a theme to fall back to the default brand
// card. Flip OG_THEME_COLORS to false below to disable theming globally.

type RGB = [number, number, number]
interface OGPalette {
  from: RGB // gradient start (lighter dark — surface-2)
  to: RGB // gradient end (darkest — bg)
  border: RGB // edge accent
  title: RGB // title text
  body: RGB // description text
}
interface ThemeMeta {
  label: string
  emoji: string
  og?: OGPalette
}

// Master switch for per-theme OG colors. Set to false to use the default
// brand card for every page regardless of each theme's `og` palette.
export const OG_THEME_COLORS = true

export const THEMES = {
  fantasy: {
    label: 'Fantasia',
    emoji: '⚔️',
    og: {
      from: [44, 33, 26],
      to: [22, 17, 13],
      border: [212, 168, 75],
      title: [240, 228, 206],
      body: [179, 160, 134]
    }
  },
  'sci-fi': {
    label: 'Sci-Fi',
    emoji: '🚀',
    og: {
      from: [22, 36, 47],
      to: [10, 15, 20],
      border: [56, 208, 224],
      title: [230, 241, 247],
      body: [138, 163, 178]
    }
  },
  cthulhu: {
    label: 'Cthulhu',
    emoji: '🐙',
    og: {
      from: [26, 36, 33],
      to: [11, 17, 16],
      border: [95, 174, 142],
      title: [221, 231, 223],
      body: [138, 154, 143]
    }
  },
  'warhammer-inquisition': {
    label: 'WH40K · Inquisition',
    emoji: '⚜️',
    og: {
      from: [36, 23, 22],
      to: [16, 10, 10],
      border: [192, 57, 43],
      title: [236, 224, 210],
      body: [168, 146, 138]
    }
  },
  'warhammer-astra-militarum': {
    label: 'WH40K · Astra Militarum',
    emoji: '🎖️',
    og: {
      from: [34, 38, 20],
      to: [15, 17, 9],
      border: [182, 161, 58],
      title: [231, 230, 210],
      body: [163, 160, 133]
    }
  },
  'warhammer-space-marines': {
    label: 'WH40K · Space Marines',
    emoji: '🛡️',
    og: {
      from: [42, 19, 21],
      to: [18, 8, 9],
      border: [214, 31, 38],
      title: [244, 230, 223],
      body: [196, 154, 147]
    }
  },
  deathwatch: {
    label: 'WH40K · Deathwatch',
    emoji: '🗡️',
    og: {
      from: [29, 32, 36],
      to: [10, 11, 12],
      border: [170, 180, 190],
      title: [233, 237, 240],
      body: [152, 161, 169]
    }
  },
  'cyberpunk-red': {
    label: 'Cyberpunk RED',
    emoji: '🌃',
    og: {
      from: [34, 13, 18],
      to: [13, 6, 8],
      border: [255, 43, 78],
      title: [255, 233, 236],
      body: [199, 145, 153]
    }
  },
  'blade-runner': {
    label: 'Blade Runner',
    emoji: '🌧️',
    og: {
      from: [27, 32, 36],
      to: [10, 12, 14],
      border: [255, 159, 67],
      title: [240, 232, 220],
      body: [154, 160, 160]
    }
  },
  lancer: {
    label: 'LANCER',
    emoji: '🤖',
    og: {
      from: [29, 36, 43],
      to: [12, 15, 18],
      border: [255, 144, 0],
      title: [232, 237, 242],
      body: [148, 162, 173]
    }
  },
  fallout: {
    label: 'Fallout',
    emoji: '☢️',
    og: {
      from: [23, 32, 17],
      to: [8, 11, 6],
      border: [125, 255, 94],
      title: [191, 255, 158],
      body: [123, 168, 95]
    }
  }
} satisfies Record<string, ThemeMeta>

export type ThemeId = keyof typeof THEMES

// Tuple form for z.enum() in content.config.ts.
export const THEME_IDS = Object.keys(THEMES) as [ThemeId, ...ThemeId[]]

// Back-compat alias: existing call sites import THEME_LABELS for {label, emoji}.
export const THEME_LABELS: Record<string, { label: string; emoji: string }> = THEMES

// Default brand card (used for the home page, pages without a theme, or when
// OG_THEME_COLORS is false). Matches the fantasy/brand look.
export const OG_DEFAULT: OGPalette = {
  from: [22, 17, 13],
  to: [10, 8, 6],
  border: [212, 168, 75],
  title: [240, 228, 206],
  body: [179, 160, 134]
}

// Resolve the OG palette for a (possibly undefined) theme id.
export function ogPalette(theme?: string): OGPalette {
  if (!OG_THEME_COLORS || !theme) return OG_DEFAULT
  return (THEMES as Record<string, ThemeMeta>)[theme]?.og ?? OG_DEFAULT
}
