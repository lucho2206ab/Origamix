// DONE: rotateCW rewritten - no index mapping, slot by diagonal parity
import type { PieceShape, TriangleRef } from "./types.ts";

// Piece shapes with proper side-connected triangles (no vertex-only connections).
// Every triangle shares a FULL side with at least one neighbor.
const PIECE_SHAPES: PieceShape[] = [
  // Level 1
  { name:'SQUARE',       color:'#00cfff', minLevel:1, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'}] },
  { name:'STACK_V',      color:'#00ff88', minLevel:1, triangles:[{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'}] },
  { name:'WING_H',       color:'#ff6b35', minLevel:1, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:1,slot:'TL'}] },
  // Level 2
  { name:'L_SHAPE',      color:'#ffcc00', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'}] },
  { name:'DBL_SQUARE',   color:'#ff00aa', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:0,dCol:1,slot:'TL'},{dRow:0,dCol:1,slot:'BR'}] },
  { name:'ZIG',          color:'#aa00ff', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'},{dRow:1,dCol:0,slot:'BR'},{dRow:1,dCol:1,slot:'TL'}] },
  { name:'T_SHAPE',      color:'#33ffcc', minLevel:2, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:0,dCol:1,slot:'TL'},{dRow:1,dCol:0,slot:'TL'}] },
  // Level 3
  { name:'LONG_L',       color:'#ff9900', minLevel:3, triangles:[{dRow:0,dCol:0,slot:'TL'},{dRow:0,dCol:0,slot:'BR'},{dRow:1,dCol:0,slot:'TL'},{dRow:1,dCol:0,slot:'BR'},{dRow:2,dCol:0,slot:'TL'},{dRow:2,dCol:1,slot:'TL'}] },
  { name:'S_SHAPE',      color:'#ff3366', minLevel:3, triangles:[{dRow:0,dCol:1,slot:'TL'},{dRow:0,dCol:1,slot:'BR'},{dRow:1,dCol:0,slot:'TL'},{dRow:1,dCol:0,slot:'BR'},{dRow:1,dCol:1,slot:'TL'}] },
];

export function rotateCW(tris: TriangleRef[]): TriangleRef[] {
  // Step 1: find bounding box
  let minR = Infinity, minC = Infinity, maxR = -Infinity;
  for (const t of tris) {
    minR = Math.min(minR, t.dRow);
    minC = Math.min(minC, t.dCol);
    maxR = Math.max(maxR, t.dRow);
  }
  const H = maxR - minR + 1;

  // Step 2: rotate each triangle 90° CW and determine new slot
  return tris.map(t => {
    // Normalize input coords
    const r = t.dRow - minR;
    const c = t.dCol - minC;

    // Apply 90° CW: newRow = c, newCol = (H-1) - r
    const newRow = c;
    const newCol = (H - 1) - r;

    // Determine slot based on diagonal of destination cell
    const origDiag = (r + c) % 2;
    const newDiag  = (newRow + newCol) % 2;
    const slot: 'TL' | 'BR' = (origDiag !== newDiag)
      ? (t.slot === 'TL' ? 'BR' : 'TL')
      : t.slot;

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
