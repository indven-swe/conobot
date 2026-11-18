/**
 * Generates the ConoBot app icon as a 1024x1024 PNG without any image
 * dependencies: signed-distance-field rasterising, 3x supersampling and a
 * hand-rolled PNG encoder.
 *
 *   node scripts/generate-icon.mjs
 *   npx tauri icon app-icon.png -o src-tauri/icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = 1024;
const SS = 3; // supersampling factor per axis
const UNIT = SIZE / 24; // icon coordinates are authored on a 24x24 grid

const MINT = [92, 232, 180];
const IRIS = [139, 149, 255];
const LIGHT = [232, 238, 249];

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const mix = (a, b, t) => a.map((channel, index) => channel + (b[index] - channel) * t);

function sdRoundRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - halfW + radius;
  const qy = Math.abs(py - cy) - halfH + radius;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSq);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function coverage(distance, halfWidth) {
  // Smooth 1.2px edge in icon space.
  return clamp01((halfWidth - distance) / 0.11 + 0.5);
}

/** Layer a shape over the pixel using alpha compositing. */
function paint(pixel, rgb, alpha) {
  const a = clamp01(alpha);
  if (a <= 0) return;
  pixel[0] = pixel[0] + (rgb[0] - pixel[0]) * a;
  pixel[1] = pixel[1] + (rgb[1] - pixel[1]) * a;
  pixel[2] = pixel[2] + (rgb[2] - pixel[2]) * a;
  pixel[3] = Math.max(pixel[3], a);
}

function shade(x, y) {
  // x, y are in 24-unit icon space, origin top-left.
  const pixel = [0, 0, 0, 0];

  // ---- background plate -------------------------------------------------
  const plate = sdRoundRect(x, y, 12, 12, 11.1, 11.1, 5.4);
  const plateAlpha = coverage(plate, 0);
  if (plateAlpha > 0) {
    const gradient = clamp01((x + y) / 48);
    let base = mix([9, 12, 18], [5, 6, 9], gradient);

    // Aurora pools, mirroring the app's ambient lighting.
    const mintGlow = Math.exp(-(((x - 18.5) ** 2 + (y - 20) ** 2) / 46));
    const irisGlow = Math.exp(-(((x - 5.5) ** 2 + (y - 4) ** 2) / 60));
    base = mix(base, MINT, mintGlow * 0.16);
    base = mix(base, IRIS, irisGlow * 0.13);

    // Faint geometric grid.
    const gridLine =
      Math.min(Math.abs(((x * 2) % 4) - 0), Math.abs(((y * 2) % 4) - 0)) < 0.04 ? 0.05 : 0;
    base = mix(base, [255, 255, 255], gridLine);

    paint(pixel, base, plateAlpha);
    // Hairline rim for crispness on dark docks.
    const rim = Math.abs(plate) < 0.055 ? 0.28 : 0;
    paint(pixel, [200, 220, 235], (rim + plateAlpha * 0.04) * plateAlpha);
  }

  // ---- emblem ------------------------------------------------------------
  // The emblem is inset slightly so it breathes inside the plate at 32px.
  const S = 0.88;
  const ex = (value) => 12 + (value - 12) * S;
  const ey = (value) => 12.5 + (value - 12.5) * S;

  const visor = sdRoundRect(ex(x), ey(y), 12, ey(13.25), 9.25 * S, 6 * S, 4.25 * S);
  const visorStroke = coverage(Math.abs(visor) - 0.72 * S, 0.875 * S - 0.72 * S);
  paint(pixel, LIGHT, visorStroke * 0.97);

  // Sensor bar inside the visor.
  const eyeLeft = sdSegment(ex(x), ey(y), ex(6.9), ey(12.2), ex(9.95), ey(12.2));
  const eyeRight = sdSegment(ex(x), ey(y), ex(14.05), ey(12.2), ex(17.1), ey(12.2));
  paint(pixel, MINT, coverage(eyeLeft, 1.05 * S) * 0.98);
  paint(pixel, MINT, coverage(eyeRight, 1.05 * S) * 0.98);

  // Mouth slit.
  const mouth = sdSegment(ex(x), ey(y), ex(9), ey(15.9), ex(15), ey(15.9));
  paint(pixel, LIGHT, coverage(mouth, 0.42 * S) * 0.3);

  // Antenna and sensor node.
  const antenna = sdSegment(ex(x), ey(y), 12, ey(7.25), 12, ey(4.9));
  paint(pixel, LIGHT, coverage(antenna, 0.5 * S) * 0.85);
  const node = Math.hypot(ex(x) - 12, ey(y) - ey(3.4));
  paint(pixel, MINT, coverage(Math.abs(node - 1.05 * S), 0.02) * 1);
  // Soft bloom around the node.
  paint(pixel, MINT, Math.exp(-((node - 1.05 * S) ** 2) / (0.9 * S * S)) * 0.3);

  // Corner sensor pips.
  paint(pixel, MINT, coverage(Math.hypot(ex(x) - ex(5.2), ey(y) - ey(9.9)) - 0.62 * S, 0.02) * 0.9);
  paint(pixel, MINT, coverage(Math.hypot(ex(x) - ex(18.8), ey(y) - ey(9.9)) - 0.62 * S, 0.02) * 0.9);

  // ---- finish ------------------------------------------------------------
  // Crop everything outside the rounded plate.
  if (plate > 0) pixel[3] = 0;

  return pixel;
}

function render() {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);

  for (let py = 0; py < SIZE; py += 1) {
    for (let px = 0; px < SIZE; px += 1) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = (px + (sx + 0.5) / SS) / UNIT;
          const y = (py + (sy + 0.5) / SS) / UNIT;
          const sample = shade(x, y);
          acc[0] += sample[0];
          acc[1] += sample[1];
          acc[2] += sample[2];
          acc[3] += sample[3];
        }
      }
      const samples = SS * SS;
      const offset = (py * SIZE + px) * 4;
      rgba[offset] = Math.round(acc[0] / samples);
      rgba[offset + 1] = Math.round(acc[1] / samples);
      rgba[offset + 2] = Math.round(acc[2] / samples);
      rgba[offset + 3] = Math.round((acc[3] / samples) * 255);
    }
  }

  return rgba;
}

/* ------------------------------ PNG writer ------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const output = join(dirname(fileURLToPath(import.meta.url)), "..", "app-icon.png");
writeFileSync(output, encodePng(SIZE, SIZE, render()));
console.log(`Wrote ${output}`);
