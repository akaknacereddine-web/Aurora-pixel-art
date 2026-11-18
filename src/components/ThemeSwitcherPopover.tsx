import { Check, Palette, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  resolveWebsiteThemeTokens,
  WEBSITE_THEMES,
  type CustomThemeOverrides,
  type WebsiteThemeConfig,
  type WebsiteThemePresetId,
} from '../engine/themes';

interface ThemeSwitcherPopoverProps {
  themeConfig: WebsiteThemeConfig;
  onChangeTheme: (next: WebsiteThemeConfig) => void;
  compact?: boolean;
}

export function ThemeSwitcherPopover({
  themeConfig,
  onChangeTheme,
  compact = false,
}: ThemeSwitcherPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(themeConfig.isCustom);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePreset =
    WEBSITE_THEMES.find((t) => t.id === themeConfig.presetId) || WEBSITE_THEMES[0];
  const resolvedTokens = resolveWebsiteThemeTokens(themeConfig);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelectPreset = (presetId: WebsiteThemePresetId) => {
    onChangeTheme({
      presetId,
      isCustom: false,
      customColors: {},
    });
  };

  const handleCustomColorChange = (key: keyof CustomThemeOverrides, hex: string) => {
    const clean = hex.toUpperCase();
    onChangeTheme({
      ...themeConfig,
      isCustom: true,
      customColors: {
        ...themeConfig.customColors,
        [key]: clean,
      },
    });
  };

  const handleResetToPreset = () => {
    onChangeTheme({
      presetId: themeConfig.presetId,
      isCustom: false,
      customColors: {},
    });
    setShowCustom(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Website color theme"
        title="Customize website color theme"
        className={`inline-flex items-center gap-2 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-bg-card)] hover:bg-[var(--ui-bg-hover-strong)] text-xs font-medium text-[var(--ui-text-primary)] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
        }`}
      >
        <span className="inline-flex items-center -space-x-1 shrink-0" aria-hidden="true">
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: resolvedTokens.bgApp }}
          />
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: resolvedTokens.bgPanel }}
          />
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: resolvedTokens.accent }}
          />
        </span>
        <span className={compact ? 'hidden lg:inline' : 'hidden sm:inline'}>
          {themeConfig.isCustom ? 'Custom Theme' : activePreset.name.split(' ')[0]}
        </span>
        <Palette className="w-3.5 h-3.5 text-[var(--ui-accent)] sm:hidden" />
      </button>

      {open && (
        <div
          className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-[var(--ui-border-strong)] bg-[var(--ui-bg-panel)] text-[var(--ui-text-primary)] shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="Website color theme picker"
        >
          <div className="px-4 py-3 border-b border-[var(--ui-border)] flex items-center justify-between bg-[var(--ui-bg-bar)]">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--ui-accent)]" />
              <span className="text-xs font-semibold">Website Color Theme</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close theme picker"
              className="p-1 rounded text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 space-y-3.5 max-h-[75vh] overflow-y-auto">
            {/* Curated Preset Grid */}
            <div className="grid grid-cols-2 gap-2">
              {WEBSITE_THEMES.map((preset) => {
                const isSelected = themeConfig.presetId === preset.id && !themeConfig.isCustom;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    aria-pressed={isSelected}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)]'
                        : 'bg-[var(--ui-bg-app)] border-[var(--ui-border-strong)] hover:border-[var(--ui-border-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-black/20"
                          style={{ backgroundColor: preset.tokens.bgApp }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-black/20"
                          style={{ backgroundColor: preset.tokens.bgPanel }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-black/20"
                          style={{ backgroundColor: preset.tokens.accent }}
                        />
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--ui-accent)] shrink-0" />}
                    </div>
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-[var(--ui-text-muted)] truncate mt-0.5">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Pickers Toggle & Panel */}
            <div className="pt-2 border-t border-[var(--ui-border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCustom((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ui-accent)] hover:underline cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {showCustom ? 'Hide Custom Colors' : 'Customize Colors'}
                </button>

                {themeConfig.isCustom && (
                  <button
                    type="button"
                    onClick={handleResetToPreset}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Preset
                  </button>
                )}
              </div>

              {showCustom && (
                <div className="grid grid-cols-2 gap-2.5 p-2.5 rounded-lg bg-[var(--ui-bg-app)] border border-[var(--ui-border)]">
                  {(
                    [
                      { key: 'bgApp', label: 'Background', value: resolvedTokens.bgApp },
                      { key: 'bgPanel', label: 'Sidebars & Panels', value: resolvedTokens.bgPanel },
                      { key: 'accent', label: 'Primary Accent', value: resolvedTokens.accent },
                      { key: 'textPrimary', label: 'Text Ink', value: resolvedTokens.textPrimary },
                    ] as const
                  ).map((item) => (
                    <label key={item.key} className="space-y-1 block">
                      <span className="block text-[10px] text-[var(--ui-text-muted)]">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          aria-label={`Custom ${item.label} color`}
                          value={item.value}
                          onChange={(e) => handleCustomColorChange(item.key, e.target.value)}
                          className="w-7 h-7 rounded border border-[var(--ui-border-strong)] bg-transparent cursor-pointer shrink-0"
                        />
                        <HexField
                          label={`Custom ${item.label} hex`}
                          value={item.value}
                          onCommit={(hex) => handleCustomColorChange(item.key, hex)}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HexField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      aria-label={label}
      value={draft}
      onChange={(e) => {
        const next = e.target.value.toUpperCase();
        if (/^#[0-9A-F]{0,6}$/.test(next)) {
          setDraft(next);
          if (/^#[0-9A-F]{6}$/.test(next)) {
            onCommit(next);
          }
        }
      }}
      onBlur={() => {
        if (!/^#[0-9A-F]{6}$/.test(draft)) {
          setDraft(value);
        }
      }}
      className="w-full min-w-0 px-1.5 py-1 rounded bg-[var(--ui-bg-panel)] border border-[var(--ui-border-strong)] font-mono text-[10px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--ui-accent)]"
    />
  );
}
