/**
 * Pure geometry for the seating floorplans (shared by the server's deterministic builder and the web UI).
 *
 * Coordinates are in pixels of an 800 x 520 room. `toPercent` converts to the 5..95 % space stored in SeatNode.
 * Conventions (matching the knowledge base): the host faces the entrance, the door is at the bottom, and the
 * chief guest sits on the host's RIGHT. A host facing the bottom of the screen has his right hand on the
 * screen-LEFT, so the chief guest always appears to the left of the host in the plan.
 */

export const ROOM = { w: 800, h: 520 } as const;

export type LayoutKind = 'round' | 'rect' | 'u_shape' | 'theatre' | 'majlis';

export interface SeatSpot {
  rank: number;
  /** Pixel position of the chair centre. */
  x: number;
  y: number;
  /** Direction the person faces, in degrees (0 = east, 90 = south, 180 = west, 270 = north). */
  facing: number;
  side?: 'host' | 'guest';
}

export type Furniture =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rrect'; x: number; y: number; w: number; h: number; r: number; tone?: 'table' | 'rug' | 'stage' | 'sofa' | 'low' }
  | { kind: 'podium'; x: number; y: number }
  | { kind: 'brazier'; x: number; y: number }
  | { kind: 'coffee'; x: number; y: number };

export interface Plan {
  layout: LayoutKind;
  seats: SeatSpot[];
  furniture: Furniture[];
  door: { x: number; y: number; w: number };
  /** Short caption keys the renderer maps to localized text. */
  caption: 'round' | 'rect' | 'u_shape' | 'theatre' | 'majlis';
}

export const MIN_SEATS = 4;
export const MAX_SEATS: Record<LayoutKind, number> = { round: 14, rect: 14, u_shape: 13, theatre: 14, majlis: 14 };

const DOOR = { x: ROOM.w / 2, y: ROOM.h, w: 120 };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Slots ordered centre-out, alternating: first to the screen-left (the host's right), then the screen-right. */
function centreOut(count: number, leftFirst = true): number[] {
  const out = [0];
  for (let k = 1; out.length < count; k++) {
    out.push(leftFirst ? -k : k);
    if (out.length < count) out.push(leftFirst ? k : -k);
  }
  return out.slice(0, count);
}

function clampCount(layout: LayoutKind, count: number): number {
  return Math.max(MIN_SEATS, Math.min(MAX_SEATS[layout], Math.round(count)));
}

function planRound(n: number): Plan {
  const cx = 400;
  const cy = 255;
  const ring = 152;
  const step = 360 / n;
  const offsets = centreOut(n).map((slot) => slot * step);
  const seats: SeatSpot[] = offsets.map((off, i) => {
    const deg = -90 + off;
    const rad = (deg * Math.PI) / 180;
    return {
      rank: i + 1,
      x: round2(cx + ring * Math.cos(rad)),
      y: round2(cy + ring * Math.sin(rad)),
      facing: round2(deg + 180),
    };
  });
  return {
    layout: 'round',
    seats,
    furniture: [{ kind: 'ellipse', cx, cy, rx: 100, ry: 100 }],
    door: DOOR,
    caption: 'round',
  };
}

function planRect(n: number): Plan {
  const topCount = Math.ceil(n / 2);
  const bottomCount = Math.floor(n / 2);
  const topSlots = centreOut(topCount, true); // host's right = screen-left
  const bottomSlots = centreOut(bottomCount, false); // guest faces up: his right = screen-right
  const spacing = 76;
  const seats: SeatSpot[] = [];
  // Odd ranks on the host side, even ranks on the guest side.
  topSlots.forEach((slot, i) => {
    seats.push({ rank: i === 0 ? 1 : 3 + (i - 1) * 2, x: 400 + slot * spacing, y: 165, facing: 90, side: 'host' });
  });
  bottomSlots.forEach((slot, i) => {
    seats.push({ rank: i === 0 ? 2 : 4 + (i - 1) * 2, x: 400 + slot * spacing, y: 345, facing: 270, side: 'guest' });
  });
  const maxAbs = Math.max(...topSlots.map(Math.abs), ...bottomSlots.map(Math.abs), 1);
  const tableW = Math.min(680, maxAbs * 2 * spacing + 150);
  seats.sort((a, b) => a.rank - b.rank);
  return {
    layout: 'rect',
    seats,
    furniture: [{ kind: 'rrect', x: 400 - tableW / 2, y: 200, w: tableW, h: 110, r: 16, tone: 'table' }],
    door: DOOR,
    caption: 'rect',
  };
}

/** Builds seat spots along two chains (the host's right and left) meeting at a head seat. */
function fromChains(head: SeatSpot, rightChain: Array<Omit<SeatSpot, 'rank'>>, leftChain: Array<Omit<SeatSpot, 'rank'>>, n: number): SeatSpot[] {
  const seats: SeatSpot[] = [head];
  let r = 0;
  let l = 0;
  while (seats.length < n) {
    // rank 2 = the host's right (screen-left), then alternate.
    if (seats.length % 2 === 1 && r < rightChain.length) seats.push({ ...rightChain[r++], rank: seats.length + 1 });
    else if (l < leftChain.length) seats.push({ ...leftChain[l++], rank: seats.length + 1 });
    else if (r < rightChain.length) seats.push({ ...rightChain[r++], rank: seats.length + 1 });
    else break;
  }
  return seats;
}

function planMajlis(n: number): Plan {
  const topY = 108;
  const slot = 80;
  const wallL = 98;
  const wallR = 702;
  const sideStart = 196;
  const sideStep = 62;
  const head: SeatSpot = { rank: 1, x: 400, y: topY, facing: 90 };
  const right: Array<Omit<SeatSpot, 'rank'>> = []; // the host's right = screen-left
  const left: Array<Omit<SeatSpot, 'rank'>> = [];
  for (const k of [1, 2]) {
    right.push({ x: 400 - k * slot, y: topY, facing: 90 });
    left.push({ x: 400 + k * slot, y: topY, facing: 90 });
  }
  for (let j = 0; j < 5; j++) {
    right.push({ x: wallL, y: sideStart + j * sideStep, facing: 0 });
    left.push({ x: wallR, y: sideStart + j * sideStep, facing: 180 });
  }
  return {
    layout: 'majlis',
    seats: fromChains(head, right, left, n),
    furniture: [
      { kind: 'rrect', x: 170, y: 168, w: 460, h: 240, r: 10, tone: 'rug' },
      { kind: 'rrect', x: 62, y: 70, w: 676, h: 62, r: 14, tone: 'sofa' },
      { kind: 'rrect', x: 62, y: 150, w: 66, h: 330, r: 14, tone: 'sofa' },
      { kind: 'rrect', x: 672, y: 150, w: 66, h: 330, r: 14, tone: 'sofa' },
      { kind: 'rrect', x: 348, y: 252, w: 104, h: 56, r: 12, tone: 'low' },
      { kind: 'coffee', x: 400, y: 280 },
      { kind: 'brazier', x: 560, y: 380 },
    ],
    door: DOOR,
    caption: 'majlis',
  };
}

function planU(n: number): Plan {
  const topY = 84;
  const slot = 74;
  const armL = 108;
  const armR = 692;
  const armStart = 178;
  const armStep = 70;
  const head: SeatSpot = { rank: 1, x: 400, y: topY, facing: 90 };
  const right: Array<Omit<SeatSpot, 'rank'>> = [];
  const left: Array<Omit<SeatSpot, 'rank'>> = [];
  for (const k of [1, 2]) {
    right.push({ x: 400 - k * slot, y: topY, facing: 90 });
    left.push({ x: 400 + k * slot, y: topY, facing: 90 });
  }
  for (let j = 0; j < 4; j++) {
    right.push({ x: armL, y: armStart + j * armStep, facing: 0 });
    left.push({ x: armR, y: armStart + j * armStep, facing: 180 });
  }
  return {
    layout: 'u_shape',
    seats: fromChains(head, right, left, n),
    furniture: [
      { kind: 'rrect', x: 134, y: 108, w: 532, h: 66, r: 12, tone: 'table' },
      { kind: 'rrect', x: 134, y: 108, w: 66, h: 330, r: 12, tone: 'table' },
      { kind: 'rrect', x: 600, y: 108, w: 66, h: 330, r: 12, tone: 'table' },
    ],
    door: DOOR,
    caption: 'u_shape',
  };
}

function planTheatre(n: number): Plan {
  const perRow = 7;
  const spacing = 70;
  const slots = centreOut(perRow, true);
  const seats: SeatSpot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const slot = slots[i % perRow];
    seats.push({ rank: i + 1, x: 400 + slot * spacing, y: 205 + row * 62, facing: 270 });
  }
  return {
    layout: 'theatre',
    seats,
    furniture: [
      { kind: 'rrect', x: 150, y: 44, w: 500, h: 74, r: 12, tone: 'stage' },
      { kind: 'podium', x: 400, y: 84 },
    ],
    door: DOOR,
    caption: 'theatre',
  };
}

export function planLayout(layout: LayoutKind, count: number): Plan {
  const n = clampCount(layout, count);
  switch (layout) {
    case 'round':
      return planRound(n);
    case 'rect':
      return planRect(n);
    case 'u_shape':
      return planU(n);
    case 'theatre':
      return planTheatre(n);
    case 'majlis':
      return planMajlis(n);
  }
}

/** Pixel to the 5..95 % space used by SeatNode. */
export function toPercent(x: number, y: number): { x: number; y: number } {
  const clamp = (v: number) => Math.max(5, Math.min(95, v));
  return { x: round2(clamp((x / ROOM.w) * 100)), y: round2(clamp((y / ROOM.h) * 100)) };
}

export function fromPercent(px: number, py: number): { x: number; y: number } {
  return { x: (px / 100) * ROOM.w, y: (py / 100) * ROOM.h };
}

export function minSeatDistance(seats: SeatSpot[]): number {
  let min = Infinity;
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      min = Math.min(min, Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y));
    }
  }
  return min;
}
