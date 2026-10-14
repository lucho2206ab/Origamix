// DONE: delta capped at 100ms - prevents mobile frame spike
// DONE: penalty system removed, piece movement and locking preserve shape
import type { GameState, Piece } from "./types.ts";
import { createBoard, getZone, isRowComplete, isColComplete, getPieceBoardSlots } from "./board";
import { selectPieceForLevel, computeRotations } from "./piece";
import { render } from "./renderer";
import { speedForLevel } from "./score";
import { initInput } from "./input";
import { addEffect, updateEffects } from "./effects";

let state: GameState;

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
    if (getPieceBoardSlots(rotations[0], candidate.r, candidate.c, state.board)) {
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
  const slots = getPieceBoardSlots(
    piece.triangles,
    piece.anchorRow,
    piece.anchorCol,
    state.board
  );
  if (!slots) throw new Error(`Unable to lock piece ${piece.shape.name} at its current position`);

  // 1. Write triangles using slots that preserve the piece's connections.
  for (const [index, t] of piece.triangles.entries()) {
    const r = piece.anchorRow + t.dRow;
    const c = piece.anchorCol + t.dCol;
    const cell = state.board[r]?.[c];
    if (!cell) throw new Error(`Missing board cell while locking piece ${piece.shape.name}`);
    const writeSlot = slots[index];
    const half = { filled: true, color: piece.shape.color, isPenalty: false };
    if (writeSlot === 'TL') cell.TL = half;
    else cell.BR = half;
  }

  // 2. Check and clear completed lines without shifting the remaining pieces.
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

  // 3. Check if piece overflowed into CENTER → game over
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
    if (getPieceBoardSlots(candidate, p.anchorRow + k.r, p.anchorCol + k.c, state.board)) {
      p.triangles = candidate.map(t => ({ ...t }));
      p.rotation = nextRot as 0 | 1 | 2 | 3;
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
    p.wall = dir;
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

  const ok = getPieceBoardSlots(p.triangles, p.anchorRow + dr, p.anchorCol + dc, state.board) !== null;
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
  const rawDelta = (timestamp - state.lastTimestamp) / 1000; // seconds
  const delta = Math.min(rawDelta, 0.1); // cap at 100ms to prevent spike on mobile
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

      // Check the entire piece before moving so a blocked triangle cannot detach.
      const blocked = getPieceBoardSlots(
        p.triangles,
        p.anchorRow + dr,
        p.anchorCol + dc,
        state.board
      ) === null;

      if (!blocked) {
        // Safe to move
        p.anchorRow += dr;
        p.anchorCol += dc;
      } else {
        // Lock at current position (do NOT move first)
        lockPiece(p);
        state.currentPiece = null;
        spawnNextPiece();
        break;
      }
    }
  }

  // update effects
  updateEffects(state, delta);

  render(state);
}
