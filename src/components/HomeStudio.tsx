import type { User } from 'firebase/auth';
import { Cloud, Copy, Film, Grid3X3, Palette, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CANVAS_SIZE_PRESETS, DEFAULT_PALETTES } from '../engine/presets';
import type { WebsiteThemeConfig } from '../engine/themes';
import type { PalettePreset, Project, ProjectType } from '../engine/types';
import { FrameThumbnail } from './FrameThumbnail';
import { ThemeSwitcherPopover } from './ThemeSwitcherPopover';

const LOGO_SRC = '/assets/aistudio/Sans_titre_71_20261117215034_184958f0.png';

interface HomeStudioProps {
  projects: Project[];
  customPalettes: PalettePreset[];
  themeConfig: WebsiteThemeConfig;
  onChangeTheme: (next: WebsiteThemeConfig) => void;
  firebaseUser: User | null;
  vaultCode: string;
  onCreateProject: (
    name: string,
    type: ProjectType,
    width: number,
    height: number,
    initialPalette?: string[]
  ) => void;
  onOpenProject: (projectId: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenCloudModal: () => void;
  onImportProjectFile: (file: File) => void;
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HomeStudio({
  projects,
  customPalettes,
  themeConfig,
  onChangeTheme,
  firebaseUser,
  vaultCode,
  onCreateProject,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onOpenCloudModal,
  onImportProjectFile,
}: HomeStudioProps) {
  const [filter, setFilter] = useState<'all' | 'canvas' | 'video'>('all');
  const [selectedType, setSelectedType] = useState<ProjectType>('canvas');
  const [projectName, setProjectName] = useState('');
  const [widthPx, setWidthPx] = useState(32);
  const [heightPx, setHeightPx] = useState(32);
  const [selectedPaletteId, setSelectedPaletteId] = useState(DEFAULT_PALETTES[0].id);
  const [sizeError, setSizeError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allPalettes = useMemo(
    () => [...customPalettes, ...DEFAULT_PALETTES],
    [customPalettes]
  );
  const activePalettePreset =
    allPalettes.find((p) => p.id === selectedPaletteId) || DEFAULT_PALETTES[0];

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;
    return p.type === filter;
  });

  const handlePresetClick = (w: number, h: number) => {
    setWidthPx(w);
    setHeightPx(h);
    setSizeError('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Math.round(widthPx);
    const h = Math.round(heightPx);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 4 || h < 4 || w > 256 || h > 256) {
      setSizeError('Canvas dimensions must be between 4 and 256 pixels.');
      return;
    }
    setSizeError('');
    const defaultName = selectedType === 'video' ? 'New Animation' : 'New Character Sprite';
    onCreateProject(
      projectName.trim() || defaultName,
      selectedType,
      w,
      h,
      activePalettePreset.colors
    );
  };

  const cloudButtonLabel = firebaseUser
    ? firebaseUser.displayName?.split(' ')[0] || 'Synced'
    : vaultCode
    ? `Vault: ${vaultCode}`
    : 'Cloud Sync';

  return (
    <div className="min-h-screen bg-[var(--ui-bg-app)] text-[var(--ui-text-primary)] flex flex-col transition-colors duration-200">
      {/* Top Bar Contract: 3 zones */}
      <header className="border-b border-[var(--ui-border)] bg-[var(--ui-bg-bar)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-6">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 text-base sm:text-lg font-semibold tracking-tight text-[var(--ui-text-primary)] whitespace-nowrap shrink-0"
          >
            <img
              src={LOGO_SRC}
              alt="Aurora Pixel Art logo"
              className="w-8 h-8 rounded-lg object-cover border border-[var(--ui-border-strong)] shrink-0"
              referrerPolicy="no-referrer"
            />
            <span>Aurora Pixel Art</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--ui-text-muted)]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'text-[var(--ui-accent)] font-medium'
                  : 'hover:text-[var(--ui-text-primary)]'
              }`}
            >
              All Works
            </button>
            <button
              type="button"
              onClick={() => setFilter('canvas')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filter === 'canvas'
                  ? 'text-[var(--ui-accent)] font-medium'
                  : 'hover:text-[var(--ui-text-primary)]'
              }`}
            >
              Pixel Canvases
            </button>
            <button
              type="button"
              onClick={() => setFilter('video')}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filter === 'video'
                  ? 'text-[var(--ui-accent)] font-medium'
                  : 'hover:text-[var(--ui-text-primary)]'
              }`}
            >
              Animation Videos
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:text-[var(--ui-text-primary)] transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.pixelforge.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportProjectFile(file);
                e.target.value = '';
              }}
            />
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitcherPopover themeConfig={themeConfig} onChangeTheme={onChangeTheme} />

            <button
              type="button"
              onClick={onOpenCloudModal}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                firebaseUser || vaultCode
                  ? 'bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[var(--ui-accent)] border border-[var(--ui-accent)]/50'
                  : 'bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-[var(--ui-accent-contrast)]'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              {cloudButtonLabel}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-12">
        {/* New Project Studio Builder */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-4">
              <img
                src={LOGO_SRC}
                alt="Aurora Pixel Art emblem"
                className="w-16 h-16 rounded-2xl object-cover border border-[var(--ui-border-strong)] shadow-lg shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ui-text-primary)] leading-tight [text-wrap:balance]">
                  Aurora Pixel Art
                </h1>
                <p className="text-xs font-medium text-[var(--ui-accent)] mt-1">
                  The all-in-one tool for pixel creators
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--ui-text-secondary)] leading-relaxed">
              Choose between a layered Pixel Art Canvas for character illustration or an Animation
              Video timeline with onion skinning, custom frame timing, effects, transitions, and
              high-resolution PNG export.
            </p>

            {/* Mode Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedType('canvas')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedType === 'canvas'
                    ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                    : 'bg-[var(--ui-bg-panel)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:border-[var(--ui-border-hover)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Grid3X3
                    className={`w-5 h-5 ${
                      selectedType === 'canvas'
                        ? 'text-[var(--ui-accent)]'
                        : 'text-[var(--ui-text-muted)]'
                    }`}
                  />
                  <span className="text-[11px] font-mono text-[var(--ui-text-muted)]">
                    Static / Layered
                  </span>
                </div>
                <div className="text-sm font-semibold text-[var(--ui-text-primary)]">
                  Pixel Art Canvas
                </div>
                <div className="text-xs text-[var(--ui-text-muted)] mt-1">
                  Draw characters, icons, and tiles with symmetry, custom brushes, and blend modes.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType('video')}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedType === 'video'
                    ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent-secondary)] text-[var(--ui-text-primary)]'
                    : 'bg-[var(--ui-bg-panel)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:border-[var(--ui-border-hover)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Film
                    className={`w-5 h-5 ${
                      selectedType === 'video'
                        ? 'text-[var(--ui-accent-secondary)]'
                        : 'text-[var(--ui-text-muted)]'
                    }`}
                  />
                  <span className="text-[11px] font-mono text-[var(--ui-text-muted)]">
                    Frame Timeline
                  </span>
                </div>
                <div className="text-sm font-semibold text-[var(--ui-text-primary)]">
                  Animation Video
                </div>
                <div className="text-xs text-[var(--ui-text-muted)] mt-1">
                  Draw frames with onion skinning, custom timing per frame, effects, and transitions.
                </div>
              </button>
            </div>
          </div>

          {/* Canvas Size & Creation Form */}
          <form
            onSubmit={handleCreateSubmit}
            className="lg:col-span-7 bg-[var(--ui-bg-panel)] border border-[var(--ui-border)] rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-4 gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--ui-text-primary)]">
                  {selectedType === 'video' ? 'New Animation Video' : 'New Pixel Art Canvas'}
                </h2>
                <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
                  Configure project title and pixel grid resolution before launching the studio.
                </p>
              </div>
              <span className="font-mono text-xs text-[var(--ui-accent)] tabular-nums whitespace-nowrap shrink-0">
                {widthPx} × {heightPx} px
              </span>
            </div>

            <div>
              <label
                htmlFor="project-title"
                className="block text-xs font-medium text-[var(--ui-text-secondary)] mb-1.5"
              >
                Project Title
              </label>
              <input
                id="project-title"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={selectedType === 'video' ? 'e.g. Idle Knight Cycle' : 'e.g. Forest Ranger Sprite'}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-sm text-[var(--ui-text-primary)] placeholder-[var(--ui-text-faint)] focus:outline-none focus:border-[var(--ui-accent)]"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--ui-text-secondary)]">
                  Canvas Size in Pixels
                </span>
                <span className="text-[11px] text-[var(--ui-text-muted)]">Range: 4 – 256 px</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {CANVAS_SIZE_PRESETS.map((preset) => {
                  const active = widthPx === preset.width && heightPx === preset.height;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetClick(preset.width, preset.height)}
                      className={`px-2.5 py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-text-primary)]'
                          : 'bg-[var(--ui-bg-app)] border-[var(--ui-border)] text-[var(--ui-text-secondary)] hover:border-[var(--ui-border-hover)]'
                      }`}
                    >
                      <div className="font-mono text-xs font-medium tabular-nums">{preset.label}</div>
                      <div className="text-[10px] text-[var(--ui-text-muted)] mt-0.5 truncate">
                        {preset.tag}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label
                    htmlFor="canvas-width"
                    className="block text-[11px] text-[var(--ui-text-muted)] mb-1"
                  >
                    Custom Width (px)
                  </label>
                  <input
                    id="canvas-width"
                    type="number"
                    min={4}
                    max={256}
                    value={widthPx}
                    onChange={(e) => {
                      setWidthPx(Number(e.target.value));
                      setSizeError('');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-sm text-[var(--ui-text-primary)] tabular-nums focus:outline-none focus:border-[var(--ui-accent)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="canvas-height"
                    className="block text-[11px] text-[var(--ui-text-muted)] mb-1"
                  >
                    Custom Height (px)
                  </label>
                  <input
                    id="canvas-height"
                    type="number"
                    min={4}
                    max={256}
                    value={heightPx}
                    onChange={(e) => {
                      setHeightPx(Number(e.target.value));
                      setSizeError('');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-sm text-[var(--ui-text-primary)] tabular-nums focus:outline-none focus:border-[var(--ui-accent)]"
                  />
                </div>
              </div>
              {sizeError && <p className="text-xs text-red-500">{sizeError}</p>}
            </div>

            {/* Starting Drawing Color Palette Chooser */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="home-palette-select"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ui-text-secondary)]"
                >
                  <Palette className="w-3.5 h-3.5 text-[var(--ui-accent)]" />
                  Artwork Swatch Palette
                </label>
                <span className="font-mono text-[11px] text-[var(--ui-text-muted)] tabular-nums">
                  {activePalettePreset.colors.length} swatches
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <select
                  id="home-palette-select"
                  aria-label="Choose starting color palette"
                  value={activePalettePreset.id}
                  onChange={(e) => setSelectedPaletteId(e.target.value)}
                  className="sm:col-span-5 px-3 py-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-xs text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
                >
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

                <div
                  className="sm:col-span-7 flex flex-wrap items-center gap-1 p-2 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border)]"
                  aria-label={`${activePalettePreset.name} preview swatches`}
                >
                  {activePalettePreset.colors.slice(0, 24).map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      title={hex}
                      className="w-4 h-4 rounded-sm border border-black/20 shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  {activePalettePreset.colors.length > 24 && (
                    <span className="text-[10px] font-mono text-[var(--ui-text-muted)] pl-1">
                      +{activePalettePreset.colors.length - 24}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between gap-4">
              <div className="text-xs text-[var(--ui-text-muted)]">
                Auto-saves every 3 seconds · Undo history enabled
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-hover)] text-[var(--ui-accent-contrast)] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {selectedType === 'video' ? 'Create Animation Video' : 'Create Pixel Canvas'}
              </button>
            </div>
          </form>
        </section>

        {/* Saved & Synced Artworks */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ui-border)] pb-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-semibold text-[var(--ui-text-primary)]">
                Studio Library
              </h2>
              <span className="text-xs font-mono text-[var(--ui-text-muted)] tabular-nums">
                {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[var(--ui-bg-panel)] border border-[var(--ui-border)] rounded-lg md:hidden">
              {(['all', 'canvas', 'video'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                    filter === tab
                      ? 'bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)] font-semibold'
                      : 'text-[var(--ui-text-muted)]'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'canvas' ? 'Canvas' : 'Video'}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="py-14 text-center bg-[var(--ui-bg-panel)] border border-[var(--ui-border)] rounded-xl">
              <p className="text-sm text-[var(--ui-text-secondary)]">
                No artworks match this filter yet.
              </p>
              <p className="text-xs text-[var(--ui-text-muted)] mt-1">
                Create a new Pixel Art Canvas or Animation Video above, or sync from Cloud Sync.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProjects.map((proj) => {
                const frame0 = proj.frames[0];
                const layerCount = frame0?.layers.length ?? 1;
                return (
                  <div
                    key={proj.id}
                    className="group bg-[var(--ui-bg-panel)] border border-[var(--ui-border)] hover:border-[var(--ui-accent)]/70 rounded-xl overflow-hidden flex flex-col transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj.id)}
                      className="relative aspect-[4/3] w-full bg-[var(--ui-bg-canvas-stage)] flex items-center justify-center p-4 overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--ui-accent)]"
                      aria-label={`Open ${proj.name}`}
                    >
                      <FrameThumbnail
                        frame={frame0}
                        width={proj.width}
                        height={proj.height}
                        className="w-full h-full max-w-[160px] max-h-[160px] object-contain rounded border border-[var(--ui-border-strong)]"
                      />
                    </button>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3 border-t border-[var(--ui-border)]">
                      <div>
                        <button
                          type="button"
                          onClick={() => onOpenProject(proj.id)}
                          className="text-sm font-semibold text-[var(--ui-text-primary)] hover:text-[var(--ui-accent)] text-left truncate w-full cursor-pointer"
                        >
                          {proj.name}
                        </button>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ui-text-muted)] font-mono tabular-nums">
                          <span>{proj.type === 'video' ? 'Video' : 'Canvas'}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {proj.width}×{proj.height}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {proj.type === 'video'
                              ? `${proj.frames.length} frames`
                              : `${layerCount} ${layerCount === 1 ? 'layer' : 'layers'}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--ui-border)]">
                        <span className="text-[11px] text-[var(--ui-text-muted)]">
                          {formatRelativeTime(proj.updatedAt)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onDuplicateProject(proj.id)}
                            className="p-1.5 rounded-md text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] transition-colors cursor-pointer"
                            aria-label={`Duplicate ${proj.name}`}
                            title="Duplicate project"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(proj.id)}
                            className="p-1.5 rounded-md text-[var(--ui-text-muted)] hover:text-red-400 hover:bg-[var(--ui-bg-hover)] transition-colors cursor-pointer"
                            aria-label={`Delete ${proj.name}`}
                            title="Delete project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
