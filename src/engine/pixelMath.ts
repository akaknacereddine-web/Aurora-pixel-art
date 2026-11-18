import type {
  BlendMode,
  CustomBrush,
  FrameEffect,
  RgbaColor,
  SerializedLayer,
  SymmetryMode,
  SymmetryOrigin,
  TransitionType,
} from './types';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function createBuffer(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4);
}

export function cloneBuffer(buf: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(buf);
}

export function hexToRgba(hex: string, alphaPercent = 100): RgbaColor {
  const clean = hex.replace('#', '').trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16) || 0;
    g = parseInt(clean.slice(2, 4), 16) || 0;
    b = parseInt(clean.slice(4, 6), 16) || 0;
  }
  const a = Math.round(clamp(alphaPercent, 0, 100) * 2.55);
  return { r, g, b, a };
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Compact Run-Length Encoding for RGBA pixel buffers.
 * Format: "count:RRGGBBAA;..." skipping trailing empty or collapsing identical consecutive pixels.
 */
export function encodeRLE(rgba: Uint8ClampedArray, width: number, height: number): string {
  const totalPixels = width * height;
  if (totalPixels === 0) return '';
  const parts: string[] = [];
  let prevHex = '';
  let count = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    const a = rgba[idx + 3];
    // Treat completely transparent pixels uniformly as 00000000
    const hex =
      a === 0
        ? '0'
        : (((r << 24) | (g << 16) | (b << 8) | a) >>> 0)
            .toString(16)
            .padStart(8, '0');

    if (hex === prevHex) {
      count++;
    } else {
      if (count > 0) {
        parts.push(count === 1 ? prevHex : `${count}*${prevHex}`);
      }
      prevHex = hex;
      count = 1;
    }
  }
  if (count > 0) {
    parts.push(count === 1 ? prevHex : `${count}*${prevHex}`);
  }
  return parts.join(',');
}

export function decodeRLE(rle: string, width: number, height: number): Uint8ClampedArray {
  const out = createBuffer(width, height);
  if (!rle) return out;
  const maxPixels = width * height;
  const tokens = rle.split(',');
  let pixelCursor = 0;

  for (let t = 0; t < tokens.length && pixelCursor < maxPixels; t++) {
    const token = tokens[t];
    if (!token) continue;
    const starIdx = token.indexOf('*');
    let count = 1;
    let valStr = token;
    if (starIdx > 0) {
      count = parseInt(token.slice(0, starIdx), 10) || 1;
      valStr = token.slice(starIdx + 1);
    }
    if (valStr === '0') {
      pixelCursor += count;
      continue;
    }
    const packed = parseInt(valStr, 16) >>> 0;
    const r = (packed >>> 24) & 0xff;
    const g = (packed >>> 16) & 0xff;
    const b = (packed >>> 8) & 0xff;
    const a = packed & 0xff;
    const end = Math.min(maxPixels, pixelCursor + count);
    for (let p = pixelCursor; p < end; p++) {
      const idx = p * 4;
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = a;
    }
    pixelCursor = end;
  }
  return out;
}

export function applySymmetryPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  mode: SymmetryMode,
  origin?: SymmetryOrigin
): Array<[number, number]> {
  const pts: Array<[number, number]> = [[x, y]];
  const axisX = origin ? origin.x : width / 2;
  const axisY = origin ? origin.y : height / 2;
  const mx = Math.round(2 * axisX - x - 1);
  const my = Math.round(2 * axisY - y - 1);

  if (mode === 'vertical') {
    pts.push([mx, y]);
  } else if (mode === 'horizontal') {
    pts.push([x, my]);
  } else if (mode === 'quad') {
    pts.push([mx, y], [x, my], [mx, my]);
  } else if (mode === 'radial4' || mode === 'radial8') {
    const cx = axisX - 0.5;
    const cy = axisY - 0.5;
    const dx = x - cx;
    const dy = y - cy;
    // 90, 180, 270 degrees around (cx, cy)
    pts.push(
      [Math.round(cx - dy), Math.round(cy + dx)],
      [Math.round(cx - dx), Math.round(cy - dy)],
      [Math.round(cx + dy), Math.round(cy - dx)]
    );
    if (mode === 'radial8') {
      // Mirror across axes and diagonals around (cx, cy)
      pts.push(
        [mx, y],
        [Math.round(cx + dy), Math.round(cy + dx)],
        [x, my],
        [Math.round(cx - dy), Math.round(cy - dx)]
      );
    }
  }

  // Deduplicate and filter in-bounds
  const seen = new Set<string>();
  const unique: Array<[number, number]> = [];
  for (const [px, py] of pts) {
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const key = `${px},${py}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push([px, py]);
    }
  }
  return unique;
}

export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let cx = Math.round(x0);
  let cy = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - cx);
  const dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1;
  const sy = cy < ty ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([cx, cy]);
    if (cx === tx && cy === ty) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

export function rectPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean
): Array<[number, number]> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const points: Array<[number, number]> = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (filled || x === minX || x === maxX || y === minY || y === maxY) {
        points.push([x, y]);
      }
    }
  }
  return points;
}

export function ellipsePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean
): Array<[number, number]> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(0.5, (maxX - minX) / 2);
  const ry = Math.max(0.5, (maxY - minY) / 2);

  const seen = new Set<string>();
  const points: Array<[number, number]> = [];
  const add = (px: number, py: number) => {
    const k = `${px},${py}`;
    if (!seen.has(k)) {
      seen.add(k);
      points.push([px, py]);
    }
  };

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const nx = (x - cx) / (rx + 0.35);
        const ny = (y - cy) / (ry + 0.35);
        if (nx * nx + ny * ny <= 1) {
          add(x, y);
        }
      }
    }
  } else {
    const steps = Math.max(16, Math.ceil(Math.PI * 2 * Math.max(rx, ry) * 2));
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(angle) * rx);
      const py = Math.round(cy + Math.sin(angle) * ry);
      add(px, py);
    }
  }
  return points;
}

export function polygonPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sides: number,
  filled: boolean
): Array<[number, number]> {
  const n = clamp(Math.round(sides), 3, 12);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(1, Math.abs(x1 - x0) / 2);
  const ry = Math.max(1, Math.abs(y1 - y0) / 2);
  const vertices: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    vertices.push([Math.round(cx + Math.cos(angle) * rx), Math.round(cy + Math.sin(angle) * ry)]);
  }

  const seen = new Set<string>();
  const points: Array<[number, number]> = [];
  const add = (px: number, py: number) => {
    const k = `${px},${py}`;
    if (!seen.has(k)) {
      seen.add(k);
      points.push([px, py]);
    }
  };

  // Outline edges
  for (let i = 0; i < vertices.length; i++) {
    const [vx0, vy0] = vertices[i];
    const [vx1, vy1] = vertices[(i + 1) % vertices.length];
    for (const [px, py] of bresenhamLine(vx0, vy0, vx1, vy1)) {
      add(px, py);
    }
  }

  if (filled) {
    const minY = Math.min(...vertices.map((v) => v[1]));
    const maxY = Math.max(...vertices.map((v) => v[1]));
    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < vertices.length; i++) {
        const [ax, ay] = vertices[i];
        const [bx, by] = vertices[(i + 1) % vertices.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          const ix = ax + ((y - ay) * (bx - ax)) / (by - ay);
          intersections.push(ix);
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const startX = Math.ceil(intersections[i]);
        const endX = Math.floor(intersections[i + 1]);
        for (let x = startX; x <= endX; x++) {
          add(x, y);
        }
      }
    }
  }

  return points;
}

export function stampBrush(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  brushSize: number,
  color: RgbaColor,
  penOpacity: number, // 0..100
  pressure: number, // 0..1
  options: {
    erase?: boolean;
    customBrush?: CustomBrush;
    pressureSize?: boolean;
    pressureOpacity?: boolean;
  } = {}
): void {
  const effectivePressure = clamp(pressure, 0.1, 1);
  const scaledSize = options.pressureSize
    ? Math.max(1, Math.round(brushSize * (0.35 + 0.65 * effectivePressure)))
    : Math.max(1, Math.round(brushSize));

  const opacityFactor =
    clamp(penOpacity, 0, 100) / 100 *
    (options.pressureOpacity ? 0.25 + 0.75 * effectivePressure : 1);

  if (options.customBrush && options.customBrush.size > 1 && options.customBrush.matrix.length === options.customBrush.size * options.customBrush.size) {
    const bSize = options.customBrush.size;
    const scale = Math.max(1, Math.round(scaledSize / bSize));
    const total = bSize * scale;
    const half = Math.floor(total / 2);

    for (let dy = 0; dy < total; dy++) {
      for (let dx = 0; dx < total; dx++) {
        const mx = Math.floor(dx / scale);
        const my = Math.floor(dy / scale);
        const weight = options.customBrush.matrix[my * bSize + mx] ?? 0;
        if (weight <= 0) continue;
        const px = cx - half + dx;
        const py = cy - half + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        paintSinglePixel(rgba, width, px, py, color, opacityFactor * weight, !!options.erase);
      }
    }
    return;
  }

  const half = Math.floor(scaledSize / 2);
  const radius = scaledSize / 2;
  for (let dy = 0; dy < scaledSize; dy++) {
    for (let dx = 0; dx < scaledSize; dx++) {
      const px = cx - half + dx;
      const py = cy - half + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      if (scaledSize >= 3) {
        const distX = dx + 0.5 - radius;
        const distY = dy + 0.5 - radius;
        if (distX * distX + distY * distY > radius * radius + 0.25) continue;
      }
      paintSinglePixel(rgba, width, px, py, color, opacityFactor, !!options.erase);
    }
  }
}

function paintSinglePixel(
  rgba: Uint8ClampedArray,
  width: number,
  px: number,
  py: number,
  color: RgbaColor,
  opacityFactor: number,
  erase: boolean
): void {
  const idx = (py * width + px) * 4;
  if (erase) {
    const eraseAlpha = clamp(opacityFactor, 0, 1);
    rgba[idx + 3] = Math.round(rgba[idx + 3] * (1 - eraseAlpha));
    if (rgba[idx + 3] === 0) {
      rgba[idx] = 0;
      rgba[idx + 1] = 0;
      rgba[idx + 2] = 0;
    }
    return;
  }

  const srcAlpha = clamp((color.a / 255) * opacityFactor, 0, 1);
  if (srcAlpha <= 0) return;
  const dstAlpha = rgba[idx + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) return;

  rgba[idx] = Math.round((color.r * srcAlpha + rgba[idx] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  rgba[idx + 1] = Math.round((color.g * srcAlpha + rgba[idx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  rgba[idx + 2] = Math.round((color.b * srcAlpha + rgba[idx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
  rgba[idx + 3] = Math.round(outAlpha * 255);
}

export function floodFill(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor: RgbaColor,
  opacityPercent = 100
): Uint8ClampedArray {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return rgba;
  const out = cloneBuffer(rgba);
  const startIdx = (startY * width + startX) * 4;
  const tr = out[startIdx];
  const tg = out[startIdx + 1];
  const tb = out[startIdx + 2];
  const ta = out[startIdx + 3];

  const finalAlpha = Math.round((fillColor.a * clamp(opacityPercent, 0, 100)) / 100);
  if (tr === fillColor.r && tg === fillColor.g && tb === fillColor.b && ta === finalAlpha) {
    return out;
  }

  const matches = (idx: number) =>
    out[idx] === tr && out[idx + 1] === tg && out[idx + 2] === tb && out[idx + 3] === ta;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const pIdx = y * width + x;
    if (visited[pIdx]) continue;
    const idx = pIdx * 4;
    if (!matches(idx)) continue;

    visited[pIdx] = 1;
    if (opacityPercent >= 100 && fillColor.a === 255) {
      out[idx] = fillColor.r;
      out[idx + 1] = fillColor.g;
      out[idx + 2] = fillColor.b;
      out[idx + 3] = 255;
    } else {
      paintSinglePixel(out, width, x, y, fillColor, opacityPercent / 100, false);
    }

    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return out;
}

function blendChannel(b: number, s: number, mode: BlendMode): number {
  switch (mode) {
    case 'normal':
      return s;
    case 'multiply':
      return b * s;
    case 'screen':
      return 1 - (1 - b) * (1 - s);
    case 'overlay':
      return b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'darken':
      return Math.min(b, s);
    case 'lighten':
      return Math.max(b, s);
    case 'color-dodge':
      return s >= 1 ? 1 : Math.min(1, b / (1 - s));
    case 'color-burn':
      return s <= 0 ? 0 : Math.max(0, 1 - (1 - b) / s);
    case 'hard-light':
      return s < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'soft-light':
      return s <= 0.5
        ? b - (1 - 2 * s) * b * (1 - b)
        : b + (2 * s - 1) * ((b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b);
    case 'difference':
      return Math.abs(b - s);
    case 'exclusion':
      return b + s - 2 * b * s;
    default:
      return s;
  }
}

export function compositeLayers(
  layers: SerializedLayer[],
  width: number,
  height: number
): Uint8ClampedArray {
  const out = createBuffer(width, height);
  const pixelCount = width * height;

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const layerOpacity = clamp(layer.opacity, 0, 100) / 100;
    const src = decodeRLE(layer.pixelsRle, width, height);

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const sa = (src[idx + 3] / 255) * layerOpacity;
      if (sa <= 0) continue;

      const sr = src[idx] / 255;
      const sg = src[idx + 1] / 255;
      const sb = src[idx + 2] / 255;

      const ba = out[idx + 3] / 255;
      if (ba <= 0) {
        out[idx] = src[idx];
        out[idx + 1] = src[idx + 1];
        out[idx + 2] = src[idx + 2];
        out[idx + 3] = Math.round(sa * 255);
        continue;
      }

      const br = out[idx] / 255;
      const bg = out[idx + 1] / 255;
      const bb = out[idx + 2] / 255;

      const cr = blendChannel(br, sr, layer.blendMode);
      const cg = blendChannel(bg, sg, layer.blendMode);
      const cb = blendChannel(bb, sb, layer.blendMode);

      const outA = sa + ba * (1 - sa);
      // Standard Porter-Duff + W3C blend compositing
      const r = ((1 - sa) * ba * br + (1 - ba) * sa * sr + ba * sa * cr) / outA;
      const g = ((1 - sa) * ba * bg + (1 - ba) * sa * sg + ba * sa * cg) / outA;
      const b = ((1 - sa) * ba * bb + (1 - ba) * sa * sb + ba * sa * cb) / outA;

      out[idx] = Math.round(clamp(r, 0, 1) * 255);
      out[idx + 1] = Math.round(clamp(g, 0, 1) * 255);
      out[idx + 2] = Math.round(clamp(b, 0, 1) * 255);
      out[idx + 3] = Math.round(clamp(outA, 0, 1) * 255);
    }
  }
  return out;
}

export function applyFrameEffects(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  effects: FrameEffect[]
): Uint8ClampedArray {
  let current = cloneBuffer(rgba);

  for (const fx of effects) {
    if (!fx.enabled || fx.intensity <= 0) continue;
    const strength = clamp(fx.intensity, 0, 100) / 100;

    if (fx.type === 'grayscale') {
      for (let i = 0; i < current.length; i += 4) {
        if (current[i + 3] === 0) continue;
        const lum = Math.round(0.299 * current[i] + 0.587 * current[i + 1] + 0.114 * current[i + 2]);
        current[i] = Math.round(current[i] * (1 - strength) + lum * strength);
        current[i + 1] = Math.round(current[i + 1] * (1 - strength) + lum * strength);
        current[i + 2] = Math.round(current[i + 2] * (1 - strength) + lum * strength);
      }
    } else if (fx.type === 'invert') {
      for (let i = 0; i < current.length; i += 4) {
        if (current[i + 3] === 0) continue;
        current[i] = Math.round(current[i] * (1 - strength) + (255 - current[i]) * strength);
        current[i + 1] = Math.round(current[i + 1] * (1 - strength) + (255 - current[i + 1]) * strength);
        current[i + 2] = Math.round(current[i + 2] * (1 - strength) + (255 - current[i + 2]) * strength);
      }
    } else if (fx.type === 'hue-shift') {
      const shift = strength * 360;
      for (let i = 0; i < current.length; i += 4) {
        if (current[i + 3] === 0) continue;
        const [r, g, b] = shiftHue(current[i], current[i + 1], current[i + 2], shift);
        current[i] = r;
        current[i + 1] = g;
        current[i + 2] = b;
      }
    } else if (fx.type === 'scanlines') {
      const darkenFactor = 1 - 0.55 * strength;
      for (let y = 0; y < height; y++) {
        if (y % 2 === 1) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (current[idx + 3] === 0) continue;
            current[idx] = Math.round(current[idx] * darkenFactor);
            current[idx + 1] = Math.round(current[idx + 1] * darkenFactor);
            current[idx + 2] = Math.round(current[idx + 2] * darkenFactor);
          }
        }
      }
    } else if (fx.type === 'pixelate') {
      const block = Math.max(2, Math.round(2 + strength * 6));
      const next = cloneBuffer(current);
      for (let by = 0; by < height; by += block) {
        for (let bx = 0; bx < width; bx += block) {
          const sx = Math.min(width - 1, bx + Math.floor(block / 2));
          const sy = Math.min(height - 1, by + Math.floor(block / 2));
          const sIdx = (sy * width + sx) * 4;
          for (let y = by; y < Math.min(height, by + block); y++) {
            for (let x = bx; x < Math.min(width, bx + block); x++) {
              const dIdx = (y * width + x) * 4;
              next[dIdx] = current[sIdx];
              next[dIdx + 1] = current[sIdx + 1];
              next[dIdx + 2] = current[sIdx + 2];
              next[dIdx + 3] = current[sIdx + 3];
            }
          }
        }
      }
      current = next;
    } else if (fx.type === 'glitch') {
      const offset = Math.max(1, Math.round(strength * 4));
      const next = createBuffer(width, height);
      for (let y = 0; y < height; y++) {
        const jitter = y % 5 === 0 ? offset : 0;
        for (let x = 0; x < width; x++) {
          const rx = clamp(x - offset + jitter, 0, width - 1);
          const bx = clamp(x + offset + jitter, 0, width - 1);
          const gx = clamp(x + jitter, 0, width - 1);
          const rIdx = (y * width + rx) * 4;
          const gIdx = (y * width + gx) * 4;
          const bIdx = (y * width + bx) * 4;
          const dIdx = (y * width + x) * 4;
          const alpha = Math.max(current[rIdx + 3], current[gIdx + 3], current[bIdx + 3]);
          next[dIdx] = current[rIdx];
          next[dIdx + 1] = current[gIdx + 1];
          next[dIdx + 2] = current[bIdx + 2];
          next[dIdx + 3] = alpha;
        }
      }
      current = next;
    } else if (fx.type === 'outline') {
      const col = hexToRgba(fx.color || '#FFFFFF', Math.round(strength * 100));
      const next = cloneBuffer(current);
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          if (current[idx + 3] > 20) continue;
          let touchesOpaque = false;
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
              if (current[(ny * width + nx) * 4 + 3] > 20) {
                touchesOpaque = true;
                break;
              }
            }
          }
          if (touchesOpaque) {
            next[idx] = col.r;
            next[idx + 1] = col.g;
            next[idx + 2] = col.b;
            next[idx + 3] = col.a;
          }
        }
      }
      current = next;
    } else if (fx.type === 'drop-shadow') {
      const shift = Math.max(1, Math.round(1 + strength * 2));
      const col = hexToRgba(fx.color || '#000000', Math.round(strength * 70));
      const next = createBuffer(width, height);
      // Draw shadow first
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const sIdx = (y * width + x) * 4;
          if (current[sIdx + 3] <= 20) continue;
          const tx = x + shift;
          const ty = y + shift;
          if (tx < width && ty < height) {
            const dIdx = (ty * width + tx) * 4;
            next[dIdx] = col.r;
            next[dIdx + 1] = col.g;
            next[dIdx + 2] = col.b;
            next[dIdx + 3] = Math.round((current[sIdx + 3] / 255) * col.a);
          }
        }
      }
      // Composite original over shadow
      for (let i = 0; i < current.length; i += 4) {
        if (current[i + 3] === 0) continue;
        const sa = current[i + 3] / 255;
        const da = next[i + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa > 0) {
          next[i] = Math.round((current[i] * sa + next[i] * da * (1 - sa)) / oa);
          next[i + 1] = Math.round((current[i + 1] * sa + next[i + 1] * da * (1 - sa)) / oa);
          next[i + 2] = Math.round((current[i + 2] * sa + next[i + 2] * da * (1 - sa)) / oa);
          next[i + 3] = Math.round(oa * 255);
        }
      }
      current = next;
    } else if (fx.type === 'glow') {
      const col = hexToRgba(fx.color || '#60A5FA', 100);
      const next = cloneBuffer(current);
      const radius = Math.max(1, Math.round(1 + strength * 2));
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          if (current[idx + 3] > 200) continue;
          let hits = 0;
          let samples = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                samples++;
                if (current[(ny * width + nx) * 4 + 3] > 128) hits++;
              }
            }
          }
          if (hits > 0 && samples > 0) {
            const glowAlpha = Math.round(clamp((hits / samples) * strength * 220, 0, 220));
            if (next[idx + 3] === 0) {
              next[idx] = col.r;
              next[idx + 1] = col.g;
              next[idx + 2] = col.b;
              next[idx + 3] = glowAlpha;
            }
          }
        }
      }
      current = next;
    } else if (fx.type === 'dither-noise') {
      const amt = Math.round(strength * 48);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          if (current[idx + 3] === 0) continue;
          const bayer = ((x & 1) * 2 + (y & 1) - 1.5) * amt;
          current[idx] = clamp(Math.round(current[idx] + bayer), 0, 255);
          current[idx + 1] = clamp(Math.round(current[idx + 1] + bayer), 0, 255);
          current[idx + 2] = clamp(Math.round(current[idx + 2] + bayer), 0, 255);
        }
      }
    }
  }
  return current;
}

function shiftHue(r: number, g: number, b: number, deg: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deg) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let ro = 0, go = 0, bo = 0;
  if (h < 60) [ro, go, bo] = [c, x, 0];
  else if (h < 120) [ro, go, bo] = [x, c, 0];
  else if (h < 180) [ro, go, bo] = [0, c, x];
  else if (h < 240) [ro, go, bo] = [0, x, c];
  else if (h < 300) [ro, go, bo] = [x, 0, c];
  else [ro, go, bo] = [c, 0, x];

  return [
    Math.round((ro + m) * 255),
    Math.round((go + m) * 255),
    Math.round((bo + m) * 255),
  ];
}

export function renderTransitionFrame(
  fromRgba: Uint8ClampedArray,
  toRgba: Uint8ClampedArray,
  width: number,
  height: number,
  transition: TransitionType,
  progress: number // 0..1
): Uint8ClampedArray {
  const p = clamp(progress, 0, 1);
  if (transition === 'cut' || p <= 0) return cloneBuffer(fromRgba);
  if (p >= 1) return cloneBuffer(toRgba);

  const out = createBuffer(width, height);
  const pixelCount = width * height;

  if (transition === 'crossfade') {
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.round(fromRgba[i] * (1 - p) + toRgba[i] * p);
    }
    return out;
  }

  if (transition === 'slide-left' || transition === 'slide-right') {
    const dir = transition === 'slide-left' ? -1 : 1;
    const shift = Math.round(p * width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dIdx = (y * width + x) * 4;
        const fromX = x - dir * shift;
        const toX = fromX + dir * width;
        if (fromX >= 0 && fromX < width) {
          const sIdx = (y * width + fromX) * 4;
          out[dIdx] = fromRgba[sIdx];
          out[dIdx + 1] = fromRgba[sIdx + 1];
          out[dIdx + 2] = fromRgba[sIdx + 2];
          out[dIdx + 3] = fromRgba[sIdx + 3];
        } else if (toX >= 0 && toX < width) {
          const sIdx = (y * width + toX) * 4;
          out[dIdx] = toRgba[sIdx];
          out[dIdx + 1] = toRgba[sIdx + 1];
          out[dIdx + 2] = toRgba[sIdx + 2];
          out[dIdx + 3] = toRgba[sIdx + 3];
        }
      }
    }
    return out;
  }

  if (transition === 'wipe-down') {
    const splitY = Math.round(p * height);
    for (let y = 0; y < height; y++) {
      const src = y < splitY ? toRgba : fromRgba;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        out[idx] = src[idx];
        out[idx + 1] = src[idx + 1];
        out[idx + 2] = src[idx + 2];
        out[idx + 3] = src[idx + 3];
      }
    }
    return out;
  }

  if (transition === 'pixel-dissolve') {
    for (let i = 0; i < pixelCount; i++) {
      // Deterministic pseudo-random threshold per pixel
      const hash = ((i * 2654435761) >>> 0) / 4294967296;
      const src = hash < p ? toRgba : fromRgba;
      const idx = i * 4;
      out[idx] = src[idx];
      out[idx + 1] = src[idx + 1];
      out[idx + 2] = src[idx + 2];
      out[idx + 3] = src[idx + 3];
    }
    return out;
  }

  if (transition === 'flash-black') {
    const src = p < 0.5 ? fromRgba : toRgba;
    const brightness = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
    for (let i = 0; i < out.length; i += 4) {
      out[i] = Math.round(src[i] * brightness);
      out[i + 1] = Math.round(src[i + 1] * brightness);
      out[i + 2] = Math.round(src[i + 2] * brightness);
      out[i + 3] = src[i + 3];
    }
    return out;
  }

  return cloneBuffer(fromRgba);
}

export function shiftBuffer(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  dx: number,
  dy: number
): Uint8ClampedArray {
  const out = createBuffer(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) {
        const sIdx = (sy * width + sx) * 4;
        const dIdx = (y * width + x) * 4;
        out[dIdx] = rgba[sIdx];
        out[dIdx + 1] = rgba[sIdx + 1];
        out[dIdx + 2] = rgba[sIdx + 2];
        out[dIdx + 3] = rgba[sIdx + 3];
      }
    }
  }
  return out;
}

export function upscaleNearestNeighbor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number
): Uint8ClampedArray {
  const s = Math.max(1, Math.round(scale));
  const outW = width * s;
  const outH = height * s;
  const out = createBuffer(outW, outH);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sIdx = (y * width + x) * 4;
      const r = rgba[sIdx];
      const g = rgba[sIdx + 1];
      const b = rgba[sIdx + 2];
      const a = rgba[sIdx + 3];
      if (a === 0) continue;
      for (let sy = 0; sy < s; sy++) {
        for (let sx = 0; sx < s; sx++) {
          const dIdx = ((y * s + sy) * outW + (x * s + sx)) * 4;
          out[dIdx] = r;
          out[dIdx + 1] = g;
          out[dIdx + 2] = b;
          out[dIdx + 3] = a;
        }
      }
    }
  }
  return out;
}

export function replaceColorInFrameLayers(
  layers: SerializedLayer[],
  width: number,
  height: number,
  oldHex: string,
  newHex: string
): SerializedLayer[] {
  const src = hexToRgba(oldHex, 100);
  const dst = hexToRgba(newHex, 100);
  if (src.r === dst.r && src.g === dst.g && src.b === dst.b) return layers;

  return layers.map((layer) => {
    const buf = decodeRLE(layer.pixelsRle, width, height);
    let changed = false;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] === 0) continue;
      if (buf[i] === src.r && buf[i + 1] === src.g && buf[i + 2] === src.b) {
        buf[i] = dst.r;
        buf[i + 1] = dst.g;
        buf[i + 2] = dst.b;
        changed = true;
      }
    }
    return changed ? { ...layer, pixelsRle: encodeRLE(buf, width, height) } : layer;
  });
}
