import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFrameEffects,
  applySymmetryPoints,
  bresenhamLine,
  compositeLayers,
  createBuffer,
  decodeRLE,
  ellipsePoints,
  encodeRLE,
  floodFill,
  hexToRgba,
  polygonPoints,
  rectPoints,
  renderTransitionFrame,
  replaceColorInFrameLayers,
  stampBrush,
  upscaleNearestNeighbor,
} from './pixelMath';
import type { CustomBrush, SerializedLayer } from './types';

test('RLE encode/decode roundtrips arbitrary RGBA pixels accurately', () => {
  const width = 8;
  const height = 8;
  const buf = createBuffer(width, height);
  // Paint pixel (1,1) crimson and (4,4) semi-transparent blue
  const idx1 = (1 * width + 1) * 4;
  buf[idx1] = 220;
  buf[idx1 + 1] = 38;
  buf[idx1 + 2] = 38;
  buf[idx1 + 3] = 255;

  const idx2 = (4 * width + 4) * 4;
  buf[idx2] = 59;
  buf[idx2 + 1] = 130;
  buf[idx2 + 2] = 246;
  buf[idx2 + 3] = 128;

  const encoded = encodeRLE(buf, width, height);
  const decoded = decodeRLE(encoded, width, height);
  assert.deepEqual(Array.from(decoded), Array.from(buf));
});

test('applySymmetryPoints computes vertical, horizontal, quad, and radial symmetries', () => {
  const vert = applySymmetryPoints(2, 3, 16, 16, 'vertical');
  assert.equal(vert.length, 2);
  assert.deepEqual(vert, [
    [2, 3],
    [13, 3],
  ]);

  const quad = applySymmetryPoints(1, 2, 16, 16, 'quad');
  assert.equal(quad.length, 4);

  const radial8 = applySymmetryPoints(2, 5, 16, 16, 'radial8');
  assert.equal(radial8.length, 8);
});

test('applySymmetryPoints respects movable symmetry line origin', () => {
  // Shifted vertical axis at x=4: pixel x=2 mirrors to 2*4 - 2 - 1 = 5
  const shiftedVert = applySymmetryPoints(2, 3, 16, 16, 'vertical', { x: 4, y: 8 });
  assert.deepEqual(shiftedVert, [
    [2, 3],
    [5, 3],
  ]);

  // Half-pixel axis centered on column 6 (origin.x = 6.5): pixel x=6 stays 6, pixel x=5 -> 7
  const halfCenter = applySymmetryPoints(5, 3, 16, 16, 'vertical', { x: 6.5, y: 8 });
  assert.deepEqual(halfCenter, [
    [5, 3],
    [7, 3],
  ]);

  // Shifted horizontal + quad around (4, 6)
  const shiftedQuad = applySymmetryPoints(1, 2, 16, 16, 'quad', { x: 4, y: 6 });
  assert.deepEqual(shiftedQuad, [
    [1, 2],
    [6, 2],
    [1, 9],
    [6, 9],
  ]);

  // Shifted radial4 around (6, 6) -> cx=5.5, cy=5.5
  const shiftedRadial4 = applySymmetryPoints(3, 5, 16, 16, 'radial4', { x: 6, y: 6 });
  assert.equal(shiftedRadial4.length, 4);
  assert.deepEqual(shiftedRadial4[2], [8, 6]);
});

test('replaceColorInFrameLayers recolors matching pixels cleanly', () => {
  const width = 4;
  const height = 4;
  const buf = createBuffer(width, height);
  const red = hexToRgba('#FF0000', 100);
  const blue = hexToRgba('#0000FF', 100);
  buf[0] = red.r; buf[1] = red.g; buf[2] = red.b; buf[3] = red.a;
  buf[4] = blue.r; buf[5] = blue.g; buf[6] = blue.b; buf[7] = blue.a;

  const layers: SerializedLayer[] = [
    {
      id: 'l1',
      name: 'Base',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      pixelsRle: encodeRLE(buf, width, height),
    },
  ];

  const updated = replaceColorInFrameLayers(layers, width, height, '#FF0000', '#3CF2EA');
  const out = decodeRLE(updated[0].pixelsRle, width, height);
  assert.equal(out[0], 0x3c);
  assert.equal(out[1], 0xf2);
  assert.equal(out[2], 0xea);
  // Unmatched blue pixel untouched
  assert.equal(out[4], 0);
  assert.equal(out[6], 255);
});

test('shape generators produce connected pixel coordinates', () => {
  const line = bresenhamLine(0, 0, 4, 4);
  assert.equal(line.length, 5);
  assert.deepEqual(line[0], [0, 0]);
  assert.deepEqual(line[4], [4, 4]);

  const outlineRect = rectPoints(1, 1, 4, 4, false);
  assert.equal(outlineRect.length, 12);

  const filledRect = rectPoints(1, 1, 4, 4, true);
  assert.equal(filledRect.length, 16);

  const circle = ellipsePoints(2, 2, 10, 10, true);
  assert.ok(circle.length > 20);

  const tri = polygonPoints(2, 2, 12, 12, 3, true);
  assert.ok(tri.length > 15);
});

test('floodFill fills contiguous region without leaking across borders', () => {
  const width = 6;
  const height = 6;
  const buf = createBuffer(width, height);
  const wall = hexToRgba('#FFFFFF', 100);
  // Draw a 1px vertical barrier at x=3
  for (let y = 0; y < height; y++) {
    const idx = (y * width + 3) * 4;
    buf[idx] = wall.r;
    buf[idx + 1] = wall.g;
    buf[idx + 2] = wall.b;
    buf[idx + 3] = wall.a;
  }

  const red = hexToRgba('#EF4444', 100);
  const filled = floodFill(buf, width, height, 0, 0, red, 100);
  // Left side (x=0..2) is red, barrier x=3 is white, right side x=4..5 is empty
  assert.equal(filled[0], red.r);
  assert.equal(filled[(0 * width + 3) * 4], 255);
  assert.equal(filled[(0 * width + 4) * 4 + 3], 0);
});

test('stampBrush respects pen opacity, pressure sensitivity, and custom brush matrix', () => {
  const width = 10;
  const height = 10;
  const buf = createBuffer(width, height);
  const crossBrush: CustomBrush = {
    id: 'cross',
    name: 'Cross',
    size: 3,
    matrix: [0, 1, 0, 1, 1, 1, 0, 1, 0],
  };

  stampBrush(buf, width, height, 5, 5, 3, hexToRgba('#3B82F6', 100), 50, 1.0, {
    customBrush: crossBrush,
  });

  // Center (5,5) should have alpha ~128, corner (4,4) should remain 0
  const centerAlpha = buf[(5 * width + 5) * 4 + 3];
  const cornerAlpha = buf[(4 * width + 4) * 4 + 3];
  assert.ok(centerAlpha >= 125 && centerAlpha <= 130);
  assert.equal(cornerAlpha, 0);
});

test('compositeLayers supports multiply blend mode and layer opacity', () => {
  const width = 2;
  const height = 2;
  const baseBuf = createBuffer(width, height);
  // White base
  for (let i = 0; i < 4; i++) {
    baseBuf[i * 4] = 200;
    baseBuf[i * 4 + 1] = 200;
    baseBuf[i * 4 + 2] = 200;
    baseBuf[i * 4 + 3] = 255;
  }

  const topBuf = createBuffer(width, height);
  // Red 50% gray-ish multiplier
  topBuf[0] = 255;
  topBuf[1] = 0;
  topBuf[2] = 0;
  topBuf[3] = 255;

  const layers: SerializedLayer[] = [
    {
      id: 'l1',
      name: 'Base',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'normal',
      pixelsRle: encodeRLE(baseBuf, width, height),
    },
    {
      id: 'l2',
      name: 'Multiply Tint',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'multiply',
      pixelsRle: encodeRLE(topBuf, width, height),
    },
  ];

  const comp = compositeLayers(layers, width, height);
  // Pixel 0: (200/255)*(255/255)=200 red, 0 green, 0 blue
  assert.equal(comp[0], 200);
  assert.equal(comp[1], 0);
  assert.equal(comp[2], 0);
  // Pixel 1 untouched by topBuf -> stays 200,200,200
  assert.equal(comp[4], 200);
  assert.equal(comp[5], 200);
});

test('applyFrameEffects applies outline and invert cleanly', () => {
  const width = 5;
  const height = 5;
  const buf = createBuffer(width, height);
  const centerIdx = (2 * width + 2) * 4;
  buf[centerIdx] = 100;
  buf[centerIdx + 1] = 150;
  buf[centerIdx + 2] = 200;
  buf[centerIdx + 3] = 255;

  const outlined = applyFrameEffects(buf, width, height, [
    { id: 'f1', type: 'outline', enabled: true, intensity: 100, color: '#FFFFFF' },
  ]);
  // Neighbor (2,1) should now have white outline
  const topNeighborIdx = (1 * width + 2) * 4;
  assert.equal(outlined[topNeighborIdx], 255);
  assert.equal(outlined[topNeighborIdx + 3], 255);

  const inverted = applyFrameEffects(buf, width, height, [
    { id: 'f2', type: 'invert', enabled: true, intensity: 100 },
  ]);
  assert.equal(inverted[centerIdx], 155);
  assert.equal(inverted[centerIdx + 1], 105);
});

test('renderTransitionFrame interpolates crossfade and slide-left', () => {
  const width = 4;
  const height = 2;
  const a = createBuffer(width, height);
  const b = createBuffer(width, height);
  a[0] = 200;
  a[3] = 255;
  b[0] = 0;
  b[1] = 200;
  b[3] = 255;

  const midCrossfade = renderTransitionFrame(a, b, width, height, 'crossfade', 0.5);
  assert.equal(midCrossfade[0], 100);
  assert.equal(midCrossfade[1], 100);

  const midSlide = renderTransitionFrame(a, b, width, height, 'slide-left', 0.5);
  assert.equal(midSlide.length, width * height * 4);
});

test('upscaleNearestNeighbor produces crisp exact pixel blocks', () => {
  const buf = createBuffer(2, 2);
  buf[0] = 255;
  buf[3] = 255;
  const upscaled = upscaleNearestNeighbor(buf, 2, 2, 4);
  assert.equal(upscaled.length, 8 * 8 * 4);
  assert.equal(upscaled[(3 * 8 + 3) * 4], 255);
  assert.equal(upscaled[(4 * 8 + 4) * 4 + 3], 0);
});
