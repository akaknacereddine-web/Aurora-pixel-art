import {
  applyFrameEffects,
  compositeLayers,
  renderTransitionFrame,
  upscaleNearestNeighbor,
} from '../engine/pixelMath';
import type { Project, SerializedFrame } from '../engine/types';

export function renderFrameToRgba(frame: SerializedFrame, width: number, height: number): Uint8ClampedArray {
  const composited = compositeLayers(frame.layers, width, height);
  if (frame.effects && frame.effects.some((e) => e.enabled && e.intensity > 0)) {
    return applyFrameEffects(composited, width, height, frame.effects);
  }
  return composited;
}

export function rgbaToDataUrl(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scale = 1,
  backgroundColor?: string
): string {
  const scaled = scale > 1 ? upscaleNearestNeighbor(rgba, width, height, scale) : rgba;
  const outW = width * scale;
  const outH = height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outW, outH);
  }

  const tmp = document.createElement('canvas');
  tmp.width = outW;
  tmp.height = outH;
  const tmpCtx = tmp.getContext('2d')!;
  const imgData = new ImageData(new Uint8ClampedArray(scaled), outW, outH);
  tmpCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0);
  return canvas.toDataURL('image/png');
}

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportHighResPng(
  project: Project,
  frameIndex: number,
  scale: number,
  backgroundColor?: string
): void {
  const frame = project.frames[frameIndex] || project.frames[0];
  const rgba = renderFrameToRgba(frame, project.width, project.height);
  const url = rgbaToDataUrl(rgba, project.width, project.height, scale, backgroundColor);
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  triggerDownload(url, `${safeName}_${project.width * scale}x${project.height * scale}.png`);
}

export function exportSpriteSheetPng(
  project: Project,
  scale: number,
  columns = 0,
  backgroundColor?: string
): void {
  const count = project.frames.length;
  const cols = columns > 0 ? Math.min(columns, count) : count;
  const rows = Math.ceil(count / cols);
  const cellW = project.width * scale;
  const cellH = project.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  project.frames.forEach((frame, idx) => {
    const rgba = renderFrameToRgba(frame, project.width, project.height);
    const scaled = scale > 1 ? upscaleNearestNeighbor(rgba, project.width, project.height, scale) : rgba;
    const tmp = document.createElement('canvas');
    tmp.width = cellW;
    tmp.height = cellH;
    tmp.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(scaled), cellW, cellH), 0, 0);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    ctx.drawImage(tmp, col * cellW, row * cellH);
  });

  const safeName = project.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  triggerDownload(canvas.toDataURL('image/png'), `${safeName}_spritesheet_${scale}x.png`);
}

export async function exportAnimationWebm(
  project: Project,
  scale: number,
  backgroundColor = '#111215'
): Promise<void> {
  const outW = project.width * scale;
  const outH = project.height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const renderedFrames = project.frames.map((f) => renderFrameToRgba(f, project.width, project.height));

  const drawRgba = (rgba: Uint8ClampedArray) => {
    ctx.fillStyle = backgroundColor === 'transparent' ? '#111215' : backgroundColor;
    ctx.fillRect(0, 0, outW, outH);
    const tmp = document.createElement('canvas');
    tmp.width = project.width;
    tmp.height = project.height;
    tmp.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), project.width, project.height), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, outW, outH);
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  recorder.start();
  for (let i = 0; i < project.frames.length; i++) {
    const frame = project.frames[i];
    const nextIdx = (i + 1) % project.frames.length;
    const curRgba = renderedFrames[i];
    const nextRgba = renderedFrames[nextIdx];

    const hasTransition = frame.transition !== 'cut' && frame.transitionMs > 0 && project.frames.length > 1;
    const holdMs = hasTransition ? Math.max(20, frame.durationMs - frame.transitionMs) : frame.durationMs;

    drawRgba(curRgba);
    await wait(holdMs);

    if (hasTransition) {
      const steps = Math.max(2, Math.round(frame.transitionMs / 33));
      for (let s = 1; s <= steps; s++) {
        const transRgba = renderTransitionFrame(
          curRgba,
          nextRgba,
          project.width,
          project.height,
          frame.transition,
          s / steps
        );
        drawRgba(transRgba);
        await wait(Math.round(frame.transitionMs / steps));
      }
    }
  }

  recorder.stop();
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  triggerDownload(url, `${safeName}_animation.webm`);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
