import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Minimal PNG encoder ──────────────────────────────────────────────────────

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = u32be(data.length);
  const crc = crc32(Buffer.concat([t, data]));
  return Buffer.concat([len, t, data, u32be(crc)]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePNG(pixels, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build raw scanlines with filter byte 0 (None) per row
  const scanlines = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    scanlines[row] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const px = pixels[y * size + x];
      scanlines[row + 1 + x * 3] = (px >> 16) & 0xff;
      scanlines[row + 2 + x * 3] = (px >> 8) & 0xff;
      scanlines[row + 3 + x * 3] = px & 0xff;
    }
  }

  const compressed = deflateSync(scanlines);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Draw icons ───────────────────────────────────────────────────────────────

const BG = 0x111111;
const ORANGE = 0xf97316;
const TEXT_COLOR = 0x111111;

function drawIcon(size) {
  const pixels = new Uint32Array(size * size).fill(BG);

  // Orange rounded square (approximate rounding by skipping corners)
  const margin = Math.round(size * 0.15);
  const end = size - margin;
  const r = Math.round(size * 0.08); // corner radius

  for (let y = margin; y < end; y++) {
    for (let x = margin; x < end; x++) {
      // Rough corner rounding
      const dx = Math.min(x - margin, end - 1 - x);
      const dy = Math.min(y - margin, end - 1 - y);
      if (dx < r && dy < r && dx * dx + dy * dy > r * r) continue;
      pixels[y * size + x] = ORANGE;
    }
  }

  // Draw "T" letter (pixel-art style, scaled)
  const center = size / 2;
  const fh = size * 0.45; // font height
  const fw = size * 0.32; // font width
  const barH = fh * 0.18;

  // Horizontal bar
  for (let y = Math.round(center - fh / 2); y < Math.round(center - fh / 2 + barH); y++) {
    for (let x = Math.round(center - fw / 2); x < Math.round(center + fw / 2); x++) {
      if (y >= 0 && y < size && x >= 0 && x < size) pixels[y * size + x] = TEXT_COLOR;
    }
  }

  // Vertical stem
  const stemW = fw * 0.28;
  for (let y = Math.round(center - fh / 2); y < Math.round(center + fh / 2); y++) {
    for (let x = Math.round(center - stemW / 2); x < Math.round(center + stemW / 2); x++) {
      if (y >= 0 && y < size && x >= 0 && x < size) pixels[y * size + x] = TEXT_COLOR;
    }
  }

  return pixels;
}

for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = makePNG(Array.from(pixels), size);
  const out = join(__dir, `icon${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ icon${size}.png`);
}
console.log("Icons generated.");
