/**
 * Generates the PWA icons. No image library and no network: the icons are
 * drawn as raw pixels and encoded here, so the repo stays self-contained.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VOID: [number, number, number] = [0x0a, 0x07, 0x05];
const PHOSPHOR: [number, number, number] = [0xff, 0xb0, 0x00];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A bulkhead frame with the threat block inside it. No illustration. */
function draw(size: number, inset: number) {
  return (x: number, y: number): [number, number, number] => {
    const u = x / size;
    const v = y / size;
    const lo = inset;
    const hi = 1 - inset;
    const border = 0.055;
    const onFrame =
      u >= lo && u <= hi && v >= lo && v <= hi &&
      (u <= lo + border || u >= hi - border || v <= lo + border || v >= hi - border);
    const blockLo = 0.5 - (0.5 - lo) * 0.42;
    const blockHi = 1 - blockLo;
    const onBlock = u >= blockLo && u <= blockHi && v >= blockLo && v <= blockHi;
    return onFrame || onBlock ? PHOSPHOR : VOID;
  };
}

const out = join('public');
writeFileSync(join(out, 'icon-192.png'), png(192, draw(192, 0.14)));
writeFileSync(join(out, 'icon-512.png'), png(512, draw(512, 0.14)));
writeFileSync(join(out, 'icon-maskable.png'), png(512, draw(512, 0.24)));
console.log('wrote icon-192.png, icon-512.png, icon-maskable.png');
