// DONE: board movement validates triangle parity and locked pieces remain intact
import type { BoardCell, DiagonalDir, Zone, HalfCell, Piece, TriangleRef, TriSlot } from "./types.ts";

type Point = readonly [number, number];

function triangleVertices(row: number, col: number, slot: TriSlot, diagonalParity: number): Point[] {
  if (diagonalParity === 0) {
    return slot === 'TL'
      ? [[col, row], [col + 1, row], [col, row + 1]]
      : [[col + 1, row], [col + 1, row + 1], [col, row + 1]];
  }
  return slot === 'TL'
    ? [[col, row], [col + 1, row], [col + 1, row + 1]]
    : [[col, row], [col + 1, row + 1], [col, row + 1]];
}

function shareSide(a: Point[], b: Point[]): boolean {
  return a.filter(([x, y]) => b.some(([otherX, otherY]) => x === otherX && y === otherY)).length >= 2;
}

export function getPieceBoardSlots(
  triangles: TriangleRef[],
  anchorRow: number,
  anchorCol: number,
  board: (BoardCell | null)[][]
): TriSlot[] | null {
  const internalPolygons = triangles.map(t =>
    triangleVertices(t.dRow, t.dCol, t.slot, (t.dRow + t.dCol) & 1)
  );
  const adjacent = triangles.map((_, i) =>
    triangles.map((__, j) => i !== j && shareSide(internalPolygons[i], internalPolygons[j]))
  );
  const masks = Array.from({ length: 1 << triangles.length }, (_, mask) => mask);
  masks.sort((a, b) => {
    const slotChanges = (mask: number) => triangles.reduce((count, triangle, index) => {
      const slot: TriSlot = (mask >> index) & 1 ? 'BR' : 'TL';
      return count + (slot !== triangle.slot ? 1 : 0);
    }, 0);
    return slotChanges(a) - slotChanges(b);
  });

  let bestSlots: TriSlot[] | null = null;
  let bestScore = Infinity;
  for (const mask of masks) {
    const slots = triangles.map((_, index): TriSlot => (mask >> index) & 1 ? 'BR' : 'TL');
    let valid = true;
    const worldPolygons = triangles.map((triangle, index) =>
      triangleVertices(
        anchorRow + triangle.dRow,
        anchorCol + triangle.dCol,
        slots[index],
        (anchorRow + triangle.dRow + anchorCol + triangle.dCol) & 1
      )
    );

    for (let i = 0; i < triangles.length && valid; i++) {
      const triangle = triangles[i];
      const row = anchorRow + triangle.dRow;
      const col = anchorCol + triangle.dCol;
      const cell = board[row]?.[col];
      if (!cell) {
        valid = false;
        break;
      }
      const half = slots[i] === 'TL' ? cell.TL : cell.BR;
      if (half.filled) {
        valid = false;
        break;
      }

      for (let j = i + 1; j < triangles.length && valid; j++) {
        const sameCell = triangle.dRow === triangles[j].dRow && triangle.dCol === triangles[j].dCol;
        if (sameCell && slots[i] === slots[j]) {
          valid = false;
        }
      }
    }

    if (!valid) continue;

    const connected = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      const current = queue.pop()!;
      for (let other = 0; other < triangles.length; other++) {
        if (!connected.has(other) && shareSide(worldPolygons[current], worldPolygons[other])) {
          connected.add(other);
          queue.push(other);
        }
      }
    }
    if (connected.size !== triangles.length) continue;

    let changedEdges = 0;
    for (let i = 0; i < triangles.length; i++) {
      for (let j = i + 1; j < triangles.length; j++) {
        const targetAdjacent = shareSide(worldPolygons[i], worldPolygons[j]);
        if (adjacent[i][j] !== targetAdjacent) changedEdges++;
      }
    }
    const slotChanges = slots.reduce(
      (count, slot, index) => count + (slot !== triangles[index].slot ? 1 : 0),
      0
    );
    const score = changedEdges * 100 + slotChanges;
    if (score < bestScore) {
      bestSlots = slots;
      bestScore = score;
    }
  }

  return bestSlots;
}

// Build a 20x20 virtual grid where cells outside the cross are null
export function createBoard(): (BoardCell | null)[][] {
  const rows = 20;
  const cols = 20;
  const board: (BoardCell | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (BoardCell | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const zone = getZone(r, c);
      if (!zone) {
        row.push(null);
        continue;
      }
      const diag: DiagonalDir = getDiagonal(r, c);
      const emptyHalf: HalfCell = { filled: false, color: '#1e1e1e', isPenalty: false };
      row.push({ diag, TL: { ...emptyHalf }, BR: { ...emptyHalf } });
    }
    board.push(row);
  }
  return board;
}

export function getZone(row: number, col: number): Zone | null {
  const inCenter = row >= 7 && row <= 12 && col >= 7 && col <= 12;
  const inTop = row >= 0 && row <= 6 && col >= 7 && col <= 12;
  const inBottom = row >= 13 && row <= 19 && col >= 7 && col <= 12;
  const inLeft = row >= 7 && row <= 12 && col >= 0 && col <= 6;
  const inRight = row >= 7 && row <= 12 && col >= 13 && col <= 19;
  if (inCenter) return 'CENTER';
  if (inTop) return 'TOP';
  if (inBottom) return 'BOTTOM';
  if (inLeft) return 'LEFT';
  if (inRight) return 'RIGHT';
  return null;
}

export function getDiagonal(row: number, col: number): DiagonalDir {
  return ((row + col) % 2 === 0) ? '\\' : '/';
}

export function isInCross(row: number, col: number): boolean {
  return getZone(row, col) !== null;
}

export function getCell(board: (BoardCell | null)[][], row: number, col: number): BoardCell | null {
  if (row < 0 || col < 0 || row >= board.length || col >= board[0].length) return null;
  return board[row][col];
}

export function setHalfCell(board: (BoardCell | null)[][], row: number, col: number, slot: 'TL' | 'BR', value: HalfCell) {
  const cell = getCell(board, row, col);
  if (!cell) return;
  if (slot === 'TL') cell.TL = value;
  else cell.BR = value;
}

export function isRowComplete(board: (BoardCell | null)[][], row: number): boolean {
  if (row < 0 || row >= board.length) return false;
  for (let c = 0; c < board[row].length; c++) {
    const cell = board[row][c];
    if (!cell) continue; // ignore outside-cross
    if (!cell.TL.filled || !cell.BR.filled) return false;
  }
  return true;
}

export function isColComplete(board: (BoardCell | null)[][], col: number): boolean {
  if (col < 0) return false;
  for (let r = 0; r < board.length; r++) {
    const cell = board[r][col];
    if (!cell) continue;
    if (!cell.TL.filled || !cell.BR.filled) return false;
  }
  return true;
}

export function canMoveToward(piece: Piece, board: (BoardCell | null)[][], direction: 'top' | 'bottom' | 'left' | 'right'): boolean {
  let dr = 0, dc = 0;
  switch (direction) {
    case 'top': dr = -1; break;
    case 'bottom': dr = 1; break;
    case 'left': dc = -1; break;
    case 'right': dc = 1; break;
  }

  return getPieceBoardSlots(
    piece.triangles,
    piece.anchorRow + dr,
    piece.anchorCol + dc,
    board
  ) !== null;
}
