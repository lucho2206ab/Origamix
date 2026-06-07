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
  // write triangles to board halves
  for (const t of piece.triangles) {
    const r = piece.anchorRow + t.dRow;
    const c = piece.anchorCol + t.dCol;
    const cell = getCell(state.board, r, c);
    if (!cell) continue;
    const half = { filled: true, color: piece.shape.color, isPenalty: false };
    if (t.slot === 'TL') cell.TL = half;
    else cell.BR = half;
  }
  // check rows and columns for clears BEFORE applying gravity
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
  // THEN apply gravity after clears
  applyGravity(state.board);
  if (cleared > 0) {
    state.linesCleared += cleared;
    state.score += cleared * 100;
    state.penaltyTimer = penaltyIntervalForLevel(state.level);
    addEffect(state, { type: 'flash', x: 0, y: 0, ttl: 0.7, maxTtl: 0.7, color: '#7afcff' });
  }
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
    return;
  }
  // already moving: shift laterally (perpendicular)
  if (dir === 'left' || dir === 'right') {
    // shift horizontally
    const delta = dir === 'left' ? -1 : 1;
    p.anchorCol += delta;
  } else {
    const delta = dir === 'top' ? -1 : 1;
    p.anchorRow += delta;
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
  if (p && p.moving) {
    p.moveAccum += speed * delta;
    while (p.moveAccum >= 1) {
      p.moveAccum -= 1;
      // move one step toward wall using consistent collision check
      if (canMoveToward(p, state.board, p.wall as any)) {
        let dr = 0, dc = 0;
        switch (p.wall) {
          case 'top': dr = -1; break;
          case 'bottom': dr = 1; break;
          case 'left': dc = -1; break;
          case 'right': dc = 1; break;
        }
        p.anchorRow += dr;
        p.anchorCol += dc;
      } else {
        // lock
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
