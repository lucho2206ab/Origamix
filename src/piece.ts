// DONE: rotations preserve side-connected triangle layouts
import type { PieceShape, TriangleRef } from "./types.ts";

// Piece shapes with proper side-connected triangles (no vertex-only connections).
// Every triangle shares a FULL side with at least one neighbor.
const PIECE_SHAPES: PieceShape[] = [
  // Level 1
  { name:'SQUARE',       color:'#00cfff', minLevel:1, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'}] },
  { name:'STACK_V',      color:'#00ff88', minLevel:1, triangles:[{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'}] },
  { name:'WING_H',       color:'#ff6b35', minLevel:1, triangles:[{dRow:0,dCol:0,slot:'BR'},{dRow:0,dCol:1,slot:'BR'}] },
  // Level 2
  { name:'L_SHAPE',      color:'#ffcc00', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'}] },
  { name:'DBL_SQUARE',   color:'#ff00aa', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:0,dCol:1,slot:'TL'},{dRow:0,dCol:1,slot:'BR'}] },
  { name:'ZIG',          color:'#aa00ff', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'},{dRow:1,dCol:0,slot:'BR'},{dRow:1,dCol:1,slot:'TL'}] },
  { name:'T_SHAPE',      color:'#33ffcc', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:0,dCol:1,slot:'BR'},{dRow:1,dCol:0,slot:'TL'}] },
  // Level 3
  { name:'LONG_L',       color:'#ff9900', minLevel:3, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'},{dRow:1,dCol:0,slot:'BR'},{dRow:1,dCol:1,slot:'TL'},{dRow:1,dCol:1,slot:'BR'}] },
  { name:'S_SHAPE',      color:'#ff3366', minLevel:3, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:0,dCol:1,slot:'TL'},{dRow:0,dCol:1,slot:'BR'},{dRow:1,dCol:1,slot:'TL'}] },
];

export function rotateCW(tris: TriangleRef[]): TriangleRef[] {
  if (tris.length === 0) return [];

  let minR = Infinity, minC = Infinity, maxR = -Infinity;
  for (const t of tris) {
    minR = Math.min(minR, t.dRow);
    minC = Math.min(minC, t.dCol);
    maxR = Math.max(maxR, t.dRow);
  }

  const height = maxR - minR + 1;

  return tris.map(t => {
    const r = t.dRow - minR;
    const c = t.dCol - minC;

    const newRow = c;
    const newCol = (height - 1) - r;

    const sourceDiag = (r + c) % 2;
    const slot: 'TL' | 'BR' = sourceDiag === 0
      ? t.slot
      : (t.slot === 'TL' ? 'BR' : 'TL');

    return { dRow: newRow, dCol: newCol, slot };
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
