export type ProjectType = 'canvas' | 'video';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export type SymmetryMode =
  | 'none'
  | 'vertical'
  | 'horizontal'
  | 'quad'
  | 'radial4'
  | 'radial8';

export interface SymmetryOrigin {
  x: number;
  y: number;
}

export interface PalettePreset {
  id: string;
  name: string;
  colors: string[];
  isBuiltIn?: boolean;
}

export type ToolType =
  | 'pen'
  | 'eraser'
  | 'bucket'
  | 'eyedropper'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'move'
  | 'pan';

export type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'wipe-down'
  | 'pixel-dissolve'
  | 'flash-black';

export type EffectType =
  | 'outline'
  | 'drop-shadow'
  | 'glow'
  | 'scanlines'
  | 'glitch'
  | 'pixelate'
  | 'hue-shift'
  | 'grayscale'
  | 'invert'
  | 'dither-noise';

export interface FrameEffect {
  id: string;
  type: EffectType;
  enabled: boolean;
  intensity: number; // 0 to 100
  color?: string; // hex color for outline / shadow / glow
}

export interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 100
  blendMode: BlendMode;
  pixelsRle: string; // compact RLE-encoded RGBA data
}

export interface SerializedFrame {
  id: string;
  name: string;
  durationMs: number; // timing between this frame and next
  transition: TransitionType;
  transitionMs: number; // duration of transition into next frame
  layers: SerializedLayer[];
  effects: FrameEffect[];
}

export interface OnionSkinConfig {
  enabled: boolean;
  prevFrames: number; // 0..3
  nextFrames: number; // 0..3
  opacity: number; // 10..80
  tintEnabled: boolean;
  prevTint: string;
  nextTint: string;
}

export interface CustomBrush {
  id: string;
  name: string;
  size: number; // grid width/height (e.g., 1, 3, 5, 7, 9)
  matrix: number[]; // values 0..1 (opacity weight per cell)
  isBuiltIn?: boolean;
}

export interface BrushSettings {
  size: number; // 1..16
  opacity: number; // 1..100
  customBrushId: string;
  pressureSize: boolean;
  pressureOpacity: boolean;
  simulateVelocityPressure: boolean;
  shapeFilled: boolean;
  polygonSides: number; // 3..8
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  frames: SerializedFrame[];
  activeFrameIndex: number;
  activeLayerId: string;
  onionSkin: OnionSkinConfig;
  palette: string[];
  customBrushes: CustomBrush[];
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  frames: SerializedFrame[];
  activeFrameIndex: number;
  activeLayerId: string;
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}
