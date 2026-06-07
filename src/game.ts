// DONE: BugC fixed - look-ahead collision + lockPiece order corrected
import type { GameState, Piece, TriangleRef, BoardCell } from "./types.ts";
import { createBoard, getZone, getCell, setHalfCell, isRowComplete, isColComplete, applyGravity, canMoveToward } from "./board";
import { selectPieceForLevel, computeRotations } from "./piece";
import { render } from "./renderer";
import { speedForLevel, penaltyIntervalForLevel } from "./score";
import { initInput } from "./input";
import { addEffect, updateEffects } from "./effects";

let state: GameState;

function makePieceFromShape(shape: { triangles: TriangleRef[]; color: string } ) : Piece {
  const tris = shape.triangles.map(t => ({ ...t }));
  return {
    shape: { ...shape, triangles: shape.triangles },
    rotation: 0,
    triangles: tris,
    anchorRow: 7,
    anchorCol: 9,
    wall: null,
    moving: false,
    moveAccum: 0,
  } as Piece;
}

function spawnNextPiece() {
  const shape = selectPieceForLevel(state.level);
  const piece = makePieceFromShape(shape);
  // precompute rotations
  const rotations = computeRotations(shape.triangles);
  piece.rotations = rotations;
  piece.triangles = rotations[0];
  piece.rotation = 0;
  state.currentPiece = piece;
}

function lockPiece(piece: Piece) {
  // 1. Write triangles to board
  for (const t of piece.triangles) {
    const r = piece.anchorRow + t.dRow;
    const c = piece.anchorCol + t.dCol;
    const cell = getCell(state.board, r, c);
    if (!cell) continue;
    const half = { filled: true, color: piece.shape.color, isPenalty: false };
    if (t.slot === 'TL') cell.TL = half;
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

  // 4. Update score and effects
  if (cleared > 0) {
    state.linesCleared += cleared;
    state.score += cleared === 1 ? 100 : cleared === 2 ? 300 : 600;
    state.comboCount += 1;
    state.penaltyTimer = penaltyIntervalForLevel(state.level);
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
  if (!p || p.moving) return;
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
      const half = t.slot === 'TL' ? cell.TL : cell.BR;
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
    const half = t.slot === 'TL' ? cell.TL : cell.BR;
    if (half.filled) { ok = false; break; }
  }
  if (ok) {
    p.anchorRow += dr;
    p.anchorCol += dc;
  }
}

export function initGame() {
  state = {
    board: createBoard(),
    currentPiece: null,
    nextPieces: [],
    score: 0,
    level: 1,
    linesCleared: 0,
    penaltyCount: 0,
    penaltyTimer: penaltyIntervalForLevel(1),
    comboCount: 0,
    effects: [],
    status: 'playing',
    lastTimestamp: 0,
    canvasShake: { x:0, y:0, frames:0 },
  };

  spawnNextPiece();

  initInput({ rotate: rotateCurrent, setWallOrShift, softDrop: () => {
    const p = state.currentPiece;
    if (!p) return;
    // add immediate drop steps
    p.moveAccum += Math.max(1, Math.floor(speedForLevel(state.level) * 1.5));
  } });
}

export function gameLoop(timestamp: number) {
  if (!state.lastTimestamp) state.lastTimestamp = timestamp;
  const delta = (timestamp - state.lastTimestamp) / 1000; // seconds
  state.lastTimestamp = timestamp;

  if (state.status !== 'playing') {
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
        const half = t.slot === 'TL' ? cell.TL : cell.BR;
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

  // penalty timer
  state.penaltyTimer -= delta;
  if (state.penaltyTimer <= 0) {
    state.penaltyCount += 1;
    state.penaltyTimer = penaltyIntervalForLevel(state.level);
    if (state.penaltyCount >= 5) state.status = 'gameover';
  }
  // update effects
  updateEffects(state, delta);

  render(state);
}
