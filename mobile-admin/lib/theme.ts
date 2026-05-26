/**
 * Design tokens for the daari plant-admin app.
 *
 * This file is the SINGLE SOURCE OF TRUTH for every visual decision in
 * the app — colour, type scale, spacing, radius, shadow, motion. If you
 * find yourself reaching for a hex value or a magic margin in a screen
 * component, look here first; the chances are 95% the token already
 * exists. If it doesn't, add it here rather than hard-coding inline —
 * that's how the app degraded into the "every screen styled differently"
 * state we just rebuilt out of.
 *
 * Naming follows a deliberately limited vocabulary:
 *   - `surface.*`   page + card backgrounds
 *   - `text.*`      the four text emphasis levels
 *   - `border.*`    dividers, card outlines
 *   - `accent.*`    the brand teal in three weights
 *   - `state.*`     success / warning / danger / info semantic colours
 *   - `tone.*`      neutral interaction tones (hover, pressed, disabled)
 *
 * No screen should ever reach into the brand palette and pick a random
 * shade. If you need "a slightly lighter teal", that's a sign we need a
 * new named accent token here, not an inline hex.
 */

/** Hex sequences for the most common UI tints used across the app. */
const teal = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  // 600 is the BRAND — every place that says "primary" lands here. The
  // dashboard web uses the exact same hex so the two surfaces feel
  // continuous when a user moves between phone + desktop.
  600: '#0e9384',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
} as const;

const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
} as const;

const amber = {
  50: '#fffbeb',
  100: '#fef3c7',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
} as const;

const rose = {
  50: '#fef2f2',
  100: '#fee2e2',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
} as const;

const emerald = {
  50: '#ecfdf5',
  100: '#d1fae5',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
} as const;

const sky = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
} as const;

const violet = {
  50: '#f5f3ff',
  100: '#ede9fe',
  500: '#8b5cf6',
  600: '#7c3aed',
} as const;

/**
 * The theme object the app reads from. Keys are semantic — pick the one
 * that matches the *meaning* of what you're styling, not the visual
 * outcome (`text.primary`, not `text.dark`).
 */
export const theme = {
  // ────────────────────────────────────────────────────────────────
  // Colour
  // ────────────────────────────────────────────────────────────────
  color: {
    // Page surfaces. `page` is the screen background; `card` floats
    // above it; `raised` is a card-on-card surface (e.g. inside a sheet).
    surface: {
      page: slate[50],
      card: '#ffffff',
      raised: '#ffffff',
      sunken: slate[100],
      inverse: slate[900],
    },

    // Text emphasis. The four-level scale is borrowed from the Linear
    // app: primary for body + key data, secondary for labels, tertiary
    // for timestamps/captions, disabled for ghosted controls.
    text: {
      primary: slate[900],
      secondary: slate[600],
      tertiary: slate[500],
      disabled: slate[400],
      inverse: '#ffffff',
      onAccent: '#ffffff',
    },

    // Borders. `subtle` is for hairline dividers; `default` for card
    // outlines; `strong` for focused / active states.
    border: {
      subtle: slate[200],
      default: slate[300],
      strong: slate[400],
      focused: teal[600],
    },

    // Brand accent. `600` is the primary; `500` for hover; `700` for
    // pressed. `tint` is the 10% wash used behind icon tiles.
    accent: {
      primary: teal[600],
      hover: teal[500],
      pressed: teal[700],
      tint: teal[100],
      tintStrong: teal[200],
      onAccent: '#ffffff',
    },

    // Semantic state. Each has bg/fg/border for the three places a
    // status badge typically uses colour.
    state: {
      success: {
        bg: emerald[50],
        fg: emerald[700],
        border: emerald[100],
        solid: emerald[500],
      },
      warning: {
        bg: amber[50],
        fg: amber[700],
        border: amber[100],
        solid: amber[500],
      },
      danger: {
        bg: rose[50],
        fg: rose[700],
        border: rose[100],
        solid: rose[500],
      },
      info: {
        bg: sky[50],
        fg: sky[700],
        border: sky[100],
        solid: sky[500],
      },
      neutral: {
        bg: slate[100],
        fg: slate[700],
        border: slate[200],
        solid: slate[500],
      },
    },

    // Decorative accent palette — used by tile icons + chart series.
    // Limited to six so dashboards don't turn into a kindergarten.
    chart: {
      teal: teal[600],
      sky: sky[600],
      emerald: emerald[600],
      amber: amber[600],
      rose: rose[600],
      violet: violet[600],
    },

    // Raw scales available when a screen genuinely needs an off-palette
    // shade (e.g. category illustration). Prefer named tokens above.
    raw: { teal, slate, amber, rose, emerald, sky, violet },
  },

  // ────────────────────────────────────────────────────────────────
  // Type scale — Cairo throughout, weights 400/600/700/800/900.
  // ────────────────────────────────────────────────────────────────
  font: {
    // Display: hero numbers (KPI tile value). Always 900 weight.
    displayLg: { fontSize: 32, lineHeight: 38, fontWeight: '900' as const },
    displayMd: { fontSize: 26, lineHeight: 32, fontWeight: '900' as const },
    displaySm: { fontSize: 22, lineHeight: 28, fontWeight: '900' as const },

    // Heading: section headers, screen titles.
    headingLg: { fontSize: 19, lineHeight: 26, fontWeight: '800' as const },
    headingMd: { fontSize: 16, lineHeight: 22, fontWeight: '800' as const },
    headingSm: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },

    // Body: list items, descriptions.
    bodyLg: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
    bodyMd: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
    bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },

    // Label: tile labels, chip text, captions.
    labelLg: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const },
    labelMd: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const },
    labelSm: { fontSize: 10, lineHeight: 14, fontWeight: '700' as const },
  },

  // ────────────────────────────────────────────────────────────────
  // Spacing — 4px base unit. Use `space.N` for any margin/padding.
  // ────────────────────────────────────────────────────────────────
  space: {
    px: 1,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 56,
  },

  // ────────────────────────────────────────────────────────────────
  // Radius — match the Apple HIG language: small chips 10, cards 16,
  // sheets 20, pills 999.
  // ────────────────────────────────────────────────────────────────
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    pill: 999,
  },

  // ────────────────────────────────────────────────────────────────
  // Shadow — three depths only. iOS-friendly (low offset, soft radius).
  // ────────────────────────────────────────────────────────────────
  shadow: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: slate[900],
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    md: {
      shadowColor: slate[900],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    lg: {
      shadowColor: slate[900],
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
  },

  // ────────────────────────────────────────────────────────────────
  // Motion — fast for taps, medium for sheets, slow only for hero
  // animations. Use the easing curves; don't pick your own.
  // ────────────────────────────────────────────────────────────────
  motion: {
    duration: {
      instant: 80,
      fast: 160,
      base: 240,
      slow: 360,
      hero: 500,
    },
    easing: {
      // From iOS HIG — feel right for "this is responding to my finger".
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      // Bounce out for celebrations (order saved, lead approved).
      emphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
      // For dismissing things (sheet close, snackbar leave).
      accelerated: 'cubic-bezier(0.3, 0, 1, 1)',
    },
  },

  // ────────────────────────────────────────────────────────────────
  // Z-index — fight overlap bugs with a single source of truth.
  // ────────────────────────────────────────────────────────────────
  z: {
    base: 0,
    raised: 10,
    sticky: 20,
    overlay: 30,
    drawer: 40,
    modal: 50,
    toast: 60,
  },

  // ────────────────────────────────────────────────────────────────
  // Hit-target — Apple HIG minimum is 44pt; we standardise on 44.
  // ────────────────────────────────────────────────────────────────
  touch: {
    min: 44,
  },
} as const;

/** Convenience re-exports for ergonomic imports. */
export const colors = theme.color;
export const font = theme.font;
export const space = theme.space;
export const radius = theme.radius;
export const shadow = theme.shadow;
