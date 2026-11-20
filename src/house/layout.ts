// Solstice House: the numbers.
// Plan coordinates are metres. x runs east, z runs south (north is -z).
// The route enters from the south and walks north through the house.

export type FloorKind = 'gravel' | 'terrazzo' | 'oak' | 'stone' | 'deck' | 'oakDark';

export interface Room {
  id: string;
  no: string;
  name: string;
  outdoor: boolean;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  floor: FloorKind;
  line: string;
}

export interface Opening {
  /** Position along the wall axis (x for east-west walls, z for north-south walls). */
  at: number;
  w: number;
  /** Top of the opening above the floor. */
  h: number;
  sill?: number;
  glass?: boolean;
}

export interface Wall {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  h: number;
  openings?: Opening[];
}

export const WALL_H = 3.2;
export const COURT_H = 2.2;
export const PARAPET_H = 1.0;
export const WALL_T = 0.24;

export const HOUSE_CENTER = { x: 13, z: 8 };
export const HOUSE_SIZE = { w: 20, d: 26 };

export const rooms: Room[] = [
  { id: 'court', no: '01', name: 'Gate Court', outdoor: true, x0: 8, z0: 15, x1: 14, z1: 21, floor: 'gravel',
    line: 'A walled court of gravel and one olive tree. The house keeps its face hidden until the door opens.' },
  { id: 'hall', no: '02', name: 'Hall', outdoor: false, x0: 8, z0: 11, x1: 14, z1: 15, floor: 'terrazzo',
    line: 'A short, cool pause between outside and in. The floor is the first thing you notice.' },
  { id: 'living', no: '03', name: 'Living Room', outdoor: false, x0: 3, z0: 3, x1: 14, z1: 11, floor: 'oak',
    line: 'The longest room in the house. The west window keeps it quiet at noon and golden by evening.' },
  { id: 'kitchen', no: '04', name: 'Kitchen & Dining', outdoor: false, x0: 14, z0: 3, x1: 23, z1: 11, floor: 'stone',
    line: 'Green cabinetry, one long island, and a table laid for the middle of the day.' },
  { id: 'terrace', no: '05', name: 'Sun Terrace', outdoor: true, x0: 11, z0: -5, x1: 23, z1: 3, floor: 'deck',
    line: 'A pool as long as the afternoon. Every room in the house opens toward it.' },
  { id: 'bedroom', no: '06', name: 'Bedroom', outdoor: false, x0: 3, z0: -5, x1: 11, z1: 3, floor: 'oakDark',
    line: 'The last room to be lit. Sunset arrives through the west window and stays until you leave.' },
];

export const walls: Wall[] = [
  // West edge: bedroom + living room
  { x1: 3, z1: -5, x2: 3, z2: 11, h: WALL_H, openings: [
    { at: -1.5, w: 2.4, h: 2.3, sill: 0.9, glass: true },
    { at: 5, w: 2.6, h: 2.5, sill: 0.5, glass: true },
  ] },
  // North edge
  { x1: 3, z1: -5, x2: 11, z2: -5, h: WALL_H, openings: [{ at: 6.5, w: 1.6, h: 2.2, sill: 0.9, glass: true }] },
  { x1: 11, z1: -5, x2: 23, z2: -5, h: PARAPET_H },
  // East edge
  { x1: 23, z1: -5, x2: 23, z2: 3, h: PARAPET_H },
  { x1: 23, z1: 3, x2: 23, z2: 11, h: WALL_H, openings: [{ at: 5, w: 2.4, h: 2.1, sill: 0.9, glass: true }] },
  // South edge of the main block
  { x1: 3, z1: 11, x2: 23, z2: 11, h: WALL_H, openings: [{ at: 11, w: 2, h: 2.4 }] },
  // Wall between living/kitchen and terrace/bedroom
  { x1: 3, z1: 3, x2: 23, z2: 3, h: WALL_H, openings: [
    { at: 6, w: 1.2, h: 2.4 },
    { at: 12.5, w: 3.2, h: 2.6, glass: true },
    { at: 18, w: 4.6, h: 2.6, glass: true },
  ] },
  // Bedroom to terrace
  { x1: 11, z1: -5, x2: 11, z2: 3, h: WALL_H, openings: [{ at: -2, w: 2, h: 2.4 }] },
  // Living to kitchen
  { x1: 14, z1: 3, x2: 14, z2: 15, h: WALL_H, openings: [{ at: 7, w: 2.6, h: 2.4 }] },
  // Hall west wall and court
  { x1: 8, z1: 11, x2: 8, z2: 15, h: WALL_H },
  { x1: 8, z1: 15, x2: 8, z2: 21, h: COURT_H },
  { x1: 14, z1: 15, x2: 14, z2: 21, h: COURT_H },
  // Front door and gate
  { x1: 8, z1: 15, x2: 14, z2: 15, h: WALL_H, openings: [{ at: 11, w: 1.4, h: 2.4 }] },
  { x1: 8, z1: 21, x2: 14, z2: 21, h: COURT_H, openings: [{ at: 11, w: 2.4, h: COURT_H }] },
];

/** Openings in the ceilings. The living room's lets a pool of sun onto the rug; the Hall's is a narrow slot
 * along its east side, so a stripe of sun crosses the floor and the mirror wall as the day turns. */
export const skylights = [
  { room: 'living', x0: 7.2, z0: 4.6, x1: 10.2, z1: 6.4 },
  { room: 'hall', x0: 12.5, z0: 11.5, x1: 13.3, z1: 14.5 },
];

export const pool = { x0: 15, z0: -4.5, x1: 21, z1: -2.5, depth: 1.3 };

/** Camera positions along the walk. Eye height is added in the runtime. */
export const walkPositions: Array<[number, number]> = [
  // Through the Hall in four steps so it reads as a pause, not a corridor.
  [11, 27], [11, 23.5], [11, 20], [11, 17], [11, 14.4], [11, 13.6], [11, 12.7], [11, 11.9], [11, 9.5], [11.5, 8], [12.8, 7], [15, 7], [17.5, 6],
  [18, 4], [18, 2], [17, 0], [14, -1.5], [12.5, -2], [10, -2], [7, -2],
];

/** What the camera looks at for each position: [x, y, z]. */
export const walkTargets: Array<[number, number, number]> = [
  // In the Hall: face the pictures and the pendant, glance left at the bench, right at the mirror, then go through.
  [11, 1.7, 17], [11, 1.7, 14], [11, 1.7, 12], [11, 1.6, 10], [11, 1.75, 11], [8.3, 1.15, 12.9], [13.7, 1.4, 12.9], [11, 1.6, 7], [7.5, 1.1, 4.5], [5.5, 1.1, 5.5], [16.5, 1.4, 6.8],
  [21, 1.2, 6.5], [21, 1.1, 8.5], [18, 1.5, -1], [18, 1.2, -3.5], [17, 0.9, -3.5], [13, 1.2, -3.5],
  [9, 1.4, -2], [6, 1.3, -2], [4, 1, -1],
];

export const EYE_HEIGHT = 1.62;

/** Start and end of the day in decimal hours. */
export const DAY_START = 7;
export const DAY_END = 19.5;

export const plotTrees: Array<[number, number, number]> = [
  [0.5, 14, 1.0], [-0.5, 2, 1.2], [0.5, -7, 0.9], [26.5, 14, 1.1], [27.5, 2, 1.3], [27, -7, 1.0], [4, 24, 1.0], [19, 19.5, 0.9], [3, 18.5, 0.8],
];

/** Overall dimension lines drawn on the plan sheet, with where their labels sit. */
export const dimensions = [
  { text: '20.0 m', a: [3, -6.4], b: [23, -6.4], label: [13, -7.2] },
  { text: '26.0 m', a: [1.2, -5], b: [1.2, 21], label: [0.2, 8] },
] as const;

/** Facts shown in the room file. */
export const roomFacts: Record<string, { faces: string; materials: string[] }> = {
  court: { faces: 'South, to the street', materials: ['Pale gravel', 'Rendered walls', 'Stepping stones', 'Olive tree'] },
  hall: { faces: 'South, to the gate; slot skylight', materials: ['Terrazzo floor', 'White plaster', 'Walnut and brass', 'Painted bench'] },
  living: { faces: 'West window, north glass door, skylight', materials: ['Oak boards', 'White plaster', 'Black leather', 'Linen rug'] },
  kitchen: { faces: 'East window, north glass doors', materials: ['Stone tile', 'Green cabinetry', 'Timber table', 'Tiled splashback'] },
  terrace: { faces: 'Open to the sky, north and east', materials: ['Grey timber deck', 'Pool tile', 'Planters'] },
  bedroom: { faces: 'West window, north window', materials: ['Dark oak boards', 'Linen bedding', 'Walnut'] },
};

/** East-to-west heading of the sun at a given hour, in plan (x east, z south). */
export function sunAzimuth(hour: number) {
  const phi = (Math.PI * (hour - 6)) / 14;
  const s = Math.max(0, Math.sin(phi));
  return Math.atan2(0.5 * s + 0.1, Math.cos(phi));
}

/** The sun's path drawn on the plan sheet: an arc round the house with hour marks. */
export const SUN_RADIUS = 13.5;
const onArc = (hour: number): [number, number] => {
  const a = sunAzimuth(hour);
  return [HOUSE_CENTER.x + SUN_RADIUS * Math.cos(a), HOUSE_CENTER.z + SUN_RADIUS * Math.sin(a)];
};
export const sunArc: Array<[number, number]> = Array.from({ length: 41 }, (_, i) => onArc(6.6 + (i / 40) * 13.2));
export const sunMarks = [7, 9, 11, 13, 15, 17, 19].map((hour) => {
  const [x, z] = onArc(hour);
  return { hour, text: `${String(hour).padStart(2, '0')}:00`, x, z };
});
