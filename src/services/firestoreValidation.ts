import type { Project } from '../engine/types';

export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  ID_MAX: 128,
  DISPLAY_NAME_MAX: 80,
  EMAIL_MAX: 160,
  PROJECT_NAME_MAX: 120,
  CANVAS_MIN: 4,
  CANVAS_MAX: 256,
  PALETTE_MAX: 64,
  CUSTOM_BRUSHES_MAX: 32,
  FRAMES_MAX: 120,
} as const;

export function validateUserProfilePayload(
  data: Record<string, unknown>,
  expectedUid: string
): { ok: boolean; reason?: string } {
  const allowed = new Set(['uid', 'displayName', 'email', 'createdAt', 'updatedAt']);
  for (const key of allowed) {
    if (!(key in data)) return { ok: false, reason: `Missing ${key}` };
  }
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) return { ok: false, reason: `Unexpected field ${key}` };
  }
  if (
    typeof data.uid !== 'string' ||
    data.uid !== expectedUid ||
    data.uid.length > BLUEPRINT_LIMITS.ID_MAX ||
    !BLUEPRINT_LIMITS.ID_PATTERN.test(data.uid)
  ) {
    return { ok: false, reason: 'Invalid uid' };
  }
  if (
    typeof data.displayName !== 'string' ||
    data.displayName.length < 1 ||
    data.displayName.length > BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
  ) {
    return { ok: false, reason: 'Invalid displayName' };
  }
  if (
    typeof data.email !== 'string' ||
    data.email.length < 3 ||
    data.email.length > BLUEPRINT_LIMITS.EMAIL_MAX
  ) {
    return { ok: false, reason: 'Invalid email' };
  }
  return { ok: true };
}

export function validateProjectPayload(
  data: Record<string, unknown>,
  expectedUid: string
): { ok: boolean; reason?: string } {
  const required = [
    'id',
    'ownerId',
    'name',
    'type',
    'width',
    'height',
    'activeFrameIndex',
    'activeLayerId',
    'onionSkin',
    'palette',
    'customBrushes',
    'frames',
    'createdAt',
    'updatedAt',
  ];
  const allowed = new Set(required);
  for (const key of required) {
    if (!(key in data)) return { ok: false, reason: `Missing ${key}` };
  }
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) return { ok: false, reason: `Unexpected field ${key}` };
  }
  if (
    typeof data.id !== 'string' ||
    data.id.length < 1 ||
    data.id.length > BLUEPRINT_LIMITS.ID_MAX ||
    !BLUEPRINT_LIMITS.ID_PATTERN.test(data.id)
  ) {
    return { ok: false, reason: 'Invalid project id' };
  }
  if (
    typeof data.ownerId !== 'string' ||
    data.ownerId !== expectedUid ||
    data.ownerId.length > BLUEPRINT_LIMITS.ID_MAX ||
    !BLUEPRINT_LIMITS.ID_PATTERN.test(data.ownerId)
  ) {
    return { ok: false, reason: 'Invalid ownerId' };
  }
  if (
    typeof data.name !== 'string' ||
    data.name.length < 1 ||
    data.name.length > BLUEPRINT_LIMITS.PROJECT_NAME_MAX
  ) {
    return { ok: false, reason: 'Invalid project name' };
  }
  if (data.type !== 'canvas' && data.type !== 'video') {
    return { ok: false, reason: 'Invalid project type' };
  }
  if (
    typeof data.width !== 'number' ||
    !Number.isInteger(data.width) ||
    data.width < BLUEPRINT_LIMITS.CANVAS_MIN ||
    data.width > BLUEPRINT_LIMITS.CANVAS_MAX ||
    typeof data.height !== 'number' ||
    !Number.isInteger(data.height) ||
    data.height < BLUEPRINT_LIMITS.CANVAS_MIN ||
    data.height > BLUEPRINT_LIMITS.CANVAS_MAX
  ) {
    return { ok: false, reason: 'Invalid canvas dimensions' };
  }
  if (
    !Array.isArray(data.palette) ||
    data.palette.length < 1 ||
    data.palette.length > BLUEPRINT_LIMITS.PALETTE_MAX ||
    typeof data.palette[0] !== 'string'
  ) {
    return { ok: false, reason: 'Invalid palette' };
  }
  if (
    !Array.isArray(data.customBrushes) ||
    data.customBrushes.length < 1 ||
    data.customBrushes.length > BLUEPRINT_LIMITS.CUSTOM_BRUSHES_MAX ||
    typeof data.customBrushes[0] !== 'object' ||
    data.customBrushes[0] === null
  ) {
    return { ok: false, reason: 'Invalid customBrushes' };
  }
  if (
    !Array.isArray(data.frames) ||
    data.frames.length < 1 ||
    data.frames.length > BLUEPRINT_LIMITS.FRAMES_MAX ||
    typeof data.frames[0] !== 'object' ||
    data.frames[0] === null
  ) {
    return { ok: false, reason: 'Invalid frames' };
  }
  if (
    typeof data.activeFrameIndex !== 'number' ||
    !Number.isInteger(data.activeFrameIndex) ||
    data.activeFrameIndex < 0 ||
    data.activeFrameIndex >= data.frames.length
  ) {
    return { ok: false, reason: 'Invalid activeFrameIndex' };
  }
  if (
    typeof data.activeLayerId !== 'string' ||
    data.activeLayerId.length < 1 ||
    data.activeLayerId.length > BLUEPRINT_LIMITS.ID_MAX
  ) {
    return { ok: false, reason: 'Invalid activeLayerId' };
  }
  if (typeof data.onionSkin !== 'object' || data.onionSkin === null) {
    return { ok: false, reason: 'Invalid onionSkin' };
  }
  return { ok: true };
}

function toValidFirestoreId(raw: string | undefined, prefix: string): string {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, BLUEPRINT_LIMITS.ID_MAX);
  return cleaned.length >= 1 ? cleaned : `${prefix}_${Date.now().toString(36)}`;
}

export function sanitizeProjectForFirestore(project: Project, ownerId: string) {
  const safeId = toValidFirestoreId(project.id, 'proj');
  const safeName =
    (project.name || 'Untitled Project').trim().slice(0, BLUEPRINT_LIMITS.PROJECT_NAME_MAX) ||
    'Untitled Project';
  const frames = project.frames.slice(0, BLUEPRINT_LIMITS.FRAMES_MAX).map((f) => ({
    id: toValidFirestoreId(f.id, 'frame'),
    name: (f.name || 'Frame').slice(0, 80),
    durationMs: Math.max(30, Math.min(10000, Math.round(f.durationMs || 150))),
    transition: f.transition || 'cut',
    transitionMs: Math.max(0, Math.min(2000, Math.round(f.transitionMs || 120))),
    layers: f.layers.slice(0, 32).map((l) => ({
      id: toValidFirestoreId(l.id, 'layer'),
      name: (l.name || 'Layer').slice(0, 80),
      visible: Boolean(l.visible),
      locked: Boolean(l.locked),
      opacity: Math.max(0, Math.min(100, Math.round(l.opacity ?? 100))),
      blendMode: l.blendMode || 'normal',
      pixelsRle: l.pixelsRle || '',
    })),
    effects: (f.effects || []).slice(0, 16).map((fx) => ({
      id: toValidFirestoreId(fx.id, 'fx'),
      type: fx.type,
      enabled: Boolean(fx.enabled),
      intensity: Math.max(0, Math.min(100, Math.round(fx.intensity ?? 75))),
      color: fx.color || '#FFFFFF',
    })),
  }));

  const safeActiveFrameIndex = Math.max(0, Math.min(frames.length - 1, Math.round(project.activeFrameIndex || 0)));
  const fallbackLayerId = frames[safeActiveFrameIndex]?.layers[0]?.id || frames[0]?.layers[0]?.id || 'layer_1';

  return {
    id: safeId,
    ownerId,
    name: safeName,
    type: project.type === 'video' ? ('video' as const) : ('canvas' as const),
    width: Math.max(BLUEPRINT_LIMITS.CANVAS_MIN, Math.min(BLUEPRINT_LIMITS.CANVAS_MAX, Math.round(project.width))),
    height: Math.max(BLUEPRINT_LIMITS.CANVAS_MIN, Math.min(BLUEPRINT_LIMITS.CANVAS_MAX, Math.round(project.height))),
    activeFrameIndex: safeActiveFrameIndex,
    activeLayerId: toValidFirestoreId(project.activeLayerId || fallbackLayerId, 'layer'),
    onionSkin: { ...project.onionSkin },
    palette: (project.palette.length > 0 ? project.palette : ['#0B142E']).slice(0, BLUEPRINT_LIMITS.PALETTE_MAX),
    customBrushes: (project.customBrushes.length > 0
      ? project.customBrushes
      : [{ id: 'brush-pixel', name: 'Crisp Pixel', size: 1, matrix: [1] }]
    )
      .slice(0, BLUEPRINT_LIMITS.CUSTOM_BRUSHES_MAX)
      .map((b) => ({
        id: toValidFirestoreId(b.id, 'brush'),
        name: b.name.slice(0, 60),
        size: b.size,
        matrix: b.matrix.slice(0, 100),
      })),
    frames,
  };
}
