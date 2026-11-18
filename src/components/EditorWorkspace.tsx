import {
  ArrowLeft,
  Cloud,
  Download,
  Film,
  Grid,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compositeLayers,
  encodeRLE,
  renderTransitionFrame,
  replaceColorInFrameLayers,
} from '../engine/pixelMath';
import { createBlankFrame, createBlankLayer, uid } from '../engine/presets';
import type { WebsiteThemeConfig } from '../engine/themes';
import type {
  BrushSettings,
  CustomBrush,
  EffectType,
  FrameEffect,
  HistoryEntry,
  OnionSkinConfig,
  PalettePreset,
  Project,
  SerializedFrame,
  SerializedLayer,
  SymmetryMode,
  SymmetryOrigin,
  ToolType,
} from '../engine/types';
import { renderFrameToRgba } from '../services/exporter';
import { AnimationTimeline } from './AnimationTimeline';
import { ExportModal } from './ExportModal';
import { LeftToolbar } from './LeftToolbar';
import { PixelCanvas } from './PixelCanvas';
import { RightInspector } from './RightInspector';
import { ThemeSwitcherPopover } from './ThemeSwitcherPopover';

interface EditorWorkspaceProps {
  initialProject: Project;
  cloudConnected: boolean;
  cloudLabel: string;
  customPalettes: PalettePreset[];
  themeConfig: WebsiteThemeConfig;
  onChangeTheme: (next: WebsiteThemeConfig) => void;
  onSaveCustomPalette: (name: string, colors: string[]) => void;
  onDeleteCustomPalette: (paletteId: string) => void;
  onSaveProject: (project: Project) => Promise<void>;
  onOpenCloudModal: () => void;
  onBackHome: (latestProject: Project) => void;
}

function cloneFrames(frames: SerializedFrame[]): SerializedFrame[] {
  return frames.map((f) => ({
    ...f,
    layers: f.layers.map((l) => ({ ...l })),
    effects: f.effects.map((e) => ({ ...e })),
  }));
}

export function EditorWorkspace({
  initialProject,
  cloudConnected,
  cloudLabel,
  customPalettes,
  themeConfig,
  onChangeTheme,
  onSaveCustomPalette,
  onDeleteCustomPalette,
  onSaveProject,
  onOpenCloudModal,
  onBackHome,
}: EditorWorkspaceProps) {
  const [project, setProject] = useState<Project>(() => initialProject);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState(
    () => initialProject.palette[0] || '#3CF2EA'
  );
  const [symmetry, setSymmetry] = useState<SymmetryMode>('none');
  const [symmetryLocked, setSymmetryLocked] = useState(false);
  const [symmetryOrigin, setSymmetryOrigin] = useState<SymmetryOrigin>(() => {
    const center = { x: initialProject.width / 2, y: initialProject.height / 2 };
    if (typeof window === 'undefined') return center;
    try {
      const saved = window.localStorage.getItem(`aurora_symmetry_${initialProject.id}`);
      if (!saved) return center;
      const parsed = JSON.parse(saved);
      if (
        typeof parsed?.x === 'number' &&
        typeof parsed?.y === 'number' &&
        parsed.x >= 0.5 &&
        parsed.x <= initialProject.width - 0.5 &&
        parsed.y >= 0.5 &&
        parsed.y <= initialProject.height - 0.5
      ) {
        return { x: parsed.x, y: parsed.y };
      }
    } catch {
      // Ignore storage read errors
    }
    return center;
  });
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(() => {
    const maxDim = Math.max(initialProject.width, initialProject.height);
    const targetPx = typeof window !== 'undefined' && window.innerWidth < 768 ? 280 : 420;
    return Math.max(2, Math.min(24, Math.floor(targetPx / maxDim)));
  });
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 1,
    opacity: 100,
    customBrushId: initialProject.customBrushes[0]?.id || 'brush-pixel',
    pressureSize: true,
    pressureOpacity: false,
    simulateVelocityPressure: false,
    shapeFilled: true,
    polygonSides: 3,
  });

  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Undo / Redo History Manager
  const [history, setHistory] = useState<HistoryEntry[]>(() => [
    {
      id: uid('hist'),
      label: 'Initial State',
      timestamp: Date.now(),
      frames: cloneFrames(initialProject.frames),
      activeFrameIndex: initialProject.activeFrameIndex || 0,
      activeLayerId: initialProject.activeLayerId || initialProject.frames[0]?.layers[0]?.id || '',
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Auto-save tracking
  const dirtyRef = useRef(false);
  const latestProjectRef = useRef(project);
  latestProjectRef.current = project;
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number>(Date.now());

  // Animation playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(true);
  const [playbackBuffer, setPlaybackBuffer] = useState<Uint8ClampedArray | null>(null);

  const commitChange = useCallback(
    (
      updater: (prev: Project) => Project,
      label: string
    ) => {
      setProject((prev) => {
        const next = { ...updater(prev), updatedAt: Date.now() };
        const newEntry: HistoryEntry = {
          id: uid('hist'),
          label,
          timestamp: Date.now(),
          frames: cloneFrames(next.frames),
          activeFrameIndex: next.activeFrameIndex,
          activeLayerId: next.activeLayerId,
        };
        setHistory((hPrev) => {
          const sliced = hPrev.slice(0, historyIndex + 1);
          const appended = [...sliced, newEntry];
          if (appended.length > 100) appended.shift();
          return appended;
        });
        setHistoryIndex((idx) => Math.min(99, idx + 1));
        dirtyRef.current = true;
        setSaveState('unsaved');
        return next;
      });
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    const entry = history[targetIdx];
    if (!entry) return;
    setHistoryIndex(targetIdx);
    setProject((prev) => ({
      ...prev,
      frames: cloneFrames(entry.frames),
      activeFrameIndex: entry.activeFrameIndex,
      activeLayerId: entry.activeLayerId,
      updatedAt: Date.now(),
    }));
    dirtyRef.current = true;
    setSaveState('unsaved');
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const targetIdx = historyIndex + 1;
    const entry = history[targetIdx];
    if (!entry) return;
    setHistoryIndex(targetIdx);
    setProject((prev) => ({
      ...prev,
      frames: cloneFrames(entry.frames),
      activeFrameIndex: entry.activeFrameIndex,
      activeLayerId: entry.activeLayerId,
      updatedAt: Date.now(),
    }));
    dirtyRef.current = true;
    setSaveState('unsaved');
  }, [history, historyIndex]);

  const handleJumpToHistory = useCallback(
    (idx: number) => {
      const entry = history[idx];
      if (!entry) return;
      setHistoryIndex(idx);
      setProject((prev) => ({
        ...prev,
        frames: cloneFrames(entry.frames),
        activeFrameIndex: entry.activeFrameIndex,
        activeLayerId: entry.activeLayerId,
        updatedAt: Date.now(),
      }));
      dirtyRef.current = true;
      setSaveState('unsaved');
    },
    [history]
  );

  // Persist symmetry origin per project locally
  useEffect(() => {
    try {
      window.localStorage.setItem(
        `aurora_symmetry_${project.id}`,
        JSON.stringify(symmetryOrigin)
      );
    } catch {
      // Ignore quota errors
    }
  }, [project.id, symmetryOrigin]);

  // Auto-save every 3 seconds when project has changes
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSaveState('saving');
      try {
        await onSaveProject(latestProjectRef.current);
        setLastSavedAt(Date.now());
        setSaveState('saved');
      } catch {
        setSaveState('unsaved');
        dirtyRef.current = true;
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [onSaveProject]);

  // Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'b') setActiveTool('pen');
      else if (key === 'e') setActiveTool('eraser');
      else if (key === 'g') setActiveTool('bucket');
      else if (key === 'i') setActiveTool('eyedropper');
      else if (key === 'l') setActiveTool('line');
      else if (key === 'r') setActiveTool('rect');
      else if (key === 'o') setActiveTool('ellipse');
      else if (key === 'p') setActiveTool('polygon');
      else if (key === 'm') setActiveTool('move');
      else if (key === 'h') setActiveTool('pan');
      else if (key === '[') setBrushSettings((s) => ({ ...s, size: Math.max(1, s.size - 1) }));
      else if (key === ']') setBrushSettings((s) => ({ ...s, size: Math.min(16, s.size + 1) }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Real-time Animation Playback loop with Frame Timings & Transitions
  useEffect(() => {
    if (!isPlaying || project.frames.length < 2) {
      setPlaybackBuffer(null);
      return;
    }

    let cancelled = false;
    const rendered = project.frames.map((f) => renderFrameToRgba(f, project.width, project.height));
    let frameIdx = project.activeFrameIndex;
    let frameStartTime = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const frame = project.frames[frameIdx];
      const nextIdx = (frameIdx + 1) % project.frames.length;
      const elapsed = now - frameStartTime;

      const hasTransition = frame.transition !== 'cut' && frame.transitionMs > 0;
      const transMs = hasTransition ? Math.min(frame.transitionMs, frame.durationMs * 0.8) : 0;
      const holdMs = frame.durationMs - transMs;

      if (elapsed < holdMs) {
        setPlaybackBuffer(rendered[frameIdx]);
      } else if (elapsed < frame.durationMs && hasTransition) {
        const progress = (elapsed - holdMs) / transMs;
        setPlaybackBuffer(
          renderTransitionFrame(
            rendered[frameIdx],
            rendered[nextIdx],
            project.width,
            project.height,
            frame.transition,
            progress
          )
        );
      } else {
        if (nextIdx === 0 && !loopPlayback) {
          setIsPlaying(false);
          setPlaybackBuffer(null);
          return;
        }
        frameIdx = nextIdx;
        frameStartTime = now;
        setProject((p) => ({ ...p, activeFrameIndex: frameIdx }));
        setPlaybackBuffer(rendered[frameIdx]);
      }

      requestAnimationFrame(tick);
    };

    const rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, loopPlayback, project.frames, project.width, project.height, project.activeFrameIndex]);

  const activeFrame = project.frames[project.activeFrameIndex] || project.frames[0];
  const activeLayer =
    activeFrame.layers.find((l) => l.id === project.activeLayerId) || activeFrame.layers[0];
  const activeCustomBrush = project.customBrushes.find((b) => b.id === brushSettings.customBrushId);

  const handleCommitPixels = (newRle: string, label: string) => {
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        return {
          ...f,
          layers: f.layers.map((l) =>
            l.id === (activeLayer?.id || prev.activeLayerId) ? { ...l, pixelsRle: newRle } : l
          ),
        };
      });
      return { ...prev, frames };
    }, label);
  };

  const handleAddLayer = () => {
    const newLayer = createBlankLayer(
      project.width,
      project.height,
      `Layer ${activeFrame.layers.length + 1}`
    );
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) =>
        idx === prev.activeFrameIndex ? { ...f, layers: [...f.layers, newLayer] } : f
      );
      return { ...prev, frames, activeLayerId: newLayer.id };
    }, `Add ${newLayer.name}`);
  };

  const handleDuplicateLayer = (layerId: string) => {
    const src = activeFrame.layers.find((l) => l.id === layerId);
    if (!src) return;
    const copy: SerializedLayer = {
      ...src,
      id: uid('layer'),
      name: `${src.name} Copy`,
    };
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        const pos = f.layers.findIndex((l) => l.id === layerId);
        const nextLayers = [...f.layers];
        nextLayers.splice(pos + 1, 0, copy);
        return { ...f, layers: nextLayers };
      });
      return { ...prev, frames, activeLayerId: copy.id };
    }, `Duplicate ${src.name}`);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (activeFrame.layers.length <= 1) return;
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        return { ...f, layers: f.layers.filter((l) => l.id !== layerId) };
      });
      const remaining = frames[prev.activeFrameIndex].layers;
      return {
        ...prev,
        frames,
        activeLayerId: remaining[remaining.length - 1]?.id || '',
      };
    }, 'Delete Layer');
  };

  const handleMoveLayer = (layerId: string, dir: -1 | 1) => {
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        const pos = f.layers.findIndex((l) => l.id === layerId);
        const target = pos + dir;
        if (pos < 0 || target < 0 || target >= f.layers.length) return f;
        const nextLayers = [...f.layers];
        const [item] = nextLayers.splice(pos, 1);
        nextLayers.splice(target, 0, item);
        return { ...f, layers: nextLayers };
      });
      return { ...prev, frames };
    }, 'Reorder Layer');
  };

  const handleMergeLayerDown = (layerId: string) => {
    const pos = activeFrame.layers.findIndex((l) => l.id === layerId);
    if (pos <= 0) return;
    const bottom = activeFrame.layers[pos - 1];
    const top = activeFrame.layers[pos];
    const mergedBuf = compositeLayers([bottom, top], project.width, project.height);
    const mergedLayer: SerializedLayer = {
      ...bottom,
      opacity: 100,
      blendMode: 'normal',
      pixelsRle: encodeRLE(mergedBuf, project.width, project.height),
    };
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        const nextLayers = [...f.layers];
        nextLayers.splice(pos - 1, 2, mergedLayer);
        return { ...f, layers: nextLayers };
      });
      return { ...prev, frames, activeLayerId: mergedLayer.id };
    }, `Merge ${top.name}`);
  };

  const handleUpdateLayer = (layerId: string, patch: Partial<SerializedLayer>, label = 'Update Layer') => {
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        return {
          ...f,
          layers: f.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
        };
      });
      return { ...prev, frames };
    }, label);
  };

  const handleToggleEffect = (type: EffectType) => {
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        const existing = f.effects.find((e) => e.type === type);
        let nextEffects: FrameEffect[];
        if (existing) {
          nextEffects = f.effects.map((e) =>
            e.type === type ? { ...e, enabled: !e.enabled } : e
          );
        } else {
          nextEffects = [
            ...f.effects,
            {
              id: uid('fx'),
              type,
              enabled: true,
              intensity: 75,
              color: type === 'drop-shadow' ? '#000000' : type === 'glow' ? '#3CF2EA' : '#FFFFFF',
            },
          ];
        }
        return { ...f, effects: nextEffects };
      });
      return { ...prev, frames };
    }, `Toggle ${type} effect`);
  };

  const handleUpdateEffect = (type: EffectType, patch: Partial<FrameEffect>) => {
    commitChange((prev) => {
      const frames = prev.frames.map((f, idx) => {
        if (idx !== prev.activeFrameIndex) return f;
        return {
          ...f,
          effects: f.effects.map((e) => (e.type === type ? { ...e, ...patch } : e)),
        };
      });
      return { ...prev, frames };
    }, `Adjust ${type} effect`);
  };

  const handleApplyEffectsToAllFrames = () => {
    const sourceFx = activeFrame.effects.map((e) => ({ ...e }));
    commitChange((prev) => ({
      ...prev,
      frames: prev.frames.map((f) => ({
        ...f,
        effects: sourceFx.map((e) => ({ ...e, id: uid('fx') })),
      })),
    }), 'Sync Effects to All Frames');
  };

  // Frame Timeline Handlers
  const handleSelectFrame = (idx: number) => {
    setIsPlaying(false);
    setProject((prev) => {
      const targetFrame = prev.frames[idx];
      const keepLayer = targetFrame?.layers.some((l) => l.id === prev.activeLayerId);
      return {
        ...prev,
        activeFrameIndex: idx,
        activeLayerId: keepLayer
          ? prev.activeLayerId
          : targetFrame?.layers[0]?.id || prev.activeLayerId,
      };
    });
  };

  const handleAddFrame = () => {
    const blank = createBlankFrame(
      project.width,
      project.height,
      `Frame ${project.frames.length + 1}`,
      activeFrame.durationMs
    );
    commitChange((prev) => {
      const nextIdx = prev.activeFrameIndex + 1;
      const frames = [...prev.frames];
      frames.splice(nextIdx, 0, blank);
      return {
        ...prev,
        frames,
        activeFrameIndex: nextIdx,
        activeLayerId: blank.layers[0].id,
      };
    }, 'Add Frame');
  };

  const handleDuplicateFrame = (idx: number) => {
    const src = project.frames[idx];
    if (!src) return;
    const copy: SerializedFrame = {
      ...src,
      id: uid('frame'),
      name: `${src.name} Copy`,
      layers: src.layers.map((l) => ({ ...l, id: uid('layer') })),
      effects: src.effects.map((e) => ({ ...e, id: uid('fx') })),
    };
    commitChange((prev) => {
      const frames = [...prev.frames];
      frames.splice(idx + 1, 0, copy);
      return {
        ...prev,
        frames,
        activeFrameIndex: idx + 1,
        activeLayerId: copy.layers[0]?.id || '',
      };
    }, 'Duplicate Frame');
  };

  const handleDeleteFrame = (idx: number) => {
    if (project.frames.length <= 1) return;
    commitChange((prev) => {
      const frames = prev.frames.filter((_, i) => i !== idx);
      const nextIdx = Math.min(idx, frames.length - 1);
      return {
        ...prev,
        frames,
        activeFrameIndex: nextIdx,
        activeLayerId: frames[nextIdx]?.layers[0]?.id || '',
      };
    }, 'Delete Frame');
  };

  const handleMoveFrame = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= project.frames.length) return;
    commitChange((prev) => {
      const frames = [...prev.frames];
      const [item] = frames.splice(idx, 1);
      frames.splice(target, 0, item);
      return { ...prev, frames, activeFrameIndex: target };
    }, 'Reorder Frame');
  };

  const handleUpdateFrame = (idx: number, patch: Partial<SerializedFrame>) => {
    commitChange((prev) => ({
      ...prev,
      frames: prev.frames.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }), 'Update Frame Timing/Transition');
  };

  const handleUpdateOnionSkin = (patch: Partial<OnionSkinConfig>) => {
    setProject((prev) => {
      const next = { ...prev, onionSkin: { ...prev.onionSkin, ...patch }, updatedAt: Date.now() };
      dirtyRef.current = true;
      setSaveState('unsaved');
      return next;
    });
  };

  // Palette Management Handlers (all mark dirty so auto-save & Firestore sync persist them)
  const handleAddPaletteColor = (hex: string) => {
    const upper = hex.toUpperCase();
    setProject((p) => {
      if (p.palette.includes(upper) || p.palette.length >= 64) return p;
      dirtyRef.current = true;
      setSaveState('unsaved');
      return { ...p, palette: [...p.palette, upper], updatedAt: Date.now() };
    });
  };

  const handleSelectPalettePreset = (colors: string[]) => {
    const nextColors = colors.slice(0, 64).map((c) => c.toUpperCase());
    if (nextColors.length === 0) return;
    setProject((p) => ({ ...p, palette: nextColors, updatedAt: Date.now() }));
    setActiveColor(nextColors[0]);
    dirtyRef.current = true;
    setSaveState('unsaved');
  };

  const handleEditPaletteSwatch = (
    index: number,
    newHex: string,
    recolorFramePixels: boolean
  ) => {
    const oldHex = project.palette[index];
    const cleanNew = newHex.toUpperCase();
    if (!oldHex) return;

    if (recolorFramePixels && oldHex.toUpperCase() !== cleanNew) {
      commitChange((prev) => {
        const nextPalette = prev.palette.map((c, i) => (i === index ? cleanNew : c));
        const frames = prev.frames.map((f, fIdx) =>
          fIdx === prev.activeFrameIndex
            ? {
                ...f,
                layers: replaceColorInFrameLayers(
                  f.layers,
                  prev.width,
                  prev.height,
                  oldHex,
                  cleanNew
                ),
              }
            : f
        );
        return { ...prev, palette: nextPalette, frames };
      }, `Recolor Swatch ${oldHex} → ${cleanNew}`);
    } else {
      setProject((p) => ({
        ...p,
        palette: p.palette.map((c, i) => (i === index ? cleanNew : c)),
        updatedAt: Date.now(),
      }));
      dirtyRef.current = true;
      setSaveState('unsaved');
    }
  };

  const handleSwapPaletteSwatches = (indexA: number, indexB: number) => {
    if (indexA === indexB) return;
    setProject((p) => {
      if (
        indexA < 0 ||
        indexB < 0 ||
        indexA >= p.palette.length ||
        indexB >= p.palette.length
      ) {
        return p;
      }
      const next = [...p.palette];
      const temp = next[indexA];
      next[indexA] = next[indexB];
      next[indexB] = temp;
      return { ...p, palette: next, updatedAt: Date.now() };
    });
    dirtyRef.current = true;
    setSaveState('unsaved');
  };

  const handleRemovePaletteSwatch = (index: number) => {
    setProject((p) => {
      if (p.palette.length <= 1) return p;
      const next = p.palette.filter((_, i) => i !== index);
      return { ...p, palette: next, updatedAt: Date.now() };
    });
    dirtyRef.current = true;
    setSaveState('unsaved');
  };

  const handleBack = async () => {
    setIsPlaying(false);
    await onSaveProject(latestProjectRef.current);
    onBackHome(latestProjectRef.current);
  };

  return (
    <div className="h-screen w-screen bg-[var(--ui-bg-app)] text-[var(--ui-text-primary)] flex flex-col overflow-hidden transition-colors duration-200">
      {/* Studio Top Bar */}
      <header className="h-13 px-2.5 sm:px-4 bg-[var(--ui-bg-bar)] border-b border-[var(--ui-border)] flex items-center justify-between gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Home"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--ui-bg-card)] hover:bg-[var(--ui-bg-hover-strong)] border border-[var(--ui-border-strong)] text-xs font-medium text-[var(--ui-text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src="/assets/aistudio/Sans_titre_71_20261117215034_184958f0.png"
              alt=""
              className="w-4 h-4 rounded-sm object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>

          <input
            type="text"
            aria-label="Project title"
            value={project.name}
            onChange={(e) => {
              const name = e.target.value;
              setProject((p) => ({ ...p, name, updatedAt: Date.now() }));
              dirtyRef.current = true;
              setSaveState('unsaved');
            }}
            className="hidden sm:block bg-transparent border border-transparent hover:border-[var(--ui-border-strong)] focus:border-[var(--ui-accent)] focus:bg-[var(--ui-bg-app)] rounded px-2 py-1 text-sm font-semibold text-[var(--ui-text-primary)] w-36 lg:w-48 truncate focus:outline-none"
          />

          <span className="hidden md:inline font-mono text-xs text-[var(--ui-text-muted)] tabular-nums whitespace-nowrap shrink-0">
            {project.width} × {project.height} px
            {cursorCoords ? ` · ${cursorCoords.x}, ${cursorCoords.y}` : ''}
          </span>
        </div>

        {/* Center Undo/Redo + Zoom + Grid */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--ui-bg-app)] border border-[var(--ui-border)] rounded-lg p-0.5">
            <button
              type="button"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              aria-label="Undo (Ctrl+Z)"
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] disabled:opacity-35 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              aria-label="Redo (Ctrl+Y)"
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] disabled:opacity-35 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden sm:flex items-center bg-[var(--ui-bg-app)] border border-[var(--ui-border)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(2, Math.round(z * 0.8)))}
              aria-label="Zoom out"
              className="p-1.5 rounded text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-[var(--ui-text-primary)] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(32, Math.round(z * 1.25)))}
              aria-label="Zoom in"
              className="p-1.5 rounded text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            aria-pressed={showGrid}
            aria-label="Toggle pixel grid"
            title="Toggle pixel grid"
            className={`p-2 rounded-lg border text-xs cursor-pointer ${
              showGrid
                ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-accent)]'
                : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {project.type === 'canvas' && (
            <button
              type="button"
              onClick={() =>
                commitChange(
                  (p) => ({
                    ...p,
                    type: 'video',
                    frames:
                      p.frames.length === 1
                        ? [...p.frames, createBlankFrame(p.width, p.height, 'Frame 2', 150)]
                        : p.frames,
                  }),
                  'Convert to Animation Timeline'
                )
              }
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-accent-secondary)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Film className="w-3.5 h-3.5" />
              Animate
            </button>
          )}
        </div>

        {/* Right Auto-save status + Theme + Cloud + Export */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <span className="hidden xl:inline text-[11px] text-[var(--ui-text-muted)] font-mono tabular-nums whitespace-nowrap">
            {saveState === 'saving'
              ? 'Saving...'
              : saveState === 'unsaved'
              ? 'Pending save...'
              : `Saved · ${new Date(lastSavedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`}
          </span>

          <ThemeSwitcherPopover themeConfig={themeConfig} onChangeTheme={onChangeTheme} compact />

          <button
            type="button"
            onClick={onOpenCloudModal}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap shrink-0 cursor-pointer ${
              cloudConnected
                ? 'bg-[var(--ui-bg-hover)] border-[var(--ui-accent)]/50 text-[var(--ui-accent)]'
                : 'bg-[var(--ui-bg-card)] hover:bg-[var(--ui-bg-hover-strong)] border-[var(--ui-border-strong)] text-[var(--ui-text-primary)]'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            {cloudLabel}
          </button>

          <button
            type="button"
            onClick={() => setMobileInspectorOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--ui-bg-card)] hover:bg-[var(--ui-bg-hover-strong)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
            aria-label="Toggle studio inspector"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Studio
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-xs font-semibold text-[var(--ui-accent-contrast)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PNG</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        <LeftToolbar
          activeTool={activeTool}
          symmetry={symmetry}
          shapeFilled={brushSettings.shapeFilled}
          polygonSides={brushSettings.polygonSides}
          onSelectTool={setActiveTool}
          onSelectSymmetry={setSymmetry}
          onToggleShapeFilled={() =>
            setBrushSettings((s) => ({ ...s, shapeFilled: !s.shapeFilled }))
          }
          onChangePolygonSides={(sides) =>
            setBrushSettings((s) => ({ ...s, polygonSides: sides }))
          }
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PixelCanvas
            width={project.width}
            height={project.height}
            frames={project.frames}
            activeFrameIndex={project.activeFrameIndex}
            activeLayerId={project.activeLayerId}
            activeTool={activeTool}
            activeColor={activeColor}
            brushSettings={brushSettings}
            customBrush={activeCustomBrush}
            symmetry={symmetry}
            symmetryOrigin={symmetryOrigin}
            symmetryLocked={symmetryLocked}
            onionSkin={project.onionSkin}
            showGrid={showGrid}
            zoom={zoom}
            isPlaying={isPlaying}
            playbackBuffer={playbackBuffer}
            onZoomChange={setZoom}
            onSymmetryOriginChange={setSymmetryOrigin}
            onToggleSymmetryLock={() => setSymmetryLocked((l) => !l)}
            onResetSymmetryOrigin={() =>
              setSymmetryOrigin({ x: project.width / 2, y: project.height / 2 })
            }
            onCommitLayerPixels={handleCommitPixels}
            onPickColor={(hex) => setActiveColor(hex)}
            onCursorMove={setCursorCoords}
          />

          {project.type === 'video' && (
            <AnimationTimeline
              width={project.width}
              height={project.height}
              frames={project.frames}
              activeFrameIndex={project.activeFrameIndex}
              isPlaying={isPlaying}
              loopPlayback={loopPlayback}
              onionSkin={project.onionSkin}
              onSelectFrame={handleSelectFrame}
              onAddFrame={handleAddFrame}
              onDuplicateFrame={handleDuplicateFrame}
              onDeleteFrame={handleDeleteFrame}
              onMoveFrame={handleMoveFrame}
              onUpdateFrame={handleUpdateFrame}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onToggleLoop={() => setLoopPlayback((l) => !l)}
              onUpdateOnionSkin={handleUpdateOnionSkin}
            />
          )}
        </div>

        <RightInspector
          width={project.width}
          height={project.height}
          activeColor={activeColor}
          palette={project.palette}
          customPalettes={customPalettes}
          brushSettings={brushSettings}
          customBrushes={project.customBrushes}
          layers={activeFrame.layers}
          activeLayerId={activeLayer?.id || ''}
          effects={activeFrame.effects}
          history={history}
          historyIndex={historyIndex}
          isVideoProject={project.type === 'video'}
          onColorChange={setActiveColor}
          onAddPaletteColor={handleAddPaletteColor}
          onSelectPalettePreset={handleSelectPalettePreset}
          onEditPaletteSwatch={handleEditPaletteSwatch}
          onSwapPaletteSwatches={handleSwapPaletteSwatches}
          onRemovePaletteSwatch={handleRemovePaletteSwatch}
          onSaveCustomPalette={onSaveCustomPalette}
          onDeleteCustomPalette={onDeleteCustomPalette}
          onUpdateBrushSettings={(patch) => setBrushSettings((s) => ({ ...s, ...patch }))}
          onAddCustomBrush={(brush: CustomBrush) => {
            setProject((p) => ({
              ...p,
              customBrushes: [...p.customBrushes, brush],
              updatedAt: Date.now(),
            }));
            dirtyRef.current = true;
            setSaveState('unsaved');
          }}
          onSelectLayer={(id) => setProject((p) => ({ ...p, activeLayerId: id }))}
          onAddLayer={handleAddLayer}
          onDuplicateLayer={handleDuplicateLayer}
          onDeleteLayer={handleDeleteLayer}
          onMoveLayer={handleMoveLayer}
          onMergeLayerDown={handleMergeLayerDown}
          onUpdateLayer={handleUpdateLayer}
          onToggleEffect={handleToggleEffect}
          onUpdateEffect={handleUpdateEffect}
          onApplyEffectsToAllFrames={handleApplyEffectsToAllFrames}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onJumpToHistory={handleJumpToHistory}
          mobileOpen={mobileInspectorOpen}
          onCloseMobile={() => setMobileInspectorOpen(false)}
        />
      </div>

      <ExportModal
        isOpen={showExportModal}
        project={project}
        activeFrameIndex={project.activeFrameIndex}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}
