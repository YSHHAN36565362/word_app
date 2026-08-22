// PWA 아이콘을 외부 이미지 라이브러리 없이 순수 Node(zlib)만으로 생성한다.
// 듀오링고풍 초록 배경 + 흰색 카드 모양의 심플한 아이콘.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { crc32 } from "node:zlib";

const OUT_DIR = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcInput = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcInput) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // 각 행 앞에 필터 타입 바이트(0) 추가
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgbaBuffer.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawIcon(size, { padding = 0, cardScale = 0.52 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = hexToRgb("#58cc02");
  const card = [255, 255, 255];
  const accent = hexToRgb("#46a302");

  const usable = size - padding * 2;
  const cardW = usable * cardScale;
  const cardH = cardW * 1.3;
  const cx = size / 2;
  const cy = size / 2;
  const cardLeft = cx - cardW / 2;
  const cardRight = cx + cardW / 2;
  const cardTop = cy - cardH / 2;
  const cardBottom = cy + cardH / 2;
  const radius = usable * 0.06;

  function setPixel(x, y, [r, g, b], a = 255) {
    const idx = (y * size + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }

  function roundedRectContains(px, py, left, top, right, bottom, r) {
    if (px < left || px > right || py < top || py > bottom) return false;
    const cornerCheck = (cxp, cyp) => (px - cxp) * (px - cxp) + (py - cyp) * (py - cyp) <= r * r;
    if (px < left + r && py < top + r) return cornerCheck(left + r, top + r);
    if (px > right - r && py < top + r) return cornerCheck(right - r, top + r);
    if (px < left + r && py > bottom - r) return cornerCheck(left + r, bottom - r);
    if (px > right - r && py > bottom - r) return cornerCheck(right - r, bottom - r);
    return true;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(x, y, bg, 255);
    }
  }

  // 흰 카드
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (roundedRectContains(x, y, cardLeft, cardTop, cardRight, cardBottom, radius)) {
        setPixel(x, y, card, 255);
      }
    }
  }

  // 카드 위 밑줄 두 개 (텍스트 라인을 상징)
  const lineHeight = cardH * 0.08;
  const line1Top = cardTop + cardH * 0.32;
  const line2Top = cardTop + cardH * 0.52;
  const lineLeft = cardLeft + cardW * 0.16;
  const line1Right = cardRight - cardW * 0.16;
  const line2Right = cardRight - cardW * 0.34;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (y >= line1Top && y <= line1Top + lineHeight && x >= lineLeft && x <= line1Right) {
        setPixel(x, y, accent, 255);
      }
      if (y >= line2Top && y <= line2Top + lineHeight && x >= lineLeft && x <= line2Right) {
        setPixel(x, y, accent, 255);
      }
    }
  }

  return buf;
}

function writeIcon(name, size, opts) {
  const buf = drawIcon(size, opts);
  const png = encodePNG(size, size, buf);
  writeFileSync(new URL(name, OUT_DIR), png);
  console.log(`wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}

writeIcon("icon-192.png", 192, {});
writeIcon("icon-512.png", 512, {});
writeIcon("icon-maskable-512.png", 512, { padding: 512 * 0.1, cardScale: 0.42 });
