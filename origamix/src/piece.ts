import type { PieceShape, TriangleRef } from "./types.ts";

// Some sample triangular piece shapes. triangles are relative to an anchor.
const PIECE_SHAPES: PieceShape[] = [
  {
    name: 'small-v',
    triangles: [
      { dRow: 0, dCol: 0, slot: 'TL' },
      { dRow: 0, dCol: 1, slot: 'BR' },
    ],
    color: 'hsl(210,90%,60%)',
    minLevel: 1,
  },
  {
    name: 'line-3',
    triangles: [
      { dRow: 0, dCol: 0, slot: 'TL' },
      { dRow: 0, dCol: 1, slot: 'TL' },
      { dRow: 0, dCol: 2, slot: 'TL' },
    ],
    color: 'hsl(145,80%,55%)',
    minLevel: 1,
  },
  {
    name: 'l-shape',
    triangles: [
      { dRow: 0, dCol: 0, slot: 'TL' },
      { dRow: 1, dCol: 0, slot: 'BR' },
      { dRow: 2, dCol: 0, slot: 'BR' },
    ],
    color: 'hsl(345,85%,60%)',
    minLevel: 2,
  },
  {
    name: 'block-4',
    triangles: [
      { dRow: 0, dCol: 0, slot: 'TL' },
      { dRow: 0, dCol: 1, slot: 'BR' },
      { dRow: 1, dCol: 0, slot: 'TL' },
      { dRow: 1, dCol: 1, slot: 'BR' },
    ],
    color: 'hsl(275,85%,62%)',
    minLevel: 2,
  },
  {
    name: 'long-5',
    triangles: [
      { dRow: 0, dCol: 0, slot: 'TL' },
      { dRow: 0, dCol: 1, slot: 'TL' },
      { dRow: 0, dCol: 2, slot: 'TL' },
      { dRow: 0, dCol: 3, slot: 'TL' },
      { dRow: 1, dCol: 0, slot: 'BR' },
    ],
    color: 'hsl(10,90%,60%)',
    minLevel: 3,
  },
  {
    name: 'cluster-6',
    triangles: [
      { dRow: 0, dCol: 0, slot: 'TL' },
      { dRow: 0, dCol: 1, slot: 'BR' },
      { dRow: 1, dCol: 0, slot: 'TL' },
      { dRow: 1, dCol: 1, slot: 'BR' },
      { dRow: 2, dCol: 0, slot: 'TL' },
      { dRow: 2, dCol: 1, slot: 'BR' },
    ],
    color: 'hsl(340,90%,64%)',
    minLevel: 4,
  },
];

function boundingBox(tris: TriangleRef[]) {
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const t of tris) {
    minR = Math.min(minR, t.dRow);
    minC = Math.min(minC, t.dCol);
    maxR = Math.max(maxR, t.dRow);
    maxC = Math.max(maxC, t.dCol);
  }
  return { minR, minC, maxR, maxC, height: maxR - minR + 1, width: maxC - minC + 1 };
}

// Accurate rotation per CLAUDE.md: newRow = dCol; newCol = (H-1)-dRow
export function rotateCW(tris: TriangleRef[]): TriangleRef[] {
  const bb = boundingBox(tris);
  const H = bb.height;
  // apply formula
  const rotated = tris.map(t => {
    const newRow = t.dCol;
    const newCol = (H - 1) - t.dRow;
    return { dRow: newRow, dCol: newCol, slot: t.slot } as TriangleRef;
  });
  // normalize so min coords start at 0
  const nbb = boundingBox(rotated);
  const normalized = rotated.map(t => ({ dRow: t.dRow - nbb.minR, dCol: t.dCol - nbb.minC, slot: t.slot }));
  // flip slot if parity changed between old and new positions
  return normalized.map((t, i) => {
    const orig = tris[i];
    const origParity = (orig.dRow + orig.dCol) & 1;
    const newParity = (t.dRow + t.dCol) & 1;
    const slot = (origParity !== newParity) ? (orig.slot === 'TL' ? 'BR' : 'TL') : orig.slot;
    return { dRow: t.dRow, dCol: t.dCol, slot };
  });
}

export function computeRotations(tris: TriangleRef[]): TriangleRef[][] {
  const r0 = tris.map(t => ({ ...t }));
  const r1 = rotateCW(r0);
  const r2 = rotateCW(r1);
  const r3 = rotateCW(r2);
  return [r0, r1, r2, r3];
}

export function selectPieceForLevel(level: number): PieceShape {
  const available = PIECE_SHAPES.filter(p => p.minLevel <= level);
  return available[Math.floor(Math.random() * available.length)];
}

export function randomPiece(): PieceShape {
  return PIECE_SHAPES[Math.floor(Math.random() * PIECE_SHAPES.length)];
}

export { PIECE_SHAPES };
