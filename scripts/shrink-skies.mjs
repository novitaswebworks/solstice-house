// Halves Radiance .hdr skies for phones (1024x512 -> 512x256), averaging 2x2
// blocks in linear light. No dependencies: reads and writes run-length encoded RGBE.
//   node scripts/shrink-skies.mjs public/assets/sky/kiara_2_sunrise_1k.hdr ...
import { readFileSync, writeFileSync } from 'node:fs';

function readHdr(path) {
  const buf = readFileSync(path);
  let pos = 0;
  const line = () => { const end = buf.indexOf(10, pos); const s = buf.toString('latin1', pos, end); pos = end + 1; return s; };
  if (!line().startsWith('#?')) throw new Error(`${path}: not a Radiance file`);
  let l;
  while ((l = line()) !== '') if (l.startsWith('FORMAT=') && l !== 'FORMAT=32-bit_rle_rgbe') throw new Error(`${path}: unsupported ${l}`);
  const m = /^-Y (\d+) \+X (\d+)$/.exec(line());
  if (!m) throw new Error(`${path}: unsupported orientation`);
  const h = Number(m[1]), w = Number(m[2]);
  const rgbe = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = rgbe.subarray(y * w * 4, (y + 1) * w * 4);
    if (buf[pos] === 2 && buf[pos + 1] === 2 && ((buf[pos + 2] << 8) | buf[pos + 3]) === w) {
      pos += 4; // new-style RLE: each channel separately
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < w;) {
          let n = buf[pos++];
          if (n > 128) { n -= 128; const v = buf[pos++]; while (n--) row[(x++) * 4 + c] = v; }
          else while (n--) row[(x++) * 4 + c] = buf[pos++];
        }
      }
    } else { row.set(buf.subarray(pos, pos + w * 4)); pos += w * 4; }
  }
  return { w, h, rgbe };
}

const toFloat = (p, i) => (p[i + 3] ? 2 ** (p[i + 3] - 136) : 0);
function encode(r, g, b, out, o) {
  const v = Math.max(r, g, b);
  if (v < 1e-32) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; return; }
  const e = Math.ceil(Math.log2(v + 1e-38));
  let s = 256 / 2 ** e;
  if (v * s >= 256) s /= 2; // guard rounding at exact powers of two
  out[o] = r * s; out[o + 1] = g * s; out[o + 2] = b * s; out[o + 3] = e + 128 + (v * s >= 256 ? 1 : 0);
}

// Radiance "new" RLE: per scanline, each channel as runs (128+n, value) or literals (n, bytes).
function encodeRle(w, h, rgbe) {
  const parts = [];
  for (let y = 0; y < h; y++) {
    const bytes = [2, 2, w >> 8, w & 255];
    for (let c = 0; c < 4; c++) {
      const ch = (x) => rgbe[(y * w + x) * 4 + c];
      let x = 0;
      while (x < w) {
        let run = 1;
        while (x + run < w && run < 127 && ch(x + run) === ch(x)) run++;
        if (run >= 3) { bytes.push(128 + run, ch(x)); x += run; continue; }
        const start = x;
        // A literal stretch ends where a run of 3+ begins.
        while (x < w && x - start < 128 && !(x + 2 < w && ch(x) === ch(x + 1) && ch(x) === ch(x + 2))) x++;
        bytes.push(x - start);
        for (let i = start; i < x; i++) bytes.push(ch(i));
      }
    }
    parts.push(Uint8Array.from(bytes));
  }
  return Buffer.concat(parts);
}

for (const src of process.argv.slice(2)) {
  const { w, h, rgbe } = readHdr(src);
  const W = w / 2, H = h / 2, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = ((2 * y + dy) * w + 2 * x + dx) * 4, f = toFloat(rgbe, i);
      r += (rgbe[i] + 0.5) * f; g += (rgbe[i + 1] + 0.5) * f; b += (rgbe[i + 2] + 0.5) * f;
    }
    encode(r / 4, g / 4, b / 4, out, (y * W + x) * 4);
  }
  const dst = src.replace(/_1k\.hdr$/, '_512.hdr');
  if (dst === src) throw new Error(`${src}: expected a *_1k.hdr name`);
  writeFileSync(dst, Buffer.concat([Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'latin1'), encodeRle(W, H, out)]));
  // Self-check: the written file must decode back to exactly these pixels.
  const back = readHdr(dst).rgbe;
  if (back.length !== out.length || back.some((v, i) => v !== out[i])) throw new Error(`${dst}: RLE round-trip mismatch`);
  // Self-check: total light must survive the downsample (within 2%).
  const sum = (p, n) => { let t = 0; for (let i = 0; i < n * 4; i += 4) t += (p[i] + p[i + 1] + p[i + 2] + 1.5) * toFloat(p, i); return t; };
  const ratio = (sum(out, W * H) * 4) / sum(rgbe, w * h);
  if (Math.abs(ratio - 1) > 0.02) throw new Error(`${dst}: energy drifted by ${((ratio - 1) * 100).toFixed(1)}%`);
  console.log(`${dst}  ${W}x${H}  energy ${(ratio * 100).toFixed(2)}%`);
}
