// DONE: applyGravity loop direction fixed - pulls from wall edge inward
import type { BoardCell, DiagonalDir, Zone, HalfCell, Piece } from "./types.ts";

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

// Simple gravity: after clearing rows, shift halves toward center depending on zone.
export function applyGravity(board: (BoardCell | null)[][]) {
  const empty = (): HalfCell => ({ filled: false, color: '#1e1e1e', isPenalty: false });

  // TOP arm: stack AT row 0, pull cells upward
  // Loop from wall (row 0) toward center (row 6)
  for (let c = 7; c <= 12; c++) {
    for (let r = 0; r <= 5; r++) {
      const above = board[r]?.[c];
      const below = board[r + 1]?.[c];
      if (!above || !below) continue;
      if (!above.TL.filled && below.TL.filled) { above.TL = { ...below.TL }; below.TL = empty(); }
      if (!above.BR.filled && below.BR.filled) { above.BR = { ...below.BR }; below.BR = empty(); }
    }
  }

  // BOTTOM arm: stack AT row 19, pull cells downward
  // Loop from wall (row 19) toward center (row 13)
  for (let c = 7; c <= 12; c++) {
    for (let r = 19; r >= 14; r--) {
      const below = board[r]?.[c];
      const above = board[r - 1]?.[c];
      if (!below || !above) continue;
      if (!below.TL.filled && above.TL.filled) { below.TL = { ...above.TL }; above.TL = empty(); }
      if (!below.BR.filled && above.BR.filled) { below.BR = { ...above.BR }; above.BR = empty(); }
    }
  }

  // LEFT arm: stack AT col 0, pull cells leftward
  // Loop from wall (col 0) toward center (col 6)
  for (let r = 7; r <= 12; r++) {
    for (let c = 0; c <= 5; c++) {
      const left  = board[r]?.[c];
      const right = board[r]?.[c + 1];
      if (!left || !right) continue;
      if (!left.TL.filled && right.TL.filled) { left.TL = { ...right.TL }; right.TL = empty(); }
      if (!left.BR.filled && right.BR.filled) { left.BR = { ...right.BR }; right.BR = empty(); }
    }
  }

  // RIGHT arm: stack AT col 19, pull cells rightward
  // Loop from wall (col 19) toward center (col 13)
  for (let r = 7; r <= 12; r++) {
    for (let c = 19; c >= 14; c--) {
      const right = board[r]?.[c];
      const left  = board[r]?.[c - 1];
      if (!right || !left) continue;
      if (!right.TL.filled && left.TL.filled) { right.TL = { ...left.TL }; left.TL = empty(); }
      if (!right.BR.filled && left.BR.filled) { right.BR = { ...left.BR }; left.BR = empty(); }
    }
  }
}
export function canMoveToward(piece: Piece, board: (BoardCell | null)[][], direction: 'top' | 'bottom' | 'left' | 'right'): boolean {
  let dr = 0, dc = 0;
  switch (direction) {
    case 'top': dr = -1; break;
    case 'bottom': dr = 1; break;
    case 'left': dc = -1; break;
    case 'right': dc = 1; break;
  }

  for (const t of piece.triangles) {
    const nr = piece.anchorRow + t.dRow + dr;
    const nc = piece.anchorCol + t.dCol + dc;

    // Check if next position is within the cross (including edge cells)
    if (!isInCross(nr, nc)) return false;

    const cell = getCell(board, nr, nc);
    if (!cell) return false; // Should not happen if isInCross is correct

    // Check if the half-cell is already filled
    const half = t.slot === 'TL' ? cell.TL : cell.BR;
    if (half.filled) return false;
  }

  return true;
}


