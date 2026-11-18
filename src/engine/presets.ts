import { createBuffer, encodeRLE, hexToRgba } from './pixelMath';
import type {
  CustomBrush,
  OnionSkinConfig,
  PalettePreset,
  Project,
  ProjectType,
  SerializedFrame,
  SerializedLayer,
} from './types';

export const DEFAULT_PALETTES: PalettePreset[] = [
  {
    id: 'builtin_aurora_night',
    name: 'Aurora Night',
    isBuiltIn: true,
    colors: [
      '#081129', '#0C1A3D', '#162B66', '#2A4B9C', '#5B86D9', '#8CAEE8', '#C3DBFA', '#F4F8FF',
      '#3CF2EA', '#22D3EE', '#0EA5E9', '#38BDF8', '#E2A9FF', '#F5C4FF', '#C084FC', '#7E22CE',
      '#FACC15', '#F97316', '#DC2626', '#F472B6', '#10B981', '#14B8A6', '#64748B', '#1E293B',
    ],
  },
  {
    id: 'builtin_midnight_studio',
    name: 'Midnight Studio',
    isBuiltIn: true,
    colors: [
      '#0F1115', '#1E2430', '#384359', '#64748B', '#94A3B8', '#E2E8F0', '#FFFFFF', '#FEF08A',
      '#FACC15', '#F97316', '#EA580C', '#DC2626', '#991B1B', '#F472B6', '#C084FC', '#7E22CE',
      '#3B82F6', '#1D4ED8', '#06B6D4', '#14B8A6', '#10B981', '#15803D', '#84CC16', '#A16207',
    ],
  },
  {
    id: 'builtin_pico8',
    name: 'PICO-8 Classic',
    isBuiltIn: true,
    colors: [
      '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
      '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
    ],
  },
  {
    id: 'builtin_gameboy_sage',
    name: 'GameBoy Sage',
    isBuiltIn: true,
    colors: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'],
  },
  {
    id: 'builtin_pastel_candy',
    name: 'Pastel Candy',
    isBuiltIn: true,
    colors: [
      '#2B2D42', '#8D99AE', '#EDF2F4', '#FFCAD4', '#F4ACB7', '#D8E2DC', '#FFE5D9', '#FFDDD2',
      '#CDB4DB', '#BDE0FE', '#A2D2FF', '#B5E48C', '#D9ED92', '#FFD166', '#EF476F', '#06D6A0',
    ],
  },
  {
    id: 'builtin_sunset_ember',
    name: 'Sunset Ember',
    isBuiltIn: true,
    colors: [
      '#1A0B1C', '#3B1230', '#6B1D45', '#A3284D', '#D9434F', '#F26B43', '#FA9C4B', '#FFD770',
      '#FFF3B8', '#52345E', '#7D4E7B', '#B87BA8', '#242038', '#44416B', '#7275A6', '#B0B8DE',
    ],
  },
  {
    id: 'builtin_forest_moss',
    name: 'Forest Moss',
    isBuiltIn: true,
    colors: [
      '#0D1B1E', '#1B332F', '#2E5339', '#4A7C44', '#76A84C', '#B4D46B', '#E5F299', '#3D2B1F',
      '#6B4832', '#9C6B49', '#CC996E', '#E8C59B', '#4A6FA5', '#739FD6', '#A7CCE8', '#F2F7F5',
    ],
  },
  {
    id: 'builtin_retro_arcade',
    name: 'Retro Arcade 16',
    isBuiltIn: true,
    colors: [
      '#140C1C', '#442434', '#30346D', '#4E4A4E', '#854C30', '#346524', '#D04648', '#757161',
      '#597DCE', '#D27D2C', '#8595A1', '#6DAA2C', '#D2AA99', '#6DC2CA', '#DAD45E', '#DEEED6',
    ],
  },
];

const CUSTOM_PALETTES_STORAGE_KEY = 'aurora_custom_palettes_v1';

export function loadSavedCustomPalettes(): PalettePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PalettePreset =>
        Boolean(p) &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Array.isArray(p.colors) &&
        p.colors.length >= 1
    );
  } catch {
    return [];
  }
}

export function saveCustomPalettes(palettes: PalettePreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_PALETTES_STORAGE_KEY, JSON.stringify(palettes));
  } catch {
    // Ignore quota errors
  }
}

export const BUILTIN_BRUSHES: CustomBrush[] = [
  {
    id: 'brush-pixel',
    name: 'Crisp Pixel',
    size: 1,
    matrix: [1],
    isBuiltIn: true,
  },
  {
    id: 'brush-dither',
    name: 'Checker Dither',
    size: 4,
    matrix: [
      1, 0, 1, 0,
      0, 1, 0, 1,
      1, 0, 1, 0,
      0, 1, 0, 1,
    ],
    isBuiltIn: true,
  },
  {
    id: 'brush-cross',
    name: 'Cross Stamp',
    size: 3,
    matrix: [
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ],
    isBuiltIn: true,
  },
  {
    id: 'brush-diagonal',
    name: 'Calligraphy Slash',
    size: 3,
    matrix: [
      0, 0, 1,
      0, 1, 0,
      1, 0, 0,
    ],
    isBuiltIn: true,
  },
  {
    id: 'brush-soft',
    name: 'Soft Stipple',
    size: 3,
    matrix: [
      0.25, 0.7, 0.25,
      0.7, 1.0, 0.7,
      0.25, 0.7, 0.25,
    ],
    isBuiltIn: true,
  },
  {
    id: 'brush-sparkle',
    name: 'Star Sparkle',
    size: 5,
    matrix: [
      0, 0, 1, 0, 0,
      0, 0.5, 1, 0.5, 0,
      1, 1, 1, 1, 1,
      0, 0.5, 1, 0.5, 0,
      0, 0, 1, 0, 0,
    ],
    isBuiltIn: true,
  },
];

export const DEFAULT_ONION_SKIN: OnionSkinConfig = {
  enabled: true,
  prevFrames: 1,
  nextFrames: 1,
  opacity: 35,
  tintEnabled: true,
  prevTint: '#EF4444',
  nextTint: '#38BDF8',
};

export const CANVAS_SIZE_PRESETS = [
  { label: '16 × 16', width: 16, height: 16, tag: 'Micro Icon' },
  { label: '24 × 24', width: 24, height: 24, tag: 'RPG Tile' },
  { label: '32 × 32', width: 32, height: 32, tag: 'Character Sprite' },
  { label: '48 × 48', width: 48, height: 48, tag: 'Portrait' },
  { label: '64 × 64', width: 64, height: 64, tag: 'Detailed Art' },
  { label: '128 × 128', width: 128, height: 128, tag: 'Scene Canvas' },
];

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function createBlankLayer(width: number, height: number, name = 'Layer 1'): SerializedLayer {
  const buf = createBuffer(width, height);
  return {
    id: uid('layer'),
    name,
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: 'normal',
    pixelsRle: encodeRLE(buf, width, height),
  };
}

export function createBlankFrame(width: number, height: number, name = 'Frame 1', durationMs = 140): SerializedFrame {
  return {
    id: uid('frame'),
    name,
    durationMs,
    transition: 'cut',
    transitionMs: 120,
    layers: [createBlankLayer(width, height, 'Layer 1')],
    effects: [],
  };
}

export function createBlankProject(
  name: string,
  type: ProjectType,
  width: number,
  height: number,
  initialPalette?: string[]
): Project {
  const firstFrame = createBlankFrame(width, height, 'Frame 1', 150);
  const frames: SerializedFrame[] = [firstFrame];
  if (type === 'video') {
    frames.push(createBlankFrame(width, height, 'Frame 2', 150));
  }
  const now = Date.now();
  const safePalette =
    initialPalette && initialPalette.length >= 1
      ? initialPalette.slice(0, 64).map((c) => c.toUpperCase())
      : [...DEFAULT_PALETTES[0].colors];
  return {
    id: uid('proj'),
    name: name.trim() || (type === 'video' ? 'Untitled Animation' : 'Untitled Sprite'),
    type,
    width,
    height,
    createdAt: now,
    updatedAt: now,
    frames,
    activeFrameIndex: 0,
    activeLayerId: firstFrame.layers[0].id,
    onionSkin: { ...DEFAULT_ONION_SKIN },
    palette: safePalette,
    customBrushes: BUILTIN_BRUSHES.map((b) => ({ ...b, matrix: [...b.matrix] })),
  };
}

function paintRect(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hex: string,
  alpha = 100
) {
  const col = hexToRgba(hex, alpha);
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const idx = (y * w + x) * 4;
      buf[idx] = col.r;
      buf[idx + 1] = col.g;
      buf[idx + 2] = col.b;
      buf[idx + 3] = col.a;
    }
  }
}

function paintCircle(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  hex: string,
  alpha = 100
) {
  const col = hexToRgba(hex, alpha);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) {
        const idx = (y * w + x) * 4;
        buf[idx] = col.r;
        buf[idx + 1] = col.g;
        buf[idx + 2] = col.b;
        buf[idx + 3] = col.a;
      }
    }
  }
}

export function createSeedProjects(): Project[] {
  const now = Date.now();
  const w = 32;
  const h = 32;

  // 1. Seed Pixel Art Canvas: Knight Errant (3 layers)
  const bgLayerBuf = createBuffer(w, h);
  paintCircle(bgLayerBuf, w, h, 15.5, 16, 12, 12, '#1D4ED8', 35);
  paintCircle(bgLayerBuf, w, h, 15.5, 16, 8, 8, '#3B82F6', 45);

  const knightBuf = createBuffer(w, h);
  // Cape
  paintRect(knightBuf, w, h, 9, 13, 22, 26, '#DC2626');
  paintRect(knightBuf, w, h, 8, 17, 10, 27, '#991B1B');
  // Helmet & Armor
  paintRect(knightBuf, w, h, 11, 6, 20, 14, '#94A3B8');
  paintRect(knightBuf, w, h, 12, 5, 19, 6, '#E2E8F0');
  paintRect(knightBuf, w, h, 15, 2, 17, 5, '#FACC15'); // Plume
  paintRect(knightBuf, w, h, 14, 2, 15, 4, '#F97316');
  // Visor slit
  paintRect(knightBuf, w, h, 12, 9, 19, 11, '#0F1115');
  // Torso plate
  paintRect(knightBuf, w, h, 11, 14, 20, 22, '#64748B');
  paintRect(knightBuf, w, h, 12, 15, 19, 18, '#CBD5E1');
  // Belt & boots
  paintRect(knightBuf, w, h, 11, 21, 20, 22, '#A16207');
  paintRect(knightBuf, w, h, 15, 21, 16, 22, '#FACC15');
  paintRect(knightBuf, w, h, 11, 23, 14, 28, '#384359');
  paintRect(knightBuf, w, h, 17, 23, 20, 28, '#384359');
  // Sword on right
  paintRect(knightBuf, w, h, 23, 8, 24, 20, '#E2E8F0');
  paintRect(knightBuf, w, h, 21, 19, 26, 20, '#FACC15');
  paintRect(knightBuf, w, h, 23, 21, 24, 23, '#A16207');

  const glowBuf = createBuffer(w, h);
  paintRect(glowBuf, w, h, 13, 10, 14, 10, '#38BDF8');
  paintRect(glowBuf, w, h, 17, 10, 18, 10, '#38BDF8');
  paintRect(glowBuf, w, h, 23, 8, 23, 17, '#FFFFFF', 70);

  const knightLayers: SerializedLayer[] = [
    {
      id: 'seed_knight_l1',
      name: 'Backdrop Aura',
      visible: true,
      locked: false,
      opacity: 80,
      blendMode: 'screen',
      pixelsRle: encodeRLE(bgLayerBuf, w, h),
    },
    {
      id: 'seed_knight_l2',
      name: 'Character Armor',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      pixelsRle: encodeRLE(knightBuf, w, h),
    },
    {
      id: 'seed_knight_l3',
      name: 'Visor & Blade Glint',
      visible: true,
      locked: false,
      opacity: 90,
      blendMode: 'lighten',
      pixelsRle: encodeRLE(glowBuf, w, h),
    },
  ];

  const knightProject: Project = {
    id: 'seed_knight_errant',
    name: 'Knight Errant Sprite',
    type: 'canvas',
    width: w,
    height: h,
    createdAt: now - 3600_000,
    updatedAt: now - 1800_000,
    frames: [
      {
        id: 'seed_knight_f1',
        name: 'Frame 1',
        durationMs: 150,
        transition: 'cut',
        transitionMs: 120,
        layers: knightLayers,
        effects: [],
      },
    ],
    activeFrameIndex: 0,
    activeLayerId: 'seed_knight_l2',
    onionSkin: { ...DEFAULT_ONION_SKIN, enabled: false },
    palette: [...DEFAULT_PALETTES[0].colors],
    customBrushes: BUILTIN_BRUSHES.map((b) => ({ ...b, matrix: [...b.matrix] })),
  };

  // 2. Seed Video Animation: Ember Slime Bounce (5 frames with varied timings & transitions)
  const slimeSpecs = [
    { cy: 23, rx: 8.5, ry: 5.0, dur: 160, trans: 'crossfade' as const },
    { cy: 20, rx: 6.5, ry: 7.5, dur: 110, trans: 'cut' as const },
    { cy: 13, rx: 6.0, ry: 6.5, dur: 120, trans: 'crossfade' as const },
    { cy: 19, rx: 6.5, ry: 7.5, dur: 100, trans: 'cut' as const },
    { cy: 24, rx: 9.5, ry: 4.2, dur: 170, trans: 'crossfade' as const },
  ];

  const slimeFrames: SerializedFrame[] = slimeSpecs.map((spec, idx) => {
    const body = createBuffer(w, h);
    // Ground shadow
    paintCircle(body, w, h, 15.5, 28, Math.max(4, spec.rx * 0.9), 1.6, '#0F1115', 55);
    // Slime outer body
    paintCircle(body, w, h, 15.5, spec.cy, spec.rx, spec.ry, '#06B6D4');
    // Inner highlight
    paintCircle(body, w, h, 14, spec.cy - spec.ry * 0.25, spec.rx * 0.55, spec.ry * 0.45, '#67E8F9');
    // Eyes
    const eyeY = Math.round(spec.cy - 1);
    paintRect(body, w, h, 12, eyeY, 13, eyeY + 1, '#0F1115');
    paintRect(body, w, h, 18, eyeY, 19, eyeY + 1, '#0F1115');
    paintRect(body, w, h, 12, eyeY, 12, eyeY, '#FFFFFF');
    paintRect(body, w, h, 18, eyeY, 18, eyeY, '#FFFFFF');

    return {
      id: `seed_slime_f${idx + 1}`,
      name: `Frame ${idx + 1}`,
      durationMs: spec.dur,
      transition: spec.trans,
      transitionMs: 80,
      layers: [
        {
          id: `seed_slime_f${idx + 1}_l1`,
          name: 'Slime Body',
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: 'normal',
          pixelsRle: encodeRLE(body, w, h),
        },
      ],
      effects: [
        {
          id: `seed_slime_fx_${idx + 1}`,
          type: 'outline',
          enabled: false,
          intensity: 100,
          color: '#FFFFFF',
        },
      ],
    };
  });

  const slimeProject: Project = {
    id: 'seed_slime_bounce',
    name: 'Cyan Slime Bounce',
    type: 'video',
    width: w,
    height: h,
    createdAt: now - 7200_000,
    updatedAt: now - 900_000,
    frames: slimeFrames,
    activeFrameIndex: 0,
    activeLayerId: slimeFrames[0].layers[0].id,
    onionSkin: { ...DEFAULT_ONION_SKIN, enabled: true },
    palette: [...DEFAULT_PALETTES[0].colors],
    customBrushes: BUILTIN_BRUSHES.map((b) => ({ ...b, matrix: [...b.matrix] })),
  };

  return [knightProject, slimeProject];
}
