// The downloadable drawing: an A3 sheet in millimetres with the ground plan at 1:100
// (1 m = 10 mm), so printing at 100% gives a drawing you can measure with a scale rule.
import { rooms, dimensions } from './layout';
import { wallSolids, windowSegs, doorSegs, dimensionSegs, planBounds, type Seg } from './planGeometry';
import type { RoomSun } from './runtime';

const SHEET = { w: 297, h: 420 };
const MM_PER_M = 10;
const FRAME = 10;
const TITLE_H = 78;
const PAPER = '#f3ece0';
const INK = '#2a2623';
const SOFT = '#6b625b';
const ACCENT = '#a8471f';
const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
const SANS = "'Instrument Sans', Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v: number) => Number(v.toFixed(2));

export function planSheetSvg(sun: RoomSun[] | null, date = new Date().toISOString().slice(0, 10)) {
  const b = planBounds();
  const drawW = SHEET.w - 2 * FRAME;
  const drawH = SHEET.h - 2 * FRAME - TITLE_H;
  const planW = (b.x1 - b.x0) * MM_PER_M;
  const planH = (b.z1 - b.z0) * MM_PER_M;
  // Fixed scale: if the plan grows past the sheet, fail loudly rather than print at a false 1:100.
  if (planW > drawW - 8 || planH > drawH - 8) throw new Error(`Plan ${planW}x${planH} mm does not fit the A3 drawing area at 1:100`);
  const ox = FRAME + (drawW - planW) / 2;
  const oy = FRAME + (drawH - planH) / 2;
  const X = (x: number) => n(ox + (x - b.x0) * MM_PER_M);
  const Y = (z: number) => n(oy + (z - b.z0) * MM_PER_M);
  const lines = (segs: Seg[], stroke: string, width: number, extra = '') =>
    `<path d="${segs.map(([x1, z1, x2, z2]) => `M${X(x1)} ${Y(z1)}L${X(x2)} ${Y(z2)}`).join('')}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
  const text = (x: number, y: number, body: string, size: number, opts: { font?: string; fill?: string; anchor?: string; weight?: number; spacing?: number } = {}) =>
    `<text x="${n(x)}" y="${n(y)}" font-family="${opts.font ?? SANS}" font-size="${size}" fill="${opts.fill ?? INK}" text-anchor="${opts.anchor ?? 'middle'}"${opts.weight ? ` font-weight="${opts.weight}"` : ''}${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ''}>${esc(body)}</text>`;
  const area = (r: (typeof rooms)[number]) => (r.x1 - r.x0) * (r.z1 - r.z0);
  const total = rooms.reduce((s, r) => s + area(r), 0);

  const parts: string[] = [];
  parts.push(`<rect width="${SHEET.w}" height="${SHEET.h}" fill="${PAPER}"/>`);
  parts.push(`<rect x="${FRAME}" y="${FRAME}" width="${drawW}" height="${SHEET.h - 2 * FRAME}" fill="none" stroke="${INK}" stroke-width="0.5"/>`);

  // Rooms: a pale wash for the outdoor ones, labels at the centre.
  for (const r of rooms) {
    if (r.outdoor) parts.push(`<rect x="${X(r.x0)}" y="${Y(r.z0)}" width="${n((r.x1 - r.x0) * MM_PER_M)}" height="${n((r.z1 - r.z0) * MM_PER_M)}" fill="#e7dfd1"/>`);
  }
  parts.push(lines(dimensionSegs(), INK, 0.15));
  parts.push(lines(doorSegs(), INK, 0.15));
  parts.push(lines(windowSegs(), INK, 0.13));
  parts.push(`<g fill="${INK}">${wallSolids().map((w) => `<rect x="${X(w.x0)}" y="${Y(w.z0)}" width="${n((w.x1 - w.x0) * MM_PER_M)}" height="${n((w.z1 - w.z0) * MM_PER_M)}"/>`).join('')}</g>`);

  rooms.forEach((r, i) => {
    const cx = X((r.x0 + r.x1) / 2);
    const cy = Y((r.z0 + r.z1) / 2);
    const hours = sun?.[i] ? ` · ${sun[i].hours.toFixed(1)} h sun` : '';
    parts.push(text(cx, cy - 4, r.no, 2.6, { fill: ACCENT, weight: 600, spacing: 0.4 }));
    parts.push(text(cx, cy + 0.5, r.name, 4.2, { font: SERIF }));
    parts.push(text(cx, cy + 4.6, `${r.x1 - r.x0} × ${r.z1 - r.z0} m · ${area(r)} m²${hours}`, 2.4, { fill: SOFT }));
  });
  for (const d of dimensions) {
    const vertical = d.a[0] === d.b[0];
    const [lx, lz] = d.label;
    parts.push(vertical
      ? `<text transform="translate(${X(lx)} ${Y(lz)}) rotate(-90)" font-family="${SANS}" font-size="3" fill="${INK}" text-anchor="middle">${esc(d.text)}</text>`
      : text(X(lx), Y(lz), d.text, 3));
  }

  // Title strip.
  const ty = SHEET.h - FRAME - TITLE_H;
  parts.push(`<line x1="${FRAME}" y1="${ty}" x2="${SHEET.w - FRAME}" y2="${ty}" stroke="${INK}" stroke-width="0.5"/>`);
  parts.push(text(FRAME + 8, ty + 14, 'Solstice House', 9, { font: SERIF, anchor: 'start' }));
  parts.push(text(FRAME + 8, ty + 21, 'GROUND FLOOR PLAN', 2.8, { anchor: 'start', weight: 600, spacing: 0.5, fill: ACCENT }));
  [['Scale', '1 : 100 at A3'], ['Area', `${total} m² (rooms)`], ['Date', date], ['Note', 'Presentation drawing. Not for construction.']].forEach(([k, v], i) => {
    parts.push(text(FRAME + 8, ty + 31 + i * 6, k.toUpperCase(), 2.2, { anchor: 'start', weight: 600, spacing: 0.4, fill: SOFT }));
    parts.push(text(FRAME + 24, ty + 31 + i * 6, v, 2.8, { anchor: 'start' }));
  });
  // North arrow and a 0-1-2-5 m scale bar (exactly 50 mm long at 1:100).
  const nx = FRAME + 98;
  const ny = ty + 18;
  parts.push(`<circle cx="${nx}" cy="${ny}" r="6" fill="none" stroke="${INK}" stroke-width="0.3"/><path d="M${nx} ${ny - 8}L${nx + 2.6} ${ny + 3}L${nx} ${ny + 1.4}L${nx - 2.6} ${ny + 3}Z" fill="${INK}"/>`);
  parts.push(text(nx, ny + 11, 'N', 3, { weight: 600 }));
  const sx = FRAME + 80;
  const sy = ty + 52;
  parts.push(`<rect x="${sx}" y="${sy}" width="${5 * MM_PER_M}" height="2" fill="none" stroke="${INK}" stroke-width="0.25"/>`);
  parts.push(`<rect x="${sx}" y="${sy}" width="${MM_PER_M}" height="2" fill="${INK}"/><rect x="${sx + 2 * MM_PER_M}" y="${sy}" width="${3 * MM_PER_M}" height="2" fill="${INK}"/>`);
  [0, 1, 2, 5].forEach((m) => parts.push(text(sx + m * MM_PER_M, sy + 6, m === 5 ? '5 m' : String(m), 2.4, { fill: SOFT })));

  // Room schedule.
  const tx = FRAME + 148;
  const cols = [0, 8, 52, 70, 86, 112];
  ['No', 'Room', 'Size', 'Area', 'Direct sun'].forEach((h, i) => parts.push(text(tx + cols[i], ty + 12, h.toUpperCase(), 2.2, { anchor: 'start', weight: 600, spacing: 0.4, fill: SOFT })));
  rooms.forEach((r, i) => {
    const y = ty + 20 + i * 7.5;
    parts.push(`<line x1="${tx}" y1="${n(y - 4.8)}" x2="${SHEET.w - FRAME - 6}" y2="${n(y - 4.8)}" stroke="${INK}" stroke-opacity="0.2" stroke-width="0.2"/>`);
    [r.no, r.name, `${r.x1 - r.x0} × ${r.z1 - r.z0} m`, `${area(r)} m²`, sun?.[i] ? `${sun[i].hours.toFixed(1)} h` : '—'].forEach((v, c) =>
      parts.push(text(tx + cols[c], y, v, c === 1 ? 3.2 : 2.8, { anchor: 'start', font: c === 1 ? SERIF : SANS, fill: c === 0 ? ACCENT : INK })));
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}">
<title>Solstice House · Ground floor plan · 1:100 at A3</title>
${parts.join('\n')}
</svg>
`;
}
