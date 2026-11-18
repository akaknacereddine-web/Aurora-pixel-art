import { useEffect, useRef } from 'react';
import { decodeRLE } from '../engine/pixelMath';
import type { SerializedFrame, SerializedLayer } from '../engine/types';
import { renderFrameToRgba } from '../services/exporter';

interface FrameThumbnailProps {
  frame?: SerializedFrame;
  layer?: SerializedLayer;
  width: number;
  height: number;
  className?: string;
}

export function FrameThumbnail({ frame, layer, width, height, className = '' }: FrameThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rgba: Uint8ClampedArray;
    if (frame) {
      rgba = renderFrameToRgba(frame, width, height);
    } else if (layer) {
      rgba = decodeRLE(layer.pixelsRle, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imgData, 0, 0);
  }, [frame, layer, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`pixelated checkerboard-sm block ${className}`}
    />
  );
}
