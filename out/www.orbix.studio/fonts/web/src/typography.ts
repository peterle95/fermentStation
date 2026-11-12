/** Design-system tokens derived from the typeface reference. The font is separately licensed. */
export const UNIQUE_WEIGHTS = {
  thin: 100, extraLight: 200, light: 300,
  regular: 400, medium: 500, semiBold: 600, bold: 700,
} as const;
export type UniqueWeight = typeof UNIQUE_WEIGHTS[keyof typeof UNIQUE_WEIGHTS];

export const typography = {
  family: { display: "'Unique Display', Impact, 'Arial Narrow', sans-serif", ui: "Inter, system-ui, sans-serif" },
  hero: { weight: 700, lineHeight: 0.84, letterSpacing: '-0.012em' },
  h1: { weight: 600, lineHeight: 0.90, letterSpacing: '0' },
  h2: { weight: 500, lineHeight: 1.00, letterSpacing: '0' },
  palette: { lime: '#D9FF57', coral: '#F14F28', ink: '#161225', violet: '#7162FA', cream: '#FFF0CB' },
} as const;
