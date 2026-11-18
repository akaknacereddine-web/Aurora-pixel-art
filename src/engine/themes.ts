import { clamp } from './pixelMath';

export type WebsiteThemePresetId =
  | 'aurora-blues'
  | 'light-ice-blues'
  | 'warm-browns'
  | 'forest-greens'
  | 'deep-plum'
  | 'neutral-slate';

export interface WebsiteThemeTokens {
  bgApp: string;
  bgCanvasStage: string;
  bgBar: string;
  bgPanel: string;
  bgCard: string;
  bgHover: string;
  bgHoverStrong: string;
  bgActive: string;
  border: string;
  borderStrong: string;
  borderHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentHover: string;
  accentContrast: string;
  accentSecondary: string;
  accentSecondarySoft: string;
  checkerA: string;
  checkerB: string;
  scrollTrack: string;
  scrollThumb: string;
  scrollThumbHover: string;
}

export interface WebsiteThemePreset {
  id: WebsiteThemePresetId;
  name: string;
  description: string;
  isLight: boolean;
  tokens: WebsiteThemeTokens;
}

export interface CustomThemeOverrides {
  bgApp?: string;
  bgPanel?: string;
  accent?: string;
  textPrimary?: string;
}

export interface WebsiteThemeConfig {
  presetId: WebsiteThemePresetId;
  isCustom: boolean;
  customColors: CustomThemeOverrides;
}

export const WEBSITE_THEMES: WebsiteThemePreset[] = [
  {
    id: 'aurora-blues',
    name: 'Aurora Blues',
    description: 'Deep Arctic midnight & cyan',
    isLight: false,
    tokens: {
      bgApp: '#081023',
      bgCanvasStage: '#060C1B',
      bgBar: '#0B152F',
      bgPanel: '#0F1A36',
      bgCard: '#132248',
      bgHover: '#16244A',
      bgHoverStrong: '#1E3163',
      bgActive: '#162C5E',
      border: '#1E3163',
      borderStrong: '#253A6E',
      borderHover: '#3D5CA3',
      textPrimary: '#F4F8FF',
      textSecondary: '#C7D7F5',
      textMuted: '#9BB4E3',
      textFaint: '#6682BA',
      accent: '#3CF2EA',
      accentHover: '#67F7F0',
      accentContrast: '#061326',
      accentSecondary: '#D8B4FE',
      accentSecondarySoft: 'rgba(192, 132, 252, 0.18)',
      checkerA: '#101B3B',
      checkerB: '#172652',
      scrollTrack: '#0A142C',
      scrollThumb: '#253A6E',
      scrollThumbHover: '#38569E',
    },
  },
  {
    id: 'light-ice-blues',
    name: 'Lighter Sky & Ice Blues',
    description: 'Light icy blue surfaces only',
    isLight: true,
    tokens: {
      bgApp: '#EDF5FF',
      bgCanvasStage: '#DCEBFF',
      bgBar: '#E0EDFF',
      bgPanel: '#D3E6FF',
      bgCard: '#C5DFFF',
      bgHover: '#BCD9FF',
      bgHoverStrong: '#A9CEFF',
      bgActive: '#B8D7FF',
      border: '#A5C8F7',
      borderStrong: '#8AB7F2',
      borderHover: '#5696E8',
      textPrimary: '#0B2D5B',
      textSecondary: '#1D4B86',
      textMuted: '#3C6BA8',
      textFaint: '#638EC4',
      accent: '#1D7AFC',
      accentHover: '#0E66E3',
      accentContrast: '#FFFFFF',
      accentSecondary: '#0284C7',
      accentSecondarySoft: 'rgba(2, 132, 199, 0.14)',
      checkerA: '#E3EEFF',
      checkerB: '#CCE0FF',
      scrollTrack: '#DCEBFF',
      scrollThumb: '#8AB7F2',
      scrollThumbHover: '#5696E8',
    },
  },
  {
    id: 'warm-browns',
    name: 'Warm Browns & Amber',
    description: 'Espresso wood & golden amber',
    isLight: false,
    tokens: {
      bgApp: '#1A110C',
      bgCanvasStage: '#130C08',
      bgBar: '#211610',
      bgPanel: '#2A1D15',
      bgCard: '#35251B',
      bgHover: '#3D2B1F',
      bgHoverStrong: '#4B3527',
      bgActive: '#493121',
      border: '#442F22',
      borderStrong: '#5A3F2F',
      borderHover: '#8C6248',
      textPrimary: '#FDF6EE',
      textSecondary: '#E8D5C3',
      textMuted: '#C4A48A',
      textFaint: '#8F7059',
      accent: '#F59E0B',
      accentHover: '#FBBF24',
      accentContrast: '#1C1006',
      accentSecondary: '#FB923C',
      accentSecondarySoft: 'rgba(251, 146, 60, 0.18)',
      checkerA: '#241812',
      checkerB: '#2F2018',
      scrollTrack: '#1E140E',
      scrollThumb: '#5A3F2F',
      scrollThumbHover: '#7C5741',
    },
  },
  {
    id: 'forest-greens',
    name: 'Forest Greens & Sage',
    description: 'Deep pine & emerald mint',
    isLight: false,
    tokens: {
      bgApp: '#0A1712',
      bgCanvasStage: '#07110D',
      bgBar: '#0E2019',
      bgPanel: '#142B22',
      bgCard: '#1A362B',
      bgHover: '#1F4033',
      bgHoverStrong: '#285241',
      bgActive: '#1D4737',
      border: '#224537',
      borderStrong: '#2F5D4A',
      borderHover: '#4D8F74',
      textPrimary: '#F0FDF6',
      textSecondary: '#CBEAD9',
      textMuted: '#8CC2A8',
      textFaint: '#5E947A',
      accent: '#34D399',
      accentHover: '#6EE7B7',
      accentContrast: '#052014',
      accentSecondary: '#A3E635',
      accentSecondarySoft: 'rgba(163, 230, 53, 0.16)',
      checkerA: '#10241C',
      checkerB: '#173328',
      scrollTrack: '#0C1C16',
      scrollThumb: '#2F5D4A',
      scrollThumbHover: '#438268',
    },
  },
  {
    id: 'deep-plum',
    name: 'Deep Plum & Orchid',
    description: 'Velvet twilight & neon orchid',
    isLight: false,
    tokens: {
      bgApp: '#130B20',
      bgCanvasStage: '#0E0718',
      bgBar: '#1B102E',
      bgPanel: '#24163D',
      bgCard: '#2E1D4D',
      bgHover: '#362359',
      bgHoverStrong: '#452E70',
      bgActive: '#3B2466',
      border: '#37235C',
      borderStrong: '#4C327A',
      borderHover: '#7C56BD',
      textPrimary: '#FAF5FF',
      textSecondary: '#E2D4F5',
      textMuted: '#B89EE0',
      textFaint: '#876CB5',
      accent: '#E879F9',
      accentHover: '#F0ABFC',
      accentContrast: '#1E0729',
      accentSecondary: '#38BDF8',
      accentSecondarySoft: 'rgba(56, 189, 248, 0.18)',
      checkerA: '#1E1333',
      checkerB: '#291A45',
      scrollTrack: '#160D26',
      scrollThumb: '#4C327A',
      scrollThumbHover: '#6C49AD',
    },
  },
  {
    id: 'neutral-slate',
    name: 'Clean Neutral Slate',
    description: 'Color-accurate neutral graphite',
    isLight: false,
    tokens: {
      bgApp: '#121417',
      bgCanvasStage: '#0C0E10',
      bgBar: '#181B20',
      bgPanel: '#20242B',
      bgCard: '#272C35',
      bgHover: '#2E343F',
      bgHoverStrong: '#3B4250',
      bgActive: '#2F3A4A',
      border: '#2D323C',
      borderStrong: '#3C4350',
      borderHover: '#647084',
      textPrimary: '#F8FAFC',
      textSecondary: '#D1D8E0',
      textMuted: '#94A0B2',
      textFaint: '#677385',
      accent: '#38BDF8',
      accentHover: '#7DD3FC',
      accentContrast: '#09131C',
      accentSecondary: '#C084FC',
      accentSecondarySoft: 'rgba(192, 132, 252, 0.16)',
      checkerA: '#1A1D22',
      checkerB: '#242830',
      scrollTrack: '#14171B',
      scrollThumb: '#3C4350',
      scrollThumbHover: '#535D6F',
    },
  },
];

const THEME_STORAGE_KEY = 'aurora_ui_theme_v1';

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 0,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

function formatHexRgb(r: number, g: number, b: number): string {
  const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

export function mixHex(hexA: string, hexB: string, ratioB: number): string {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  const t = clamp(ratioB, 0, 1);
  return formatHexRgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isValidHex(val?: string): val is string {
  return Boolean(val && /^#[0-9A-Fa-f]{6}$/.test(val));
}

export function resolveWebsiteThemeTokens(config: WebsiteThemeConfig): WebsiteThemeTokens {
  const preset = WEBSITE_THEMES.find((p) => p.id === config.presetId) || WEBSITE_THEMES[0];
  if (!config.isCustom) {
    return preset.tokens;
  }

  const c = config.customColors || {};
  const bgApp = isValidHex(c.bgApp) ? c.bgApp.toUpperCase() : preset.tokens.bgApp;
  const bgLum = getRelativeLuminance(bgApp);
  const isLight = bgLum > 0.42;

  const shiftTarget = isLight ? '#000000' : '#FFFFFF';
  const stageShiftTarget = isLight ? '#000000' : '#000000';

  const bgPanel = isValidHex(c.bgPanel)
    ? c.bgPanel.toUpperCase()
    : mixHex(bgApp, shiftTarget, isLight ? 0.07 : 0.06);
  const bgBar = mixHex(bgApp, bgPanel, 0.55);
  const bgCard = mixHex(bgPanel, shiftTarget, isLight ? 0.05 : 0.05);
  const bgHover = mixHex(bgPanel, shiftTarget, isLight ? 0.09 : 0.08);
  const bgHoverStrong = mixHex(bgPanel, shiftTarget, isLight ? 0.14 : 0.14);
  const bgCanvasStage = isLight
    ? mixHex(bgApp, '#000000', 0.05)
    : mixHex(bgApp, stageShiftTarget, 0.25);

  const border = mixHex(bgPanel, shiftTarget, isLight ? 0.16 : 0.13);
  const borderStrong = mixHex(bgPanel, shiftTarget, isLight ? 0.24 : 0.2);
  const borderHover = mixHex(bgPanel, shiftTarget, isLight ? 0.36 : 0.34);

  const accent = isValidHex(c.accent) ? c.accent.toUpperCase() : preset.tokens.accent;
  const accentLum = getRelativeLuminance(accent);
  const accentContrast = accentLum > 0.34 ? '#081222' : '#FFFFFF';
  const accentHover =
    accentLum > 0.5 ? mixHex(accent, '#FFFFFF', 0.22) : mixHex(accent, '#FFFFFF', 0.16);
  const bgActive = mixHex(bgPanel, accent, isLight ? 0.18 : 0.16);

  const defaultPrimaryText = isLight ? '#0F2544' : '#F4F8FF';
  const textPrimary = isValidHex(c.textPrimary)
    ? c.textPrimary.toUpperCase()
    : bgApp === preset.tokens.bgApp
    ? preset.tokens.textPrimary
    : defaultPrimaryText;
  const textSecondary = mixHex(textPrimary, bgPanel, 0.24);
  const textMuted = mixHex(textPrimary, bgPanel, 0.44);
  const textFaint = mixHex(textPrimary, bgPanel, 0.62);

  const checkerA = mixHex(bgApp, shiftTarget, isLight ? 0.04 : 0.05);
  const checkerB = mixHex(bgApp, shiftTarget, isLight ? 0.11 : 0.11);

  return {
    bgApp,
    bgCanvasStage,
    bgBar,
    bgPanel,
    bgCard,
    bgHover,
    bgHoverStrong,
    bgActive,
    border,
    borderStrong,
    borderHover,
    textPrimary,
    textSecondary,
    textMuted,
    textFaint,
    accent,
    accentHover,
    accentContrast,
    accentSecondary: preset.tokens.accentSecondary,
    accentSecondarySoft: preset.tokens.accentSecondarySoft,
    checkerA,
    checkerB,
    scrollTrack: bgBar,
    scrollThumb: borderStrong,
    scrollThumbHover: borderHover,
  };
}

export function applyWebsiteThemeToRoot(tokens: WebsiteThemeTokens): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--ui-bg-app', tokens.bgApp);
  root.style.setProperty('--ui-bg-canvas-stage', tokens.bgCanvasStage);
  root.style.setProperty('--ui-bg-bar', tokens.bgBar);
  root.style.setProperty('--ui-bg-panel', tokens.bgPanel);
  root.style.setProperty('--ui-bg-card', tokens.bgCard);
  root.style.setProperty('--ui-bg-hover', tokens.bgHover);
  root.style.setProperty('--ui-bg-hover-strong', tokens.bgHoverStrong);
  root.style.setProperty('--ui-bg-active', tokens.bgActive);
  root.style.setProperty('--ui-border', tokens.border);
  root.style.setProperty('--ui-border-strong', tokens.borderStrong);
  root.style.setProperty('--ui-border-hover', tokens.borderHover);
  root.style.setProperty('--ui-text-primary', tokens.textPrimary);
  root.style.setProperty('--ui-text-secondary', tokens.textSecondary);
  root.style.setProperty('--ui-text-muted', tokens.textMuted);
  root.style.setProperty('--ui-text-faint', tokens.textFaint);
  root.style.setProperty('--ui-accent', tokens.accent);
  root.style.setProperty('--ui-accent-hover', tokens.accentHover);
  root.style.setProperty('--ui-accent-contrast', tokens.accentContrast);
  root.style.setProperty('--ui-accent-secondary', tokens.accentSecondary);
  root.style.setProperty('--ui-accent-secondary-soft', tokens.accentSecondarySoft);
  root.style.setProperty('--ui-checker-a', tokens.checkerA);
  root.style.setProperty('--ui-checker-b', tokens.checkerB);
  root.style.setProperty('--ui-scroll-track', tokens.scrollTrack);
  root.style.setProperty('--ui-scroll-thumb', tokens.scrollThumb);
  root.style.setProperty('--ui-scroll-thumb-hover', tokens.scrollThumbHover);
}

export function loadWebsiteThemeConfig(): WebsiteThemeConfig {
  const fallback: WebsiteThemeConfig = {
    presetId: 'aurora-blues',
    isCustom: false,
    customColors: {},
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const validPreset = WEBSITE_THEMES.some((t) => t.id === parsed?.presetId)
      ? (parsed.presetId as WebsiteThemePresetId)
      : 'aurora-blues';
    return {
      presetId: validPreset,
      isCustom: Boolean(parsed?.isCustom),
      customColors:
        parsed?.customColors && typeof parsed.customColors === 'object'
          ? parsed.customColors
          : {},
    };
  } catch {
    return fallback;
  }
}

export function saveWebsiteThemeConfig(config: WebsiteThemeConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore quota errors
  }
}
