import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BookmarkPlus,
  Check,
  Copy,
  Eye,
  EyeOff,
  History,
  Layers,
  Lock,
  Merge,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Sliders,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_PALETTES } from '../engine/presets';
import type {
  BlendMode,
  BrushSettings,
  CustomBrush,
  EffectType,
  FrameEffect,
  HistoryEntry,
  PalettePreset,
  SerializedLayer,
} from '../engine/types';
import { FrameThumbnail } from './FrameThumbnail';

interface RightInspectorProps {
  width: number;
  height: number;
  activeColor: string;
  palette: string[];
  customPalettes: PalettePreset[];
  brushSettings: BrushSettings;
  customBrushes: CustomBrush[];
  layers: SerializedLayer[];
  activeLayerId: string;
  effects: FrameEffect[];
  history: HistoryEntry[];
  historyIndex: number;
  isVideoProject: boolean;
  onColorChange: (hex: string) => void;
  onAddPaletteColor: (hex: string) => void;
  onSelectPalettePreset: (colors: string[]) => void;
  onEditPaletteSwatch: (index: number, newHex: string, recolorFramePixels: boolean) => void;
  onSwapPaletteSwatches: (indexA: number, indexB: number) => void;
  onRemovePaletteSwatch: (index: number) => void;
  onSaveCustomPalette: (name: string, colors: string[]) => void;
  onDeleteCustomPalette: (paletteId: string) => void;
  onUpdateBrushSettings: (patch: Partial<BrushSettings>) => void;
  onAddCustomBrush: (brush: CustomBrush) => void;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onMoveLayer: (layerId: string, dir: -1 | 1) => void;
  onMergeLayerDown: (layerId: string) => void;
  onUpdateLayer: (layerId: string, patch: Partial<SerializedLayer>, label?: string) => void;
  onToggleEffect: (type: EffectType) => void;
  onUpdateEffect: (type: EffectType, patch: Partial<FrameEffect>) => void;
  onApplyEffectsToAllFrames: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToHistory: (index: number) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const BLEND_MODES: Array<{ value: BlendMode; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
];

const EFFECT_CATALOG: Array<{ type: EffectType; label: string; hasColor?: boolean; defaultColor?: string }> = [
  { type: 'outline', label: 'Sprite Outline', hasColor: true, defaultColor: '#FFFFFF' },
  { type: 'drop-shadow', label: 'Drop Shadow', hasColor: true, defaultColor: '#000000' },
  { type: 'glow', label: 'Ambient Glow', hasColor: true, defaultColor: '#3CF2EA' },
  { type: 'scanlines', label: 'CRT Scanlines' },
  { type: 'glitch', label: 'Chromatic Glitch' },
  { type: 'pixelate', label: 'Mosaic Pixelate' },
  { type: 'hue-shift', label: 'Hue Shift' },
  { type: 'dither-noise', label: 'Bayer Dither' },
  { type: 'grayscale', label: 'Grayscale' },
  { type: 'invert', label: 'Invert Colors' },
];

export function RightInspector({
  width,
  height,
  activeColor,
  palette,
  customPalettes,
  brushSettings,
  customBrushes,
  layers,
  activeLayerId,
  effects,
  history,
  historyIndex,
  isVideoProject,
  onColorChange,
  onAddPaletteColor,
  onSelectPalettePreset,
  onEditPaletteSwatch,
  onSwapPaletteSwatches,
  onRemovePaletteSwatch,
  onSaveCustomPalette,
  onDeleteCustomPalette,
  onUpdateBrushSettings,
  onAddCustomBrush,
  onSelectLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onMoveLayer,
  onMergeLayerDown,
  onUpdateLayer,
  onToggleEffect,
  onUpdateEffect,
  onApplyEffectsToAllFrames,
  onUndo,
  onRedo,
  onJumpToHistory,
  mobileOpen = false,
  onCloseMobile,
}: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<'brush' | 'layers' | 'effects' | 'history'>('brush');
  const [showBrushBuilder, setShowBrushBuilder] = useState(false);
  const [newBrushName, setNewBrushName] = useState('Custom Stamp');
  const [newBrushMatrix, setNewBrushMatrix] = useState<number[]>(() => {
    const m = Array(25).fill(0);
    m[2] = 1; m[7] = 1; m[10] = 1; m[11] = 1; m[12] = 1; m[13] = 1; m[14] = 1; m[17] = 1; m[22] = 1;
    return m;
  });

  // Palette Management State
  const [selectedSwatchIdx, setSelectedSwatchIdx] = useState(0);
  const [swapSourceIdx, setSwapSourceIdx] = useState<number | null>(null);
  const [draggedSwatchIdx, setDraggedSwatchIdx] = useState<number | null>(null);
  const [editingSwatchIdx, setEditingSwatchIdx] = useState<number | null>(null);
  const [editSwatchHex, setEditSwatchHex] = useState('#3CF2EA');
  const [recolorOnEdit, setRecolorOnEdit] = useState(false);
  const [showSavePalette, setShowSavePalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  useEffect(() => {
    if (selectedSwatchIdx >= palette.length) {
      setSelectedSwatchIdx(Math.max(0, palette.length - 1));
    }
    if (editingSwatchIdx !== null && editingSwatchIdx >= palette.length) {
      setEditingSwatchIdx(null);
    }
    if (swapSourceIdx !== null && swapSourceIdx >= palette.length) {
      setSwapSourceIdx(null);
    }
  }, [palette.length, selectedSwatchIdx, editingSwatchIdx, swapSourceIdx]);

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  const handleSaveCustomBrush = () => {
    const created: CustomBrush = {
      id: `custom_${Date.now()}`,
      name: newBrushName.trim() || 'Custom Brush',
      size: 5,
      matrix: [...newBrushMatrix],
    };
    onAddCustomBrush(created);
    onUpdateBrushSettings({ customBrushId: created.id, size: Math.max(brushSettings.size, 5) });
    setShowBrushBuilder(false);
  };

  const handleSwatchClick = (idx: number, hex: string) => {
    if (swapSourceIdx !== null) {
      if (swapSourceIdx !== idx) {
        onSwapPaletteSwatches(swapSourceIdx, idx);
        setSelectedSwatchIdx(idx);
      }
      setSwapSourceIdx(null);
      return;
    }
    setSelectedSwatchIdx(idx);
    onColorChange(hex);
    if (editingSwatchIdx !== null) {
      setEditingSwatchIdx(idx);
      setEditSwatchHex(hex);
    }
  };

  const handleApplySwatchEdit = () => {
    if (editingSwatchIdx === null) return;
    if (/^#[0-9A-Fa-f]{6}$/.test(editSwatchHex)) {
      onEditPaletteSwatch(editingSwatchIdx, editSwatchHex.toUpperCase(), recolorOnEdit);
      onColorChange(editSwatchHex.toUpperCase());
      setEditingSwatchIdx(null);
    }
  };

  const handleSaveNamedPalette = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaletteName.trim() || palette.length === 0) return;
    onSaveCustomPalette(newPaletteName.trim(), palette);
    setNewPaletteName('');
    setShowSavePalette(false);
  };

  const selectedCustomPreset = customPalettes.find((p) => p.id === selectedPresetId);

  return (
    <aside
      className={`${
        mobileOpen ? 'fixed inset-y-0 right-0 z-40 flex shadow-2xl' : 'hidden'
      } md:static md:flex w-80 max-w-[85vw] bg-[var(--ui-bg-bar)] border-l border-[var(--ui-border)] flex-col shrink-0 overflow-hidden`}
      aria-label="Studio inspector"
    >
      {mobileOpen && (
        <div className="md:hidden px-3 py-2 border-b border-[var(--ui-border)] flex items-center justify-between bg-[var(--ui-bg-panel)]">
          <span className="text-xs font-semibold text-[var(--ui-text-primary)]">Studio Inspector</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close inspector"
            className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Inspector Tabs */}
      <div className="grid grid-cols-4 border-b border-[var(--ui-border)] bg-[var(--ui-bg-panel)]" role="tablist">
        {[
          { id: 'brush', label: 'Brush', icon: Palette },
          { id: 'layers', label: 'Layers', icon: Layers },
          { id: 'effects', label: 'Effects', icon: Sliders },
          { id: 'history', label: 'History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-2.5 px-2 flex flex-col items-center gap-1 text-[11px] font-medium border-b-2 transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--ui-accent)] text-[var(--ui-accent)] bg-[var(--ui-bg-bar)]'
                  : 'border-transparent text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'brush' && (
          <>
            {/* Color Picker & Hex */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ui-text-primary)]">Active Color</h3>
                <button
                  type="button"
                  onClick={() => onAddPaletteColor(activeColor)}
                  className="text-[11px] text-[var(--ui-accent)] hover:underline cursor-pointer"
                >
                  + Save Swatch
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  aria-label="Color picker"
                  value={activeColor}
                  onChange={(e) => onColorChange(e.target.value.toUpperCase())}
                  className="w-10 h-10 rounded-lg border border-[var(--ui-border-strong)] bg-transparent cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  aria-label="Hex color code"
                  value={activeColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onColorChange(v.toUpperCase());
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-xs text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
                />
              </div>

              {/* Palette Management System */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--ui-border)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[var(--ui-text-secondary)]">
                    Palette ({palette.length}/64)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowSavePalette((v) => !v)}
                      title="Save current palette preset"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[10px] text-[var(--ui-accent)] cursor-pointer"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      Save Set
                    </button>
                  </div>
                </div>

                {/* Preset Switcher Row */}
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Load palette preset"
                    value={selectedPresetId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPresetId(id);
                      const found = [...customPalettes, ...DEFAULT_PALETTES].find((p) => p.id === id);
                      if (found) {
                        onSelectPalettePreset(found.colors);
                        setSelectedSwatchIdx(0);
                        setSwapSourceIdx(null);
                        setEditingSwatchIdx(null);
                      }
                    }}
                    className="flex-1 bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] rounded px-2 py-1 text-[11px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
                  >
                    <option value="">Switch Palette Preset...</option>
                    {customPalettes.length > 0 && (
                      <optgroup label="Saved Custom Palettes">
                        {customPalettes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.colors.length})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Studio Palettes">
                      {DEFAULT_PALETTES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.colors.length})
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {selectedCustomPreset && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCustomPalette(selectedCustomPreset.id);
                        setSelectedPresetId('');
                      }}
                      aria-label={`Delete saved palette ${selectedCustomPreset.name}`}
                      title="Delete saved custom palette"
                      className="p-1.5 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-[var(--ui-text-muted)] hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Save Named Palette Inline Form */}
                {showSavePalette && (
                  <form
                    onSubmit={handleSaveNamedPalette}
                    className="p-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      aria-label="New palette name"
                      value={newPaletteName}
                      onChange={(e) => setNewPaletteName(e.target.value)}
                      placeholder="Palette name..."
                      className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)] placeholder-[var(--ui-text-faint)] focus:outline-none focus:border-[var(--ui-accent)]"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-[11px] font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
                    >
                      Save
                    </button>
                  </form>
                )}

                {/* Interactive Swatch Grid (Click, Swap Mode, Drag & Drop) */}
                <div className="grid grid-cols-8 gap-1.5" role="list" aria-label="Color swatches">
                  {palette.map((hex, idx) => {
                    const isColorActive = activeColor.toUpperCase() === hex.toUpperCase();
                    const isSelectedSlot = selectedSwatchIdx === idx;
                    const isSwapSource = swapSourceIdx === idx;
                    return (
                      <button
                        key={`${hex}-${idx}`}
                        type="button"
                        draggable
                        onDragStart={() => setDraggedSwatchIdx(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedSwatchIdx !== null && draggedSwatchIdx !== idx) {
                            onSwapPaletteSwatches(draggedSwatchIdx, idx);
                            setSelectedSwatchIdx(idx);
                          }
                          setDraggedSwatchIdx(null);
                        }}
                        onDragEnd={() => setDraggedSwatchIdx(null)}
                        onClick={() => handleSwatchClick(idx, hex)}
                        aria-label={`Swatch ${idx + 1}: ${hex}`}
                        title={`#${idx + 1} ${hex} (Drag to swap)`}
                        className={`w-full aspect-square rounded border transition-transform cursor-pointer ${
                          isSwapSource
                            ? 'border-[var(--ui-accent-secondary)] scale-110 ring-2 ring-[var(--ui-accent-secondary)]'
                            : isSelectedSlot || isColorActive
                            ? 'border-[var(--ui-text-primary)] scale-110 ring-1 ring-[var(--ui-accent)]'
                            : 'border-[var(--ui-border-strong)] hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>

                {/* Swap Mode Status Prompt */}
                {swapSourceIdx !== null && (
                  <div
                    className="px-2.5 py-1.5 rounded border flex items-center justify-between text-[11px] text-[var(--ui-text-primary)]"
                    style={{
                      backgroundColor: 'var(--ui-accent-secondary-soft)',
                      borderColor: 'var(--ui-accent-secondary)',
                    }}
                  >
                    <span>Click another swatch to swap with #{swapSourceIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setSwapSourceIdx(null)}
                      className="font-semibold text-[var(--ui-text-primary)] hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Swatch Management Toolbar (Edit, Swap, Remove) */}
                {palette[selectedSwatchIdx] && (
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <span className="font-mono text-[10px] text-[var(--ui-text-muted)] tabular-nums truncate">
                      #{selectedSwatchIdx + 1} · {palette[selectedSwatchIdx]}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingSwatchIdx === selectedSwatchIdx) {
                            setEditingSwatchIdx(null);
                          } else {
                            setEditingSwatchIdx(selectedSwatchIdx);
                            setEditSwatchHex(palette[selectedSwatchIdx]);
                            setSwapSourceIdx(null);
                          }
                        }}
                        aria-label="Edit selected swatch"
                        title="Edit selected swatch"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer ${
                          editingSwatchIdx === selectedSwatchIdx
                            ? 'bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)] font-semibold'
                            : 'bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[var(--ui-text-primary)]'
                        }`}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSwatchIdx(null);
                          setSwapSourceIdx((prev) =>
                            prev === selectedSwatchIdx ? null : selectedSwatchIdx
                          );
                        }}
                        aria-label="Swap swatch position"
                        title="Swap swatch with another slot"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer ${
                          swapSourceIdx !== null
                            ? 'bg-[var(--ui-accent-secondary)] text-[var(--ui-accent-contrast)] font-semibold'
                            : 'bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[var(--ui-text-primary)]'
                        }`}
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                        Swap
                      </button>
                      <button
                        type="button"
                        disabled={palette.length <= 1}
                        onClick={() => {
                          onRemovePaletteSwatch(selectedSwatchIdx);
                          setEditingSwatchIdx(null);
                          setSwapSourceIdx(null);
                        }}
                        aria-label="Remove selected swatch"
                        title="Remove swatch"
                        className="p-1 rounded bg-[var(--ui-bg-hover)] hover:bg-red-500/20 hover:text-red-500 disabled:opacity-35 text-[var(--ui-text-muted)] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Swatch Editor */}
                {editingSwatchIdx !== null && palette[editingSwatchIdx] && (
                  <div className="p-2.5 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-accent)] space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Edit swatch color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(editSwatchHex) ? editSwatchHex : '#3CF2EA'}
                        onChange={(e) => setEditSwatchHex(e.target.value.toUpperCase())}
                        className="w-8 h-8 rounded border border-[var(--ui-border-strong)] bg-transparent cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        aria-label="Edit swatch hex code"
                        value={editSwatchHex}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setEditSwatchHex(v.toUpperCase());
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] font-mono text-xs text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
                      />
                      <button
                        type="button"
                        onClick={handleApplySwatchEdit}
                        aria-label="Apply swatch edit"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-[11px] font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Apply
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-[var(--ui-text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recolorOnEdit}
                        onChange={(e) => setRecolorOnEdit(e.target.checked)}
                        className="accent-[var(--ui-accent)] w-3.5 h-3.5"
                      />
                      <span>Also recolor matching pixels on active frame</span>
                    </label>
                  </div>
                )}
              </div>
            </section>

            {/* Pen Opacity & Brush Size */}
            <section className="pt-4 border-t border-[var(--ui-border)] space-y-3.5">
              <h3 className="text-xs font-semibold text-[var(--ui-text-primary)]">Pen &amp; Pressure Dynamics</h3>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="pen-opacity-slider" className="text-[var(--ui-text-secondary)]">
                    Pen Opacity
                  </label>
                  <span className="font-mono text-[var(--ui-accent)] tabular-nums">{brushSettings.opacity}%</span>
                </div>
                <input
                  id="pen-opacity-slider"
                  type="range"
                  min={1}
                  max={100}
                  value={brushSettings.opacity}
                  onChange={(e) => onUpdateBrushSettings({ opacity: Number(e.target.value) })}
                  className="w-full studio-slider"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="brush-size-slider" className="text-[var(--ui-text-secondary)]">
                    Brush Size
                  </label>
                  <span className="font-mono text-[var(--ui-accent)] tabular-nums">{brushSettings.size} px</span>
                </div>
                <input
                  id="brush-size-slider"
                  type="range"
                  min={1}
                  max={16}
                  value={brushSettings.size}
                  onChange={(e) => onUpdateBrushSettings({ size: Number(e.target.value) })}
                  className="w-full studio-slider"
                />
              </div>

              {/* Pressure Sensitivity Controls */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center justify-between text-xs text-[var(--ui-text-secondary)] cursor-pointer">
                  <span>Pressure controls Size</span>
                  <input
                    type="checkbox"
                    checked={brushSettings.pressureSize}
                    onChange={(e) => onUpdateBrushSettings({ pressureSize: e.target.checked })}
                    className="accent-[var(--ui-accent)] w-3.5 h-3.5"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-[var(--ui-text-secondary)] cursor-pointer">
                  <span>Pressure controls Opacity</span>
                  <input
                    type="checkbox"
                    checked={brushSettings.pressureOpacity}
                    onChange={(e) => onUpdateBrushSettings({ pressureOpacity: e.target.checked })}
                    className="accent-[var(--ui-accent)] w-3.5 h-3.5"
                  />
                </label>
                <label className="flex items-center justify-between text-xs text-[var(--ui-text-secondary)] cursor-pointer">
                  <span>Simulate Velocity Pressure (Mouse)</span>
                  <input
                    type="checkbox"
                    checked={brushSettings.simulateVelocityPressure}
                    onChange={(e) =>
                      onUpdateBrushSettings({ simulateVelocityPressure: e.target.checked })
                    }
                    className="accent-[var(--ui-accent)] w-3.5 h-3.5"
                  />
                </label>
              </div>
            </section>

            {/* Custom Brushes */}
            <section className="pt-4 border-t border-[var(--ui-border)] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--ui-text-primary)]">Custom Brushes</h3>
                <button
                  type="button"
                  onClick={() => setShowBrushBuilder((v) => !v)}
                  className="text-[11px] text-[var(--ui-accent)] hover:underline cursor-pointer"
                >
                  {showBrushBuilder ? 'Close Editor' : '+ Create Brush'}
                </button>
              </div>

              {showBrushBuilder && (
                <div className="p-3 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] space-y-2.5">
                  <input
                    type="text"
                    value={newBrushName}
                    onChange={(e) => setNewBrushName(e.target.value)}
                    placeholder="Brush name"
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)] placeholder-[var(--ui-text-faint)]"
                  />
                  <div className="grid grid-cols-5 gap-1 w-32 mx-auto">
                    {newBrushMatrix.map((val, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const next = [...newBrushMatrix];
                          next[idx] = next[idx] > 0 ? 0 : 1;
                          setNewBrushMatrix(next);
                        }}
                        aria-label={`Brush cell ${idx + 1}`}
                        className={`aspect-square rounded-sm border cursor-pointer ${
                          val > 0
                            ? 'bg-[var(--ui-accent)] border-[var(--ui-accent-hover)]'
                            : 'bg-[var(--ui-bg-panel)] border-[var(--ui-border-strong)]'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveCustomBrush}
                    className="w-full py-1.5 rounded bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-xs font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
                  >
                    Save Custom Brush
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                {customBrushes.map((brush) => {
                  const active = brushSettings.customBrushId === brush.id;
                  return (
                    <button
                      key={brush.id}
                      type="button"
                      onClick={() => onUpdateBrushSettings({ customBrushId: brush.id })}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                          : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:border-[var(--ui-border-hover)]'
                      }`}
                    >
                      <div
                        className="w-5 h-5 shrink-0 grid gap-px bg-[var(--ui-bg-panel)] p-0.5 rounded"
                        style={{ gridTemplateColumns: `repeat(${brush.size}, minmax(0, 1fr))` }}
                      >
                        {brush.matrix.map((cell, i) => (
                          <span
                            key={i}
                            className="block w-full h-full"
                            style={{
                              backgroundColor: cell > 0 ? 'var(--ui-text-primary)' : 'transparent',
                              opacity: cell > 0 ? cell : 1,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] truncate">{brush.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {activeTab === 'layers' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--ui-text-primary)]">Layers ({layers.length})</h3>
              <button
                type="button"
                onClick={onAddLayer}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-[11px] font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add Layer
              </button>
            </div>

            {/* Active Layer Blend Mode & Opacity */}
            {activeLayer && (
              <div className="p-3 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border)] space-y-3">
                <div>
                  <label htmlFor="layer-blend-select" className="block text-[11px] text-[var(--ui-text-muted)] mb-1">
                    Blend Mode — {activeLayer.name}
                  </label>
                  <select
                    id="layer-blend-select"
                    value={activeLayer.blendMode}
                    onChange={(e) =>
                      onUpdateLayer(
                        activeLayer.id,
                        { blendMode: e.target.value as BlendMode },
                        `Blend Mode: ${e.target.value}`
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
                  >
                    {BLEND_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <label htmlFor="layer-opacity-slider" className="text-[var(--ui-text-muted)]">
                      Layer Opacity
                    </label>
                    <span className="font-mono text-[var(--ui-accent)] tabular-nums">{activeLayer.opacity}%</span>
                  </div>
                  <input
                    id="layer-opacity-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={activeLayer.opacity}
                    onChange={(e) =>
                      onUpdateLayer(
                        activeLayer.id,
                        { opacity: Number(e.target.value) },
                        `Layer Opacity: ${e.target.value}%`
                      )
                    }
                    className="w-full studio-slider"
                  />
                </div>
              </div>
            )}

            {/* Layer Stack (Top layer displayed first) */}
            <div className="space-y-1.5">
              {[...layers].reverse().map((layer) => {
                const isSelected = layer.id === activeLayerId;
                const realIdx = layers.findIndex((l) => l.id === layer.id);
                return (
                  <div
                    key={layer.id}
                    className={`p-2 rounded-lg border flex items-center gap-2 transition-colors ${
                      isSelected
                        ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)]'
                        : 'bg-[var(--ui-bg-panel)] border-[var(--ui-border)] hover:border-[var(--ui-border-hover)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectLayer(layer.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <FrameThumbnail
                        layer={layer}
                        width={width}
                        height={height}
                        className="w-9 h-9 rounded border border-[var(--ui-border-strong)] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[var(--ui-text-primary)] truncate">{layer.name}</div>
                        <div className="text-[10px] font-mono text-[var(--ui-text-muted)] truncate">
                          {layer.blendMode} · {layer.opacity}%
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLayer(layer.id, { visible: !layer.visible }, 'Toggle Visibility')
                        }
                        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                        className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] cursor-pointer"
                      >
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLayer(layer.id, { locked: !layer.locked }, 'Toggle Lock')
                        }
                        aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                        className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] cursor-pointer"
                      >
                        {layer.locked ? (
                          <Lock className="w-3.5 h-3.5 text-[var(--ui-accent-secondary)]" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={realIdx >= layers.length - 1}
                        onClick={() => onMoveLayer(layer.id, 1)}
                        aria-label={`Move ${layer.name} up`}
                        className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={realIdx <= 0}
                        onClick={() => onMoveLayer(layer.id, -1)}
                        aria-label={`Move ${layer.name} down`}
                        className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Layer Quick Actions */}
            {activeLayer && (
              <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => onDuplicateLayer(activeLayer.id)}
                  className="flex-1 py-1.5 px-2 rounded bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[11px] text-[var(--ui-text-primary)] inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Duplicate
                </button>
                <button
                  type="button"
                  disabled={layers.findIndex((l) => l.id === activeLayer.id) <= 0}
                  onClick={() => onMergeLayerDown(activeLayer.id)}
                  className="flex-1 py-1.5 px-2 rounded bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] disabled:opacity-40 text-[11px] text-[var(--ui-text-primary)] inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Merge className="w-3 h-3" />
                  Merge
                </button>
                <button
                  type="button"
                  disabled={layers.length <= 1}
                  onClick={() => onDeleteLayer(activeLayer.id)}
                  className="py-1.5 px-2.5 rounded bg-[var(--ui-bg-hover)] hover:bg-red-500/20 hover:text-red-500 disabled:opacity-40 text-[11px] text-[var(--ui-text-muted)] cursor-pointer"
                  aria-label="Delete active layer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'effects' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--ui-text-primary)]">Frame Visual Effects</h3>
              {isVideoProject && (
                <button
                  type="button"
                  onClick={onApplyEffectsToAllFrames}
                  className="text-[11px] text-[var(--ui-accent)] hover:underline cursor-pointer"
                >
                  Sync to All Frames
                </button>
              )}
            </div>
            <p className="text-[11px] text-[var(--ui-text-muted)]">
              Non-destructive pixel shaders applied to the active frame and included in PNG/Video exports.
            </p>

            <div className="space-y-2">
              {EFFECT_CATALOG.map((item) => {
                const activeFx = effects.find((e) => e.type === item.type);
                const enabled = Boolean(activeFx?.enabled);
                return (
                  <div
                    key={item.type}
                    className={`p-2.5 rounded-lg border space-y-2 ${
                      enabled
                        ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)]'
                        : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-[var(--ui-text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => onToggleEffect(item.type)}
                          className="accent-[var(--ui-accent)] w-3.5 h-3.5"
                        />
                        <span>{item.label}</span>
                      </label>
                      {enabled && item.hasColor && (
                        <input
                          type="color"
                          aria-label={`${item.label} color`}
                          value={activeFx?.color || item.defaultColor || '#FFFFFF'}
                          onChange={(e) => onUpdateEffect(item.type, { color: e.target.value })}
                          className="w-6 h-5 rounded border border-[var(--ui-border-strong)] bg-transparent cursor-pointer"
                        />
                      )}
                    </div>
                    {enabled && (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={5}
                          max={100}
                          aria-label={`${item.label} intensity`}
                          value={activeFx?.intensity ?? 75}
                          onChange={(e) =>
                            onUpdateEffect(item.type, { intensity: Number(e.target.value) })
                          }
                          className="flex-1 studio-slider"
                        />
                        <span className="font-mono text-[11px] text-[var(--ui-text-secondary)] w-9 text-right tabular-nums">
                          {activeFx?.intensity ?? 75}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--ui-text-primary)]">Undo &amp; Redo History</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={historyIndex <= 0}
                  onClick={onUndo}
                  aria-label="Undo step"
                  className="p-1.5 rounded bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] disabled:opacity-35 text-[var(--ui-text-primary)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={historyIndex >= history.length - 1}
                  onClick={onRedo}
                  aria-label="Redo step"
                  className="p-1.5 rounded bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] disabled:opacity-35 text-[var(--ui-text-primary)] cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {history.map((entry, idx) => {
                const isCurrent = idx === historyIndex;
                const isFuture = idx > historyIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onJumpToHistory(idx)}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--ui-bg-active)] border border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                        : isFuture
                        ? 'bg-[var(--ui-bg-app)] text-[var(--ui-text-faint)] hover:text-[var(--ui-text-secondary)]'
                        : 'bg-[var(--ui-bg-panel)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)]'
                    }`}
                  >
                    <span className="truncate font-medium">
                      {idx + 1}. {entry.label}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ui-text-muted)] shrink-0 ml-2 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
