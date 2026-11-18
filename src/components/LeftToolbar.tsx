import {
  Circle,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Hexagon,
  Minus,
  Move,
  PaintBucket,
  Pencil,
  Pipette,
  Sparkles,
  Square,
} from 'lucide-react';
import type { SymmetryMode, ToolType } from '../engine/types';

interface LeftToolbarProps {
  activeTool: ToolType;
  symmetry: SymmetryMode;
  shapeFilled: boolean;
  polygonSides: number;
  onSelectTool: (tool: ToolType) => void;
  onSelectSymmetry: (mode: SymmetryMode) => void;
  onToggleShapeFilled: () => void;
  onChangePolygonSides: (sides: number) => void;
}

const TOOLS: Array<{
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'pen', label: 'Pen Brush', shortcut: 'B', icon: Pencil },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { id: 'bucket', label: 'Fill Bucket', shortcut: 'G', icon: PaintBucket },
  { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I', icon: Pipette },
  { id: 'line', label: 'Line Tool', shortcut: 'L', icon: Minus },
  { id: 'rect', label: 'Rectangle Shape', shortcut: 'R', icon: Square },
  { id: 'ellipse', label: 'Ellipse Shape', shortcut: 'O', icon: Circle },
  { id: 'polygon', label: 'Polygon Shape', shortcut: 'P', icon: Hexagon },
  { id: 'move', label: 'Move Layer', shortcut: 'M', icon: Move },
  { id: 'pan', label: 'Pan Viewport', shortcut: 'H', icon: Hand },
];

const SYMMETRY_OPTIONS: Array<{ id: SymmetryMode; label: string; short: string }> = [
  { id: 'none', label: 'Off', short: 'Off' },
  { id: 'vertical', label: 'Vertical Mirror', short: 'V' },
  { id: 'horizontal', label: 'Horizontal Mirror', short: 'H' },
  { id: 'quad', label: '4-Way Mirror', short: 'Quad' },
  { id: 'radial4', label: 'Radial 4×', short: 'R4' },
  { id: 'radial8', label: 'Radial 8×', short: 'R8' },
];

export function LeftToolbar({
  activeTool,
  symmetry,
  shapeFilled,
  polygonSides,
  onSelectTool,
  onSelectSymmetry,
  onToggleShapeFilled,
  onChangePolygonSides,
}: LeftToolbarProps) {
  const isShapeTool = activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'polygon';

  return (
    <aside
      className="w-12 md:w-16 bg-[var(--ui-bg-bar)] border-r border-[var(--ui-border)] flex flex-col items-center py-3 gap-1.5 select-none shrink-0 overflow-y-auto transition-colors duration-200"
      aria-label="Drawing tools"
    >
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            aria-label={`${tool.label} (${tool.shortcut})`}
            aria-pressed={active}
            title={`${tool.label} (${tool.shortcut})`}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              active
                ? 'bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)] shadow-sm'
                : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)]'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}

      {/* Shape options when a shape tool is active */}
      {isShapeTool && (
        <div className="w-12 my-1 pt-2 border-t border-[var(--ui-border)] flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleShapeFilled}
            title={shapeFilled ? 'Shape mode: Filled' : 'Shape mode: Outline'}
            aria-label={shapeFilled ? 'Switch to outline shape' : 'Switch to filled shape'}
            className={`w-10 py-1 rounded text-[10px] font-medium border cursor-pointer ${
              shapeFilled
                ? 'bg-[var(--ui-bg-active)] border-[var(--ui-accent)] text-[var(--ui-accent)]'
                : 'bg-[var(--ui-bg-app)] border-[var(--ui-border-strong)] text-[var(--ui-text-muted)]'
            }`}
          >
            {shapeFilled ? 'Fill' : 'Line'}
          </button>
          {activeTool === 'polygon' && (
            <button
              type="button"
              onClick={() => onChangePolygonSides(polygonSides >= 8 ? 3 : polygonSides + 1)}
              title="Cycle polygon sides (3–8)"
              aria-label={`Polygon sides: ${polygonSides}`}
              className="w-10 py-1 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] text-[10px] font-mono text-[var(--ui-text-primary)] cursor-pointer"
            >
              {polygonSides}s
            </button>
          )}
        </div>
      )}

      {/* Symmetry Section */}
      <div className="w-12 mt-2 pt-2.5 border-t border-[var(--ui-border)] flex flex-col items-center gap-1">
        <span className="text-[10px] text-[var(--ui-text-muted)] font-medium mb-0.5">Sym</span>
        {SYMMETRY_OPTIONS.map((opt) => {
          const active = symmetry === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectSymmetry(opt.id)}
              aria-label={`Symmetry: ${opt.label}`}
              aria-pressed={active}
              title={`Symmetry: ${opt.label}`}
              className={`w-10 h-7 rounded text-[10px] font-mono transition-colors flex items-center justify-center gap-0.5 cursor-pointer ${
                active
                  ? 'border border-[var(--ui-accent-secondary)] text-[var(--ui-accent-secondary)] font-semibold'
                  : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text-primary)] hover:bg-[var(--ui-bg-hover)]'
              }`}
              style={
                active ? { backgroundColor: 'var(--ui-accent-secondary-soft)' } : undefined
              }
            >
              {opt.id === 'vertical' && <FlipHorizontal2 className="w-3 h-3" />}
              {opt.id === 'horizontal' && <FlipVertical2 className="w-3 h-3" />}
              {opt.id === 'radial8' && <Sparkles className="w-2.5 h-2.5" />}
              <span>{opt.short}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
