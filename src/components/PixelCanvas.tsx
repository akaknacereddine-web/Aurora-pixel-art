import { Crosshair, Lock, Unlock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyFrameEffects,
  applySymmetryPoints,
  bresenhamLine,
  cloneBuffer,
  compositeLayers,
  decodeRLE,
  ellipsePoints,
  encodeRLE,
  floodFill,
  hexToRgba,
  polygonPoints,
  rectPoints,
  rgbaToHex,
  shiftBuffer,
  stampBrush,
} from '../engine/pixelMath';
import type {
  BrushSettings,
  CustomBrush,
  OnionSkinConfig,
  SerializedFrame,
  SymmetryMode,
  SymmetryOrigin,
  ToolType,
} from '../engine/types';

interface PixelCanvasProps {
  width: number;
  height: number;
  frames: SerializedFrame[];
  activeFrameIndex: number;
  activeLayerId: string;
  activeTool: ToolType;
  activeColor: string;
  brushSettings: BrushSettings;
  customBrush?: CustomBrush;
  symmetry: SymmetryMode;
  symmetryOrigin: SymmetryOrigin;
  symmetryLocked: boolean;
  onionSkin: OnionSkinConfig;
  showGrid: boolean;
  zoom: number;
  isPlaying: boolean;
  playbackBuffer: Uint8ClampedArray | null;
  onZoomChange: (nextZoom: number) => void;
  onSymmetryOriginChange: (origin: SymmetryOrigin) => void;
  onToggleSymmetryLock: () => void;
  onResetSymmetryOrigin: () => void;
  onCommitLayerPixels: (newRle: string, label: string) => void;
  onPickColor: (hex: string) => void;
  onCursorMove?: (coords: { x: number; y: number } | null) => void;
}

export function PixelCanvas({
  width,
  height,
  frames,
  activeFrameIndex,
  activeLayerId,
  activeTool,
  activeColor,
  brushSettings,
  customBrush,
  symmetry,
  symmetryOrigin,
  symmetryLocked,
  onionSkin,
  showGrid,
  zoom,
  isPlaying,
  playbackBuffer,
  onZoomChange,
  onSymmetryOriginChange,
  onToggleSymmetryLock,
  onResetSymmetryOrigin,
  onCommitLayerPixels,
  onPickColor,
  onCursorMove,
}: PixelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  // Active stroke working buffer
  const workingBufRef = useRef<Uint8ClampedArray | null>(null);
  const baseBufRef = useRef<Uint8ClampedArray | null>(null);
  const strokeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPixelRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; ox: number; oy: number } | null>(null);
  const symmetryDragRef = useRef<'x' | 'y' | 'xy' | null>(null);
  const isDrawingRef = useRef(false);
  const [previewTick, setPreviewTick] = useState(0);

  const activeFrame = frames[activeFrameIndex] || frames[0];
  const activeLayer = activeFrame?.layers.find((l) => l.id === activeLayerId) || activeFrame?.layers[0];

  // Reset pan when canvas size changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [width, height]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Precompute onion skin buffers for adjacent frames
  const onionLayers = useMemo(() => {
    if (isPlaying || !onionSkin.enabled || frames.length <= 1) return [];
    const results: Array<{ buf: Uint8ClampedArray; tint: string; alpha: number }> = [];

    for (let i = 1; i <= onionSkin.prevFrames; i++) {
      const idx = activeFrameIndex - i;
      if (idx >= 0) {
        const comp = compositeLayers(frames[idx].layers, width, height);
        results.push({
          buf: comp,
          tint: onionSkin.tintEnabled ? onionSkin.prevTint : '',
          alpha: (onionSkin.opacity / 100) / i,
        });
      }
    }
    for (let i = 1; i <= onionSkin.nextFrames; i++) {
      const idx = activeFrameIndex + i;
      if (idx < frames.length) {
        const comp = compositeLayers(frames[idx].layers, width, height);
        results.push({
          buf: comp,
          tint: onionSkin.tintEnabled ? onionSkin.nextTint : '',
          alpha: (onionSkin.opacity / 100) / i,
        });
      }
    }
    return results;
  }, [isPlaying, onionSkin, frames, activeFrameIndex, width, height]);

  // Render composite + onion skin + brush hover onto display canvas
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !activeFrame) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (isPlaying && playbackBuffer) {
      const imgData = new ImageData(new Uint8ClampedArray(playbackBuffer), width, height);
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    // 1. Draw Onion Skin layers behind
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d')!;

    for (const onion of onionLayers) {
      const tinted = new Uint8ClampedArray(onion.buf);
      if (onion.tint) {
        const tc = hexToRgba(onion.tint, 100);
        for (let i = 0; i < tinted.length; i += 4) {
          if (tinted[i + 3] === 0) continue;
          tinted[i] = Math.round(tinted[i] * 0.35 + tc.r * 0.65);
          tinted[i + 1] = Math.round(tinted[i + 1] * 0.35 + tc.g * 0.65);
          tinted[i + 2] = Math.round(tinted[i + 2] * 0.35 + tc.b * 0.65);
        }
      }
      offCtx.putImageData(new ImageData(tinted, width, height), 0, 0);
      ctx.save();
      ctx.globalAlpha = onion.alpha;
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    }

    // 2. Composite current frame (using live working buffer if mid-stroke)
    const layersToRender = activeFrame.layers.map((layer) => {
      if (isDrawingRef.current && workingBufRef.current && layer.id === activeLayer?.id) {
        return {
          ...layer,
          pixelsRle: encodeRLE(workingBufRef.current, width, height),
        };
      }
      return layer;
    });

    let composited = compositeLayers(layersToRender, width, height);
    if (activeFrame.effects && activeFrame.effects.some((e) => e.enabled && e.intensity > 0)) {
      composited = applyFrameEffects(composited, width, height, activeFrame.effects);
    }

    offCtx.putImageData(new ImageData(new Uint8ClampedArray(composited), width, height), 0, 0);
    ctx.drawImage(offscreen, 0, 0);
  }, [
    width,
    height,
    activeFrame,
    activeLayer?.id,
    onionLayers,
    isPlaying,
    playbackBuffer,
    previewTick,
  ]);

  const getPixelCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * height);
    return { x, y };
  };

  const computePressure = (e: React.PointerEvent, x: number, y: number): number => {
    // Real stylus/pen pressure if supported and non-default
    if (e.pointerType === 'pen' && e.pressure > 0) {
      return Math.max(0.1, Math.min(1, e.pressure));
    }
    if (brushSettings.simulateVelocityPressure && lastPixelRef.current) {
      const dt = Math.max(1, performance.now() - lastPixelRef.current.time);
      const dist = Math.hypot(x - lastPixelRef.current.x, y - lastPixelRef.current.y);
      const velocity = dist / dt; // px per ms
      // Faster stroke => lighter pressure, slower => heavier pressure
      return Math.max(0.25, Math.min(1, 1 - velocity * 0.45));
    }
    return 1.0;
  };

  const getFloatPixelCoords = (clientX: number, clientY: number): { fx: number; fy: number } => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { fx: width / 2, fy: height / 2 };
    const rect = canvas.getBoundingClientRect();
    const fx = ((clientX - rect.left) / rect.width) * width;
    const fy = ((clientY - rect.top) / rect.height) * height;
    return { fx, fy };
  };

  const snapAxisCoord = (val: number, max: number): number => {
    const snapped = Math.round(val * 2) / 2;
    return Math.max(0.5, Math.min(max - 0.5, snapped));
  };

  const startSymmetryDrag = (axis: 'x' | 'y' | 'xy', e: React.PointerEvent) => {
    if (isPlaying || symmetryLocked) return;
    e.stopPropagation();
    symmetryDragRef.current = axis;
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const applyBrushPoint = (
    buf: Uint8ClampedArray,
    px: number,
    py: number,
    pressure: number,
    erase: boolean
  ) => {
    const color = hexToRgba(activeColor, 100);
    const symPoints = applySymmetryPoints(px, py, width, height, symmetry, symmetryOrigin);
    for (const [sx, sy] of symPoints) {
      stampBrush(buf, width, height, sx, sy, brushSettings.size, color, brushSettings.opacity, pressure, {
        erase,
        customBrush,
        pressureSize: brushSettings.pressureSize,
        pressureOpacity: brushSettings.pressureOpacity,
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    if (e.button === 1 || activeTool === 'pan' || spacePressed) {
      e.currentTarget.setPointerCapture(e.pointerId);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        ox: panOffset.x,
        oy: panOffset.y,
      };
      return;
    }

    if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;
    const { x, y } = getPixelCoords(e.clientX, e.clientY);
    if (x < 0 || y < 0 || x >= width || y >= height) return;

    if (activeTool === 'eyedropper') {
      const comp = compositeLayers(activeFrame.layers, width, height);
      const idx = (y * width + x) * 4;
      if (comp[idx + 3] > 0) {
        onPickColor(rgbaToHex(comp[idx], comp[idx + 1], comp[idx + 2]));
      }
      return;
    }

    const baseBuf = decodeRLE(activeLayer.pixelsRle, width, height);

    if (activeTool === 'bucket') {
      const filled = floodFill(
        baseBuf,
        width,
        height,
        x,
        y,
        hexToRgba(activeColor, 100),
        brushSettings.opacity
      );
      onCommitLayerPixels(encodeRLE(filled, width, height), 'Fill Bucket');
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    baseBufRef.current = baseBuf;
    workingBufRef.current = cloneBuffer(baseBuf);
    strokeStartRef.current = { x, y };
    lastPixelRef.current = { x, y, time: performance.now() };

    if (activeTool === 'pen' || activeTool === 'eraser') {
      const pressure = computePressure(e, x, y);
      applyBrushPoint(workingBufRef.current, x, y, pressure, activeTool === 'eraser');
      setPreviewTick((t) => t + 1);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (symmetryDragRef.current) {
      const { fx, fy } = getFloatPixelCoords(e.clientX, e.clientY);
      const axis = symmetryDragRef.current;
      onSymmetryOriginChange({
        x: axis === 'x' || axis === 'xy' ? snapAxisCoord(fx, width) : symmetryOrigin.x,
        y: axis === 'y' || axis === 'xy' ? snapAxisCoord(fy, height) : symmetryOrigin.y,
      });
      return;
    }

    if (panStartRef.current) {
      setPanOffset({
        x: panStartRef.current.ox + (e.clientX - panStartRef.current.clientX),
        y: panStartRef.current.oy + (e.clientY - panStartRef.current.clientY),
      });
      return;
    }

    const { x, y } = getPixelCoords(e.clientX, e.clientY);
    const inBounds = x >= 0 && y >= 0 && x < width && y < height;
    const nextHover = inBounds ? { x, y } : null;
    setHoverPixel(nextHover);
    onCursorMove?.(nextHover);

    if (!isDrawingRef.current || !workingBufRef.current || !baseBufRef.current) return;

    if (activeTool === 'pen' || activeTool === 'eraser') {
      const prev = lastPixelRef.current || { x, y, time: performance.now() };
      const linePts = bresenhamLine(prev.x, prev.y, x, y);
      const pressure = computePressure(e, x, y);
      for (const [lx, ly] of linePts) {
        applyBrushPoint(workingBufRef.current, lx, ly, pressure, activeTool === 'eraser');
      }
      lastPixelRef.current = { x, y, time: performance.now() };
      setPreviewTick((t) => t + 1);
      return;
    }

    if (activeTool === 'move' && strokeStartRef.current) {
      const dx = x - strokeStartRef.current.x;
      const dy = y - strokeStartRef.current.y;
      workingBufRef.current = shiftBuffer(baseBufRef.current, width, height, dx, dy);
      setPreviewTick((t) => t + 1);
      return;
    }

    if (
      (activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'polygon') &&
      strokeStartRef.current
    ) {
      const sx = strokeStartRef.current.x;
      const sy = strokeStartRef.current.y;
      const buf = cloneBuffer(baseBufRef.current);
      let pts: Array<[number, number]> = [];
      if (activeTool === 'line') pts = bresenhamLine(sx, sy, x, y);
      else if (activeTool === 'rect') pts = rectPoints(sx, sy, x, y, brushSettings.shapeFilled);
      else if (activeTool === 'ellipse') pts = ellipsePoints(sx, sy, x, y, brushSettings.shapeFilled);
      else if (activeTool === 'polygon') {
        pts = polygonPoints(sx, sy, x, y, brushSettings.polygonSides, brushSettings.shapeFilled);
      }

      const color = hexToRgba(activeColor, 100);
      for (const [px, py] of pts) {
        const symPts = applySymmetryPoints(px, py, width, height, symmetry, symmetryOrigin);
        for (const [mx, my] of symPts) {
          stampBrush(buf, width, height, mx, my, Math.min(brushSettings.size, 3), color, brushSettings.opacity, 1);
        }
      }
      workingBufRef.current = buf;
      setPreviewTick((t) => t + 1);
    }
  };

  const handlePointerUp = () => {
    if (symmetryDragRef.current) {
      symmetryDragRef.current = null;
      return;
    }
    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }
    if (!isDrawingRef.current || !workingBufRef.current) return;
    isDrawingRef.current = false;

    const toolLabelMap: Record<ToolType, string> = {
      pen: 'Brush Stroke',
      eraser: 'Erase Stroke',
      bucket: 'Fill Bucket',
      eyedropper: 'Pick Color',
      line: 'Draw Line',
      rect: 'Draw Rectangle',
      ellipse: 'Draw Ellipse',
      polygon: 'Draw Polygon',
      move: 'Move Layer',
      pan: 'Pan',
    };

    const encoded = encodeRLE(workingBufRef.current, width, height);
    workingBufRef.current = null;
    baseBufRef.current = null;
    strokeStartRef.current = null;
    lastPixelRef.current = null;
    onCommitLayerPixels(encoded, toolLabelMap[activeTool] || 'Edit Pixels');
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 0.85;
      onZoomChange(Math.max(2, Math.min(32, Math.round(zoom * factor * 10) / 10)));
    }
  };

  const displayW = width * zoom;
  const displayH = height * zoom;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        setHoverPixel(null);
        onCursorMove?.(null);
      }}
      onWheel={handleWheel}
      className={`relative flex-1 bg-[var(--ui-bg-canvas-stage)] overflow-hidden flex items-center justify-center select-none touch-none transition-colors duration-200 ${
        spacePressed || activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
    >
      {/* Centered Canvas Stage */}
      <div
        className="relative shadow-2xl border border-[var(--ui-border-strong)]"
        style={{
          width: `${displayW}px`,
          height: `${displayH}px`,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        }}
      >
        <div className="absolute inset-0 checkerboard-bg" />

        <canvas
          ref={displayCanvasRef}
          data-testid="pixel-editor-canvas"
          className="relative w-full h-full pixelated block"
        />

        {/* Pixel Grid Overlay */}
        {showGrid && zoom >= 6 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(128,155,195,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,155,195,0.14) 1px, transparent 1px)',
              backgroundSize: `${zoom}px ${zoom}px`,
            }}
          />
        )}

        {/* Movable Symmetry Guide Overlays & Drag Handles */}
        {symmetry !== 'none' && (() => {
          const showVerticalAxis =
            symmetry === 'vertical' || symmetry === 'quad' || symmetry === 'radial4' || symmetry === 'radial8';
          const showHorizontalAxis =
            symmetry === 'horizontal' || symmetry === 'quad' || symmetry === 'radial4' || symmetry === 'radial8';
          const showCenterHandle =
            symmetry === 'quad' || symmetry === 'radial4' || symmetry === 'radial8';
          const strokeW = Math.max(0.08, 1.2 / zoom);
          const dashPattern = `${Math.max(0.25, 3 / zoom)} ${Math.max(0.25, 3 / zoom)}`;
          const hitStrokeW = Math.max(0.75, 10 / zoom);
          const handleR = Math.max(0.32, 5.5 / zoom);
          const diagSpan = Math.max(width, height) * 2;

          return (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
            >
              {showVerticalAxis && (
                <g>
                  <line
                    x1={symmetryOrigin.x}
                    y1={0}
                    x2={symmetryOrigin.x}
                    y2={height}
                    stroke="var(--ui-accent-secondary)"
                    strokeWidth={strokeW}
                    strokeDasharray={dashPattern}
                  />
                  {!symmetryLocked && !isPlaying && (
                    <>
                      <line
                        x1={symmetryOrigin.x}
                        y1={0}
                        x2={symmetryOrigin.x}
                        y2={height}
                        stroke="transparent"
                        strokeWidth={hitStrokeW}
                        className="pointer-events-auto cursor-ew-resize"
                        onPointerDown={(e) => startSymmetryDrag('x', e)}
                      />
                      <circle
                        cx={symmetryOrigin.x}
                        cy={Math.min(height * 0.15, handleR * 1.4)}
                        r={handleR}
                        fill="var(--ui-accent-secondary)"
                        stroke="var(--ui-bg-app)"
                        strokeWidth={strokeW}
                        className="pointer-events-auto cursor-ew-resize"
                        aria-label="Drag vertical symmetry line"
                        onPointerDown={(e) => startSymmetryDrag('x', e)}
                      />
                    </>
                  )}
                </g>
              )}

              {showHorizontalAxis && (
                <g>
                  <line
                    x1={0}
                    y1={symmetryOrigin.y}
                    x2={width}
                    y2={symmetryOrigin.y}
                    stroke="var(--ui-accent-secondary)"
                    strokeWidth={strokeW}
                    strokeDasharray={dashPattern}
                  />
                  {!symmetryLocked && !isPlaying && (
                    <>
                      <line
                        x1={0}
                        y1={symmetryOrigin.y}
                        x2={width}
                        y2={symmetryOrigin.y}
                        stroke="transparent"
                        strokeWidth={hitStrokeW}
                        className="pointer-events-auto cursor-ns-resize"
                        onPointerDown={(e) => startSymmetryDrag('y', e)}
                      />
                      <circle
                        cx={Math.min(width * 0.15, handleR * 1.4)}
                        cy={symmetryOrigin.y}
                        r={handleR}
                        fill="var(--ui-accent-secondary)"
                        stroke="var(--ui-bg-app)"
                        strokeWidth={strokeW}
                        className="pointer-events-auto cursor-ns-resize"
                        aria-label="Drag horizontal symmetry line"
                        onPointerDown={(e) => startSymmetryDrag('y', e)}
                      />
                    </>
                  )}
                </g>
              )}

              {symmetry === 'radial8' && (
                <g>
                  <line
                    x1={symmetryOrigin.x - diagSpan}
                    y1={symmetryOrigin.y - diagSpan}
                    x2={symmetryOrigin.x + diagSpan}
                    y2={symmetryOrigin.y + diagSpan}
                    stroke="var(--ui-accent-secondary)"
                    strokeOpacity="0.55"
                    strokeWidth={strokeW}
                    strokeDasharray={dashPattern}
                  />
                  <line
                    x1={symmetryOrigin.x - diagSpan}
                    y1={symmetryOrigin.y + diagSpan}
                    x2={symmetryOrigin.x + diagSpan}
                    y2={symmetryOrigin.y - diagSpan}
                    stroke="var(--ui-accent-secondary)"
                    strokeOpacity="0.55"
                    strokeWidth={strokeW}
                    strokeDasharray={dashPattern}
                  />
                </g>
              )}

              {showCenterHandle && !symmetryLocked && !isPlaying && (
                <circle
                  cx={symmetryOrigin.x}
                  cy={symmetryOrigin.y}
                  r={handleR * 1.2}
                  fill="var(--ui-accent)"
                  stroke="var(--ui-bg-app)"
                  strokeWidth={strokeW}
                  className="pointer-events-auto cursor-move"
                  aria-label="Drag symmetry center intersection"
                  onPointerDown={(e) => startSymmetryDrag('xy', e)}
                />
              )}
            </svg>
          );
        })()}

        {/* Hover Pixel Cursor Preview */}
        {hoverPixel && !isPlaying && activeTool !== 'pan' && (
          <div
            className="absolute pointer-events-none border border-[var(--ui-accent)] shadow-[0_0_0_1px_rgba(6,12,27,0.4)]"
            style={{
              left: `${hoverPixel.x * zoom}px`,
              top: `${hoverPixel.y * zoom}px`,
              width: `${zoom}px`,
              height: `${zoom}px`,
            }}
          />
        )}
      </div>

      {/* Movable Symmetry Axis Control Bar */}
      {symmetry !== 'none' && !isPlaying && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 w-max max-w-[calc(100%-1rem)] flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--ui-bg-panel)]/95 border border-[var(--ui-accent-secondary)]/50 shadow-lg text-xs text-[var(--ui-text-primary)]"
          aria-label="Symmetry line position controls"
        >
          <span className="text-[11px] font-medium text-[var(--ui-accent-secondary)] whitespace-nowrap">
            <span className="hidden sm:inline">Symmetry </span>Axis
          </span>

          {(symmetry === 'vertical' || symmetry === 'quad' || symmetry === 'radial4' || symmetry === 'radial8') && (
            <label className="inline-flex items-center gap-1 text-[11px] text-[var(--ui-text-muted)]">
              <span>X</span>
              <input
                type="number"
                aria-label="Symmetry X axis position"
                min={0.5}
                max={width - 0.5}
                step={0.5}
                value={symmetryOrigin.x}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val)) {
                    onSymmetryOriginChange({
                      ...symmetryOrigin,
                      x: snapAxisCoord(val, width),
                    });
                  }
                }}
                className="w-12 sm:w-14 px-1.5 py-0.5 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-[11px] text-[var(--ui-text-primary)] tabular-nums focus:outline-none focus:border-[var(--ui-accent)]"
              />
            </label>
          )}

          {(symmetry === 'horizontal' || symmetry === 'quad' || symmetry === 'radial4' || symmetry === 'radial8') && (
            <label className="inline-flex items-center gap-1 text-[11px] text-[var(--ui-text-muted)]">
              <span>Y</span>
              <input
                type="number"
                aria-label="Symmetry Y axis position"
                min={0.5}
                max={height - 0.5}
                step={0.5}
                value={symmetryOrigin.y}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val)) {
                    onSymmetryOriginChange({
                      ...symmetryOrigin,
                      y: snapAxisCoord(val, height),
                    });
                  }
                }}
                className="w-12 sm:w-14 px-1.5 py-0.5 rounded bg-[var(--ui-bg-app)] border border-[var(--ui-border-strong)] font-mono text-[11px] text-[var(--ui-text-primary)] tabular-nums focus:outline-none focus:border-[var(--ui-accent)]"
              />
            </label>
          )}

          <button
            type="button"
            onClick={onResetSymmetryOrigin}
            title="Reset symmetry lines to canvas center"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[11px] text-[var(--ui-text-primary)] whitespace-nowrap cursor-pointer"
          >
            <Crosshair className="w-3 h-3 text-[var(--ui-accent)]" />
            Center
          </button>

          <button
            type="button"
            onClick={onToggleSymmetryLock}
            aria-pressed={symmetryLocked}
            title={symmetryLocked ? 'Unlock symmetry lines for dragging' : 'Lock symmetry lines in place'}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] whitespace-nowrap cursor-pointer ${
              symmetryLocked
                ? 'border border-[var(--ui-accent-secondary)]/60 text-[var(--ui-accent-secondary)]'
                : 'bg-[var(--ui-bg-hover)] hover:bg-[var(--ui-bg-hover-strong)] text-[var(--ui-text-secondary)]'
            }`}
            style={
              symmetryLocked ? { backgroundColor: 'var(--ui-accent-secondary-soft)' } : undefined
            }
          >
            {symmetryLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>{symmetryLocked ? 'Locked' : 'Drag'}</span>
          </button>
        </div>
      )}

      {/* Locked Layer Notice */}
      {activeLayer?.locked && !isPlaying && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md border border-[var(--ui-accent-secondary)]/40 text-xs text-[var(--ui-text-primary)] pointer-events-none"
          style={{ backgroundColor: 'var(--ui-accent-secondary-soft)' }}
        >
          Active layer "{activeLayer.name}" is locked
        </div>
      )}
    </div>
  );
}
