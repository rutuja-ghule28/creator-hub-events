import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk("IHDR", ihdrData);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0; // filter: None
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(scanlines, { level: 9 });
  const idat = makeChunk("IDAT", idatData);

  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Math helpers for smooth anti-aliasing
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// Brand Gradient Stops: Indigo -> Purple -> Magenta -> Coral
function getBrandGradient(t) {
  const c0 = [79, 70, 229]; // #4F46E5
  const c1 = [124, 58, 237]; // #7C3AED
  const c2 = [236, 72, 153]; // #EC4899
  const c3 = [249, 115, 22]; // #F97316

  if (t < 0.35) {
    return mix(c0, c1, t / 0.35);
  } else if (t < 0.7) {
    return mix(c1, c2, (t - 0.35) / 0.35);
  } else {
    return mix(c2, c3, (t - 0.7) / 0.3);
  }
}

// Render Creator Connect Icon RGBA
function renderIcon(size, roundedBg = true) {
  const buf = Buffer.alloc(size * size * 4);
  const aa = 1.0 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = (x + 0.5) / size; // 0 to 1
      const ny = (y + 0.5) / size;

      let r = 0,
        g = 0,
        b = 0,
        a = 0;

      // Background rounded container if requested
      if (roundedBg) {
        // Rounded box SDF
        const cx = Math.abs(nx - 0.5) - (0.5 - 0.22);
        const cy = Math.abs(ny - 0.5) - (0.5 - 0.22);
        const dCorner = Math.sqrt(Math.max(0, cx) ** 2 + Math.max(0, cy) ** 2) - 0.22;
        const dBox = Math.max(cx, cy) > 0 ? dCorner : Math.max(cx, cy) - 0.22;
        const bgAlpha = smoothstep(aa, -aa, dBox);

        if (bgAlpha > 0) {
          r = 15;
          g = 23;
          b = 42; // #0F172A
          a = Math.round(bgAlpha * 255);
        }
      }

      // Foreground Icon Geometry
      // Center (0.5, 0.5)
      const gradT = clamp((nx + ny) / 2, 0, 1);
      const brandColor = getBrandGradient(gradT);

      // Arc 'C' curve centered near (0.5, 0.5)
      // Radius ~0.33, center at (0.52, 0.5)
      const dxArc = nx - 0.52;
      const dyArc = ny - 0.5;
      const dDist = Math.sqrt(dxArc * dxArc + dyArc * dyArc);
      const angle = Math.atan2(dyArc, dxArc); // -PI to PI. Right is 0, Top is -PI/2, Left is PI/-PI, Bottom is PI/2

      // 'C' is present for angle between roughly -0.85*PI to 0.85*PI (left side)
      const dArcRadius = Math.abs(dDist - 0.31);
      const arcThickness = 0.065;
      const isLeft = nx < 0.68;
      let arcAlpha = smoothstep(arcThickness + aa, arcThickness - aa, dArcRadius);
      if (!isLeft) {
        const dCut = nx - 0.68;
        arcAlpha *= smoothstep(aa, -aa, dCut);
      }

      // Top Node: center (0.70, 0.25), radius 0.10
      const dTop = Math.sqrt((nx - 0.7) ** 2 + (ny - 0.25) ** 2);
      const topNodeAlpha = smoothstep(0.1 + aa, 0.1 - aa, dTop);
      const topHoleAlpha = smoothstep(0.045 + aa, 0.045 - aa, dTop);

      // Bottom Node: center (0.70, 0.75), radius 0.10
      const dBot = Math.sqrt((nx - 0.7) ** 2 + (ny - 0.75) ** 2);
      const botNodeAlpha = smoothstep(0.1 + aa, 0.1 - aa, dBot);
      const botHoleAlpha = smoothstep(0.045 + aa, 0.045 - aa, dBot);

      // Spark Star at (0.49, 0.50): 4-point star SDF
      const sx = Math.abs(nx - 0.49);
      const sy = Math.abs(ny - 0.5);
      const dSpark = sx + sy + Math.max(sx, sy) * 0.8 - 0.07;
      const sparkAlpha = smoothstep(aa, -aa, dSpark);

      // Composite foreground onto background
      // First combine node and arc
      let fgAlpha = Math.max(arcAlpha, topNodeAlpha, botNodeAlpha);
      let fgColor = brandColor;

      // Inner white holes for nodes
      if (topHoleAlpha > 0) {
        fgColor = mix(fgColor, [255, 255, 255], topHoleAlpha);
      }
      if (botHoleAlpha > 0) {
        fgColor = mix(fgColor, [255, 255, 255], botHoleAlpha);
      }

      // Spark star in gold/white
      if (sparkAlpha > 0) {
        fgAlpha = Math.max(fgAlpha, sparkAlpha);
        fgColor = mix(fgColor, [254, 240, 138], sparkAlpha);
      }

      if (fgAlpha > 0) {
        const srcA = fgAlpha;
        const dstA = a / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA > 0) {
          r = Math.round((fgColor[0] * srcA + r * dstA * (1 - srcA)) / outA);
          g = Math.round((fgColor[1] * srcA + g * dstA * (1 - srcA)) / outA);
          b = Math.round((fgColor[2] * srcA + b * dstA * (1 - srcA)) / outA);
          a = Math.round(outA * 255);
        }
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }

  return buf;
}

// Generate ICO file containing 16x16 and 32x32 PNGs
function makeIco(png16, png32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(2, 4); // 2 images

  const entry1 = Buffer.alloc(16);
  entry1[0] = 16; // width
  entry1[1] = 16; // height
  entry1[2] = 0; // palette count
  entry1[3] = 0; // reserved
  entry1.writeUInt16LE(1, 4); // color planes
  entry1.writeUInt16LE(32, 6); // bits per pixel
  entry1.writeUInt32LE(png16.length, 8); // size
  entry1.writeUInt32LE(6 + 32, 12); // offset

  const entry2 = Buffer.alloc(16);
  entry2[0] = 32;
  entry2[1] = 32;
  entry2[2] = 0;
  entry2[3] = 0;
  entry2.writeUInt16LE(1, 4);
  entry2.writeUInt16LE(32, 6);
  entry2.writeUInt32LE(png32.length, 8);
  entry2.writeUInt32LE(6 + 32 + png16.length, 12);

  return Buffer.concat([header, entry1, entry2, png16, png32]);
}

// Render Social OG Card 1200x630
function renderOgImage(width = 1200, height = 630) {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const nx = x / width;
      const ny = y / height;

      // Dark futuristic gradient background
      let r = Math.round(9 + (30 - 9) * nx * ny);
      let g = Math.round(13 + (16 - 13) * ny);
      let b = Math.round(22 + (53 - 22) * (nx * 0.5 + ny * 0.5));

      // Ambient radial glow 1 (top-left violet)
      const dGlow1 = Math.sqrt((x - 220) ** 2 + (y - 180) ** 2);
      if (dGlow1 < 360) {
        const glow = Math.cos((dGlow1 / 360) * (Math.PI / 2)) ** 2 * 0.28;
        r = Math.min(255, Math.round(r + 139 * glow));
        g = Math.min(255, Math.round(g + 92 * glow));
        b = Math.min(255, Math.round(b + 246 * glow));
      }

      // Ambient radial glow 2 (bottom-right magenta/coral)
      const dGlow2 = Math.sqrt((x - 1000) ** 2 + (y - 480) ** 2);
      if (dGlow2 < 420) {
        const glow2 = Math.cos((dGlow2 / 420) * (Math.PI / 2)) ** 2 * 0.22;
        r = Math.min(255, Math.round(r + 236 * glow2));
        g = Math.min(255, Math.round(g + 72 * glow2));
        b = Math.min(255, Math.round(b + 153 * glow2));
      }

      // Subtle card border
      if (x >= 24 && x <= width - 24 && y >= 24 && y <= height - 24) {
        if (x === 24 || x === width - 24 || y === 24 || y === height - 24) {
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 50);
          b = Math.min(255, b + 70);
        }
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }

  // Draw icon stamp on OG card at (100, 100) size 110x110
  const iconSize = 110;
  const iconBuf = renderIcon(iconSize, true);
  const startX = 100;
  const startY = 100;

  for (let iy = 0; iy < iconSize; iy++) {
    for (let ix = 0; ix < iconSize; ix++) {
      const srcIdx = (iy * iconSize + ix) * 4;
      const dstIdx = ((startY + iy) * width + (startX + ix)) * 4;
      const alpha = iconBuf[srcIdx + 3] / 255;

      if (alpha > 0) {
        buf[dstIdx] = Math.round(iconBuf[srcIdx] * alpha + buf[dstIdx] * (1 - alpha));
        buf[dstIdx + 1] = Math.round(iconBuf[srcIdx + 1] * alpha + buf[dstIdx + 1] * (1 - alpha));
        buf[dstIdx + 2] = Math.round(iconBuf[srcIdx + 2] * alpha + buf[dstIdx + 2] * (1 - alpha));
      }
    }
  }

  return buf;
}

// Write all assets to public directory
const publicDir = path.resolve("./public");
const assetsDir = path.join(publicDir, "assets");

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log("Generating icon set...");

// 16x16
const rgba16 = renderIcon(16);
const png16 = encodePNG(16, 16, rgba16);
fs.writeFileSync(path.join(publicDir, "favicon-16x16.png"), png16);

// 32x32
const rgba32 = renderIcon(32);
const png32 = encodePNG(32, 32, rgba32);
fs.writeFileSync(path.join(publicDir, "favicon-32x32.png"), png32);

// Favicon.ico
const ico = makeIco(png16, png32);
fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);

// 180x180 (Apple touch icon)
const rgba180 = renderIcon(180);
const png180 = encodePNG(180, 180, rgba180);
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), png180);

// 192x192 (Android chrome)
const rgba192 = renderIcon(192);
const png192 = encodePNG(192, 192, rgba192);
fs.writeFileSync(path.join(publicDir, "android-chrome-192x192.png"), png192);

// 512x512 (Android chrome large)
const rgba512 = renderIcon(512);
const png512 = encodePNG(512, 512, rgba512);
fs.writeFileSync(path.join(publicDir, "android-chrome-512x512.png"), png512);

// OG Image PNG (1200x630)
console.log("Generating og-image.png...");
const rgbaOg = renderOgImage(1200, 630);
const pngOg = encodePNG(1200, 630, rgbaOg);
fs.writeFileSync(path.join(assetsDir, "og-image.png"), pngOg);

console.log("All icons successfully generated!");
