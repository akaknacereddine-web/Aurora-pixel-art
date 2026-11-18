import { Download, Film, Grid, Image as ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '../engine/types';
import {
  exportAnimationWebm,
  exportHighResPng,
  exportSpriteSheetPng,
} from '../services/exporter';
import { FrameThumbnail } from './FrameThumbnail';

interface ExportModalProps {
  isOpen: boolean;
  project: Project;
  activeFrameIndex: number;
  onClose: () => void;
}

const SCALE_OPTIONS = [1, 2, 4, 8, 16, 32];

export function ExportModal({ isOpen, project, activeFrameIndex, onClose }: ExportModalProps) {
  const [scale, setScale] = useState(16);
  const [bgMode, setBgMode] = useState<'transparent' | 'solid'>('transparent');
  const [bgColor, setBgColor] = useState('#081023');
  const [exportFormat, setExportFormat] = useState<'png' | 'spritesheet' | 'webm'>('png');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const outWidth = project.width * scale;
  const outHeight = project.height * scale;
  const effectiveBg = bgMode === 'transparent' ? 'transparent' : bgColor;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'png') {
        exportHighResPng(project, activeFrameIndex, scale, effectiveBg);
      } else if (exportFormat === 'spritesheet') {
        exportSpriteSheetPng(project, scale, 0, effectiveBg);
      } else if (exportFormat === 'webm') {
        await exportAnimationWebm(project, scale, effectiveBg);
      }
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-xl bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] rounded-xl overflow-hidden shadow-2xl text-[var(--ui-text-primary)]">
        <div className="px-5 py-4 border-b border-[var(--ui-border)] flex items-center justify-between bg-[var(--ui-bg-bar)]">
          <h2 id="export-modal-title" className="text-sm font-semibold text-[var(--ui-text-primary)]">
            Export High-Resolution Artwork
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Preview Column */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-[var(--ui-bg-app)] border border-[var(--ui-border)] rounded-lg p-4 gap-3">
            <div
              className="w-36 h-36 rounded border border-[var(--ui-border-strong)] flex items-center justify-center overflow-hidden"
              style={bgMode === 'solid' ? { backgroundColor: bgColor } : undefined}
            >
              <FrameThumbnail
                frame={project.frames[activeFrameIndex] || project.frames[0]}
                width={project.width}
                height={project.height}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-center">
              <div className="font-mono text-xs text-[var(--ui-text-primary)] tabular-nums">
                {outWidth} × {outHeight} px
              </div>
              <div className="text-[11px] text-[var(--ui-text-muted)] mt-0.5 whitespace-nowrap">
                Crisp nearest-neighbor ({scale}×)
              </div>
            </div>
          </div>

          {/* Options Column */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <span className="block text-xs font-medium text-[var(--ui-text-secondary)] mb-1.5">
                Format
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat('png')}
                  className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 cursor-pointer ${
                    exportFormat === 'png'
                      ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                      : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)]'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>PNG Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('spritesheet')}
                  className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 cursor-pointer ${
                    exportFormat === 'spritesheet'
                      ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                      : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)]'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  <span>Sprite Sheet</span>
                </button>
                <button
                  type="button"
                  disabled={project.frames.length < 2}
                  onClick={() => setExportFormat('webm')}
                  className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1 cursor-pointer disabled:opacity-40 ${
                    exportFormat === 'webm'
                      ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                      : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)]'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>WebM Video</span>
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--ui-text-secondary)] mb-1.5">
                Resolution Scale Multiplier
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setScale(opt)}
                    className={`py-1.5 rounded-md border font-mono text-xs cursor-pointer ${
                      scale === opt
                        ? 'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-[var(--ui-accent-contrast)] font-semibold'
                        : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:border-[var(--ui-border-hover)]'
                    }`}
                  >
                    {opt}×
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--ui-text-secondary)] mb-1.5">
                Background
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBgMode('transparent')}
                  className={`flex-1 py-1.5 px-3 rounded-md border text-xs cursor-pointer ${
                    bgMode === 'transparent'
                      ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                      : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)]'
                  }`}
                >
                  Transparent
                </button>
                <button
                  type="button"
                  onClick={() => setBgMode('solid')}
                  className={`flex-1 py-1.5 px-3 rounded-md border text-xs cursor-pointer ${
                    bgMode === 'solid'
                      ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                      : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-muted)]'
                  }`}
                >
                  Solid Color
                </button>
                {bgMode === 'solid' && (
                  <input
                    type="color"
                    aria-label="Export background color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-9 h-8 rounded bg-transparent border border-[var(--ui-border-strong)] cursor-pointer"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--ui-border)] flex items-center justify-end gap-3 bg-[var(--ui-bg-bar)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-[var(--ui-text-secondary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--ui-accent-contrast)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting
              ? 'Rendering...'
              : `Download ${exportFormat.toUpperCase()} (${outWidth}×${outHeight})`}
          </button>
        </div>
      </div>
    </div>
  );
}
