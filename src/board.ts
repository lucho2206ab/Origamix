// DONE: Bug2 fixed - collision reaches wall edge at top of board.ts
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

  // TOP arm: stack at row 0, gravity pulls UP
  for (let c = 7; c <= 12; c++) {
    for (let r = 1; r <= 6; r++) {
      const cell = board[r][c];
      if (!cell) continue;
      const above = board[r - 1]?.[c];
      if (!above) continue;
      if (cell.TL.filled && !above.TL.filled) { above.TL = { ...cell.TL }; cell.TL = empty(); }
      if (cell.BR.filled && !above.BR.filled) { above.BR = { ...cell.BR }; cell.BR = empty(); }
    }
  }

  // BOTTOM arm: stack at row 19, gravity pulls DOWN
  for (let c = 7; c <= 12; c++) {
    for (let r = 18; r >= 13; r--) {
      const cell = board[r][c];
      if (!cell) continue;
      const below = board[r + 1]?.[c];
      if (!below) continue;
      if (cell.TL.filled && !below.TL.filled) { below.TL = { ...cell.TL }; cell.TL = empty(); }
      if (cell.BR.filled && !below.BR.filled) { below.BR = { ...cell.BR }; cell.BR = empty(); }
    }
  }

  // LEFT arm: stack at col 0, gravity pulls LEFT
  for (let r = 7; r <= 12; r++) {
    for (let c = 1; c <= 6; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const left = board[r]?.[c - 1];
      if (!left) continue;
      if (cell.TL.filled && !left.TL.filled) { left.TL = { ...cell.TL }; cell.TL = empty(); }
      if (cell.BR.filled && !left.BR.filled) { left.BR = { ...cell.BR }; cell.BR = empty(); }
    }
  }

  // RIGHT arm: stack at col 19, gravity pulls RIGHT
  for (let r = 7; r <= 12; r++) {
    for (let c = 18; c >= 13; c--) {
      const cell = board[r][c];
      if (!cell) continue;
      const right = board[r]?.[c + 1];
      if (!right) continue;
      if (cell.TL.filled && !right.TL.filled) { right.TL = { ...cell.TL }; cell.TL = empty(); }
      if (cell.BR.filled && !right.BR.filled) { right.BR = { ...cell.BR }; cell.BR = empty(); }
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


