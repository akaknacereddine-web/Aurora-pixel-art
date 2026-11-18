import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { OnionSkinConfig, SerializedFrame, TransitionType } from '../engine/types';
import { FrameThumbnail } from './FrameThumbnail';

interface AnimationTimelineProps {
  width: number;
  height: number;
  frames: SerializedFrame[];
  activeFrameIndex: number;
  isPlaying: boolean;
  loopPlayback: boolean;
  onionSkin: OnionSkinConfig;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: (index: number) => void;
  onDeleteFrame: (index: number) => void;
  onMoveFrame: (index: number, dir: -1 | 1) => void;
  onUpdateFrame: (index: number, patch: Partial<SerializedFrame>) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onUpdateOnionSkin: (patch: Partial<OnionSkinConfig>) => void;
}

const TRANSITION_OPTIONS: Array<{ value: TransitionType; label: string }> = [
  { value: 'cut', label: 'Cut' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'wipe-down', label: 'Wipe Down' },
  { value: 'pixel-dissolve', label: 'Dissolve' },
  { value: 'flash-black', label: 'Fade Black' },
];

export function AnimationTimeline({
  width,
  height,
  frames,
  activeFrameIndex,
  isPlaying,
  loopPlayback,
  onionSkin,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onMoveFrame,
  onUpdateFrame,
  onTogglePlay,
  onToggleLoop,
  onUpdateOnionSkin,
}: AnimationTimelineProps) {
  const [showOnionPopover, setShowOnionPopover] = useState(false);

  const totalDurationMs = frames.reduce((acc, f) => acc + f.durationMs, 0);
  const activeFrame = frames[activeFrameIndex];

  return (
    <section
      className="h-52 bg-[var(--ui-bg-bar)] border-t border-[var(--ui-border)] flex flex-col shrink-0 select-none"
      aria-label="Animation timeline"
    >
      {/* Timeline Control Bar */}
      <div className="min-h-11 px-2.5 sm:px-4 py-1.5 border-b border-[var(--ui-border)] flex items-center justify-between gap-2 sm:gap-4 bg-[var(--ui-bg-panel)] overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-xs font-semibold text-[var(--ui-accent-contrast)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            aria-pressed={loopPlayback}
            aria-label="Toggle loop playback"
            title="Loop animation"
            className={`p-1.5 rounded-md border text-xs shrink-0 cursor-pointer ${
              loopPlayback
                ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-accent)]'
                : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-xs text-[var(--ui-text-muted)] ml-1 sm:ml-2 tabular-nums whitespace-nowrap shrink-0">
            <span className="sm:hidden">
              {activeFrameIndex + 1}/{frames.length}
            </span>
            <span className="hidden sm:inline">
              Frame {activeFrameIndex + 1}/{frames.length} · {(totalDurationMs / 1000).toFixed(2)}s total
            </span>
          </span>
        </div>

        {/* Active Frame Quick Timing & Onion Skinning */}
        <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0">
          {activeFrame && (
            <div className="hidden sm:flex items-center gap-2 text-xs shrink-0">
              <label htmlFor="active-frame-ms" className="text-[var(--ui-text-muted)] whitespace-nowrap">
                Frame Timing
              </label>
              <input
                id="active-frame-ms"
                type="number"
                min={30}
                max={5000}
                step={10}
                value={activeFrame.durationMs}
                onChange={(e) =>
                  onUpdateFrame(activeFrameIndex, {
                    durationMs: Math.max(30, Number(e.target.value) || 100),
                  })
                }
                className="w-20 px-2 py-1 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-xs text-[var(--ui-text-primary)] tabular-nums"
              />
              <span className="font-mono text-[11px] text-[var(--ui-text-muted)]">ms</span>
            </div>
          )}

          {/* Onion Skinning Toggle + Popover */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onUpdateOnionSkin({ enabled: !onionSkin.enabled })}
              aria-pressed={onionSkin.enabled}
              style={
                onionSkin.enabled
                  ? {
                      backgroundColor: 'var(--ui-accent-secondary-soft)',
                      borderColor: 'var(--ui-accent-secondary)',
                      color: 'var(--ui-text-primary)',
                    }
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap shrink-0 cursor-pointer ${
                onionSkin.enabled
                  ? ''
                  : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Onion Skin</span>
              <span className="sm:hidden">Onion</span>
            </button>
            <button
              type="button"
              onClick={() => setShowOnionPopover((v) => !v)}
              aria-label="Onion skin settings"
              className="px-2 py-1.5 rounded-md bg-[var(--ui-bg-app)] border border-[var(--ui-border)] text-xs text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Config
            </button>
          </div>

          {showOnionPopover && (
            <div className="absolute right-0 bottom-11 z-30 w-64 p-3.5 rounded-xl bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--ui-text-primary)]">Onion Skinning</span>
                <button
                  type="button"
                  onClick={() => setShowOnionPopover(false)}
                  className="text-xs text-[var(--ui-accent)] hover:underline cursor-pointer"
                >
                  Done
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[var(--ui-text-muted)] mb-1">Prev Frames</label>
                  <select
                    value={onionSkin.prevFrames}
                    onChange={(e) => onUpdateOnionSkin({ prevFrames: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)]"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--ui-text-muted)] mb-1">Next Frames</label>
                  <select
                    value={onionSkin.nextFrames}
                    onChange={(e) => onUpdateOnionSkin({ nextFrames: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)]"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--ui-text-muted)]">Ghost Opacity</span>
                  <span className="font-mono text-[var(--ui-accent)] tabular-nums">{onionSkin.opacity}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={onionSkin.opacity}
                  onChange={(e) => onUpdateOnionSkin({ opacity: Number(e.target.value) })}
                  className="w-full studio-slider"
                />
              </div>
              <label className="flex items-center justify-between text-xs text-[var(--ui-text-secondary)] cursor-pointer">
                <span>Tint Prev (Red) / Next (Blue)</span>
                <input
                  type="checkbox"
                  checked={onionSkin.tintEnabled}
                  onChange={(e) => onUpdateOnionSkin({ tintEnabled: e.target.checked })}
                  className="accent-[var(--ui-accent)]"
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={onAddFrame}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] border border-[var(--ui-border-strong)] text-xs font-medium text-[var(--ui-text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Frame</span>
            <span className="sm:hidden">Frame</span>
          </button>
        </div>
      </div>

      {/* Horizontal Frame Strip */}
      <div className="flex-1 overflow-x-auto px-4 py-2.5 flex items-center gap-2.5">
        {frames.map((frame, idx) => {
          const active = idx === activeFrameIndex;
          return (
            <div key={frame.id} className="flex items-center gap-2 shrink-0">
              <div
                className={`w-36 rounded-lg border p-2 flex flex-col gap-1.5 transition-colors ${
                  active
                    ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)]'
                    : 'bg-[var(--ui-bg-panel)] border-[var(--ui-border)] hover:border-[var(--ui-border-hover)]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-[var(--ui-text-secondary)]">#{idx + 1}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveFrame(idx, -1)}
                      aria-label={`Move frame ${idx + 1} left`}
                      className="p-0.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === frames.length - 1}
                      onClick={() => onMoveFrame(idx, 1)}
                      aria-label={`Move frame ${idx + 1} right`}
                      className="p-0.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateFrame(idx)}
                      aria-label={`Duplicate frame ${idx + 1}`}
                      className="p-0.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={frames.length <= 1}
                      onClick={() => onDeleteFrame(idx)}
                      aria-label={`Delete frame ${idx + 1}`}
                      className="p-0.5 text-[var(--ui-text-muted)] hover:text-red-500 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectFrame(idx)}
                  aria-label={`Select Frame ${idx + 1}`}
                  className="w-full h-16 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border)] flex items-center justify-center overflow-hidden cursor-pointer"
                >
                  <FrameThumbnail
                    frame={frame}
                    width={width}
                    height={height}
                    className="max-w-full max-h-full object-contain"
                  />
                </button>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={30}
                    max={5000}
                    step={10}
                    aria-label={`Frame ${idx + 1} duration ms`}
                    value={frame.durationMs}
                    onChange={(e) =>
                      onUpdateFrame(idx, {
                        durationMs: Math.max(30, Number(e.target.value) || 100),
                      })
                    }
                    className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-[10px] text-[var(--ui-text-primary)] tabular-nums"
                  />
                  <span className="text-[10px] font-mono text-[var(--ui-text-muted)] shrink-0">ms</span>
                </div>
              </div>

              {/* Transition Selector Between Consecutive Frames */}
              {frames.length > 1 && (
                <div className="flex flex-col items-center gap-1 px-1">
                  <span className="text-[9px] text-[var(--ui-text-muted)]">Transition</span>
                  <select
                    aria-label={`Transition after frame ${idx + 1}`}
                    value={frame.transition}
                    onChange={(e) =>
                      onUpdateFrame(idx, { transition: e.target.value as TransitionType })
                    }
                    className="px-1.5 py-1 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-[10px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
                  >
                    {TRANSITION_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {frame.transition !== 'cut' && (
                    <input
                      type="number"
                      min={20}
                      max={1000}
                      step={20}
                      aria-label={`Transition ${idx + 1} duration ms`}
                      value={frame.transitionMs}
                      onChange={(e) =>
                        onUpdateFrame(idx, {
                          transitionMs: Math.max(20, Number(e.target.value) || 80),
                        })
                      }
                      className="w-14 px-1 py-0.5 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-[10px] text-[var(--ui-text-muted)] text-center tabular-nums"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
