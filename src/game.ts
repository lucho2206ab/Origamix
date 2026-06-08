// DONE: penalty system removed, piece rendering uses internal diagonal
import type { GameState, Piece, TriangleRef } from "./types.ts";
import { createBoard, getZone, getCell, isRowComplete, isColComplete, applyGravity } from "./board";
import { selectPieceForLevel, computeRotations } from "./piece";
import { render } from "./renderer";
import { speedForLevel } from "./score";
import { initInput } from "./input";
import { addEffect, updateEffects } from "./effects";

let state: GameState;

// Maps a piece triangle's slot to the correct board half-cell by comparing
// the triangle's internal diagonal with the destination board cell's diagonal.
function boardSlotForTriangle(t: TriangleRef, cellRow: number, cellCol: number): 'TL' | 'BR' {
  const internalParity = (t.dRow + t.dCol) & 1;
  const boardParity = (cellRow + cellCol) & 1;
  return internalParity !== boardParity
    ? (t.slot === 'TL' ? 'BR' : 'TL')
    : t.slot;
}

function spawnNextPiece() {
  if (state.status !== 'playing') return;
  const shape = selectPieceForLevel(state.level);
  const rotations = computeRotations(shape.triangles);

  // Try spawn positions in CENTER zone (rows 7-12, cols 7-12)
  // Start at center and spiral outward to find a free spot
  const spawnCandidates = [
    { r: 9, c: 9 }, { r: 9, c: 8 }, { r: 9, c: 10 },
    { r: 8, c: 9 }, { r: 10, c: 9 }, { r: 8, c: 8 },
    { r: 8, c: 10 }, { r: 10, c: 8 }, { r: 10, c: 10 },
    { r: 7, c: 9 }, { r: 12, c: 9 }, { r: 9, c: 7 }, { r: 9, c: 12 },
  ];

  for (const candidate of spawnCandidates) {
    let fits = true;
    for (const t of rotations[0]) {
      const r = candidate.r + t.dRow;
      const c = candidate.c + t.dCol;
      const cell = getCell(state.board, r, c);
      if (!cell) { fits = false; break; }
      const checkSlot = boardSlotForTriangle(t, r, c);
      const half = checkSlot === 'TL' ? cell.TL : cell.BR;
      if (half.filled) { fits = false; break; }
    }
    if (fits) {
      const piece: Piece = {
        shape: { ...shape, triangles: shape.triangles },
        rotation: 0,
        triangles: rotations[0].map(t => ({ ...t })),
        rotations,
        anchorRow: candidate.r,
        anchorCol: candidate.c,
        wall: null,
        moving: false,
        moveAccum: 0,
      } as Piece;
      state.currentPiece = piece;
      return;
    }
  }

  // No valid spawn position found → game over
  state.status = 'gameover';
  state.currentPiece = null;
}

function lockPiece(piece: Piece) {
  // 1. Write triangles to board (adjust slot for cell diagonal)
  for (const t of piece.triangles) {
    const r = piece.anchorRow + t.dRow;
    const c = piece.anchorCol + t.dCol;
    const cell = getCell(state.board, r, c);
    if (!cell) continue;
    const writeSlot = boardSlotForTriangle(t, r, c);
    const half = { filled: true, color: piece.shape.color, isPenalty: false };
    if (writeSlot === 'TL') cell.TL = half;
    else cell.BR = half;
  }

  // 2. Check and clear completed lines FIRST (before gravity)
  let cleared = 0;
  for (let r = 0; r < state.board.length; r++) {
    if (isRowComplete(state.board, r)) {
      for (let c = 0; c < state.board[r].length; c++) {
        const cell = state.board[r][c];
        if (!cell) continue;
        cell.TL = { filled: false, color: '#1e1e1e', isPenalty: false };
        cell.BR = { filled: false, color: '#1e1e1e', isPenalty: false };
      }
      cleared++;
    }
  }
  for (let c = 0; c < state.board[0].length; c++) {
    if (isColComplete(state.board, c)) {
      for (let r = 0; r < state.board.length; r++) {
        const cell = state.board[r][c];
        if (!cell) continue;
        cell.TL = { filled: false, color: '#1e1e1e', isPenalty: false };
        cell.BR = { filled: false, color: '#1e1e1e', isPenalty: false };
      }
      cleared++;
    }
  }

  // 3. Apply gravity AFTER clearing (so cleared cells become empty space)
  applyGravity(state.board);

  // 3b. Check if piece overflowed into CENTER → game over
  for (const t of piece.triangles) {
    const r = piece.anchorRow + t.dRow;
    const c = piece.anchorCol + t.dCol;
    if (getZone(r, c) === 'CENTER') {
      state.status = 'gameover';
      break;
    }
  }

  // 4. Update score and effects
  if (cleared > 0) {
    state.linesCleared += cleared;
    state.score += cleared === 1 ? 100 : cleared === 2 ? 300 : 600;
    state.comboCount += 1;
    addEffect(state, { type: 'flash', x: 0, y: 0, ttl: 0.7, maxTtl: 0.7, color: '#7afcff' });
  } else {
    state.comboCount = 0;
    state.score += 10; // piece placed, no clear
  }

  // 5. Level up check
  state.level = Math.floor(state.score / 500) + 1;
}

function rotateCurrent() {
  const p = state.currentPiece;
  if (!p) return;
  const nextRot = ((p.rotation + 1) % 4) as number;
  const candidate = p.rotations ? p.rotations[nextRot] : null;
  if (!candidate) return;
  // try wall-kick offsets: no shift, left/right small, up/down
  const kicks = [ {r:0,c:0}, {r:0,c:-1}, {r:0,c:1}, {r:0,c:-2}, {r:0,c:2}, {r:-1,c:0}, {r:1,c:0} ];
  for (const k of kicks) {
    let ok = true;
    for (const t of candidate) {
      const nr = p.anchorRow + t.dRow + k.r;
      const nc = p.anchorCol + t.dCol + k.c;
      const cell = getCell(state.board, nr, nc);
      if (!cell) { ok = false; break; }
      const checkSlot = boardSlotForTriangle(t, nr, nc);
      const half = checkSlot === 'TL' ? cell.TL : cell.BR;
      if (half.filled) { ok = false; break; }
    }
    if (ok) {
      p.triangles = candidate.map(t => ({ ...t }));
      p.rotation = nextRot as any;
      p.anchorRow += k.r;
      p.anchorCol += k.c;
      return;
    }
  }
  // if none work, rotation fails
}

function setWallOrShift(dir: 'left'|'right'|'top'|'bottom') {
  const p = state.currentPiece;
  if (!p) return;
  if (!p.moving) {
    p.wall = dir as any;
    p.moving = true;
    p.moveAccum = 0; // reset accumulator on direction set
    return;
  }
  // Already moving: shift laterally only if not blocked
  let dr = 0, dc = 0;
  if (dir === 'left')  dc = -1;
  if (dir === 'right') dc =  1;
  if (dir === 'top')   dr = -1;
  if (dir === 'bottom') dr = 1;

  // Validate shift won't go out of bounds
  let ok = true;
  for (const t of p.triangles) {
    const nr = p.anchorRow + t.dRow + dr;
    const nc = p.anchorCol + t.dCol + dc;
    const cell = getCell(state.board, nr, nc);
    if (!cell) { ok = false; break; }
    const checkSlot = boardSlotForTriangle(t, nr, nc);
    const half = checkSlot === 'TL' ? cell.TL : cell.BR;
    if (half.filled) { ok = false; break; }
  }
  if (ok) {
    p.anchorRow += dr;
    p.anchorCol += dc;
  }
}

export function getGameState(): GameState {
  return state;
}

export function initGame() {
  state = {
    board: createBoard(),
    currentPiece: null,
    nextPieces: [],
    score: 0,
    level: 1,
    linesCleared: 0,
    comboCount: 0,
    effects: [],
    status: 'playing',
    lastTimestamp: 0,
    lastInputTime: performance.now(),
    inactivityGameOver: false,
    canvasShake: { x:0, y:0, frames:0 },
  };

  spawnNextPiece();

  initInput({ rotate: rotateCurrent, setWallOrShift, softDrop: () => {
    const p = state.currentPiece;
    if (!p) return;
    p.moveAccum += Math.max(1, Math.floor(speedForLevel(state.level) * 1.5));
  }, touchActivity: () => {
    state.lastInputTime = performance.now();
  } });
}

export function resetGame() {
  state = {
    board: createBoard(),
    currentPiece: null,
    nextPieces: [],
    score: 0,
    level: 1,
    linesCleared: 0,
    comboCount: 0,
    effects: [],
    status: 'playing',
    lastTimestamp: 0,
    lastInputTime: performance.now(),
    inactivityGameOver: false,
    canvasShake: { x:0, y:0, frames:0 },
  };
  spawnNextPiece();
}

export function gameLoop(timestamp: number) {
  if (!state.lastTimestamp) state.lastTimestamp = timestamp;
  const delta = (timestamp - state.lastTimestamp) / 1000; // seconds
  state.lastTimestamp = timestamp;

  if (state.status !== 'playing') {
    render(state);
    return;
  }

  // Inactivity timeout: 3 minutes without input
  if (state.lastInputTime > 0 && performance.now() - state.lastInputTime > 180000) {
    state.status = 'gameover';
    state.currentPiece = null;
    state.inactivityGameOver = true;
    render(state);
    return;
  }

  const p = state.currentPiece;
  const speed = speedForLevel(state.level);
  if (p && p.moving && p.wall) {
    p.moveAccum += speed * delta;
    while (p.moveAccum >= 1) {
      p.moveAccum -= 1;
      let dr = 0, dc = 0;
      switch (p.wall) {
        case 'top':    dr = -1; break;
        case 'bottom': dr =  1; break;
        case 'left':   dc = -1; break;
        case 'right':  dc =  1; break;
      }

      // Check NEXT position BEFORE moving (look-ahead)
      let blocked = false;
      for (const t of p.triangles) {
        const nr = p.anchorRow + t.dRow + dr;
        const nc = p.anchorCol + t.dCol + dc;
        const cell = getCell(state.board, nr, nc);
        if (!cell) { blocked = true; break; }
        const checkSlot = boardSlotForTriangle(t, nr, nc);
        const half = checkSlot === 'TL' ? cell.TL : cell.BR;
        if (half.filled) { blocked = true; break; }
      }

      if (!blocked) {
        // Safe to move
        p.anchorRow += dr;
        p.anchorCol += dc;
      } else {
        // Lock at current position (do NOT move first)
        lockPiece(p);
        spawnNextPiece();
        break;
      }
    }
  }

  // update effects
  updateEffects(state, delta);

  render(state);
}
