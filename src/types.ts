// DONE: types.ts — Implemented triangular board and game state types

export type DiagonalDir = '\\' | '/';
export type TriSlot = 'TL' | 'BR';
export type Wall = 'top' | 'bottom' | 'left' | 'right';
export type Zone = 'CENTER' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

export interface HalfCell {
  filled: boolean;
  color: string;
  isPenalty: boolean;
}

export interface BoardCell {
  diag: DiagonalDir;
  TL: HalfCell;
  BR: HalfCell;
}

export interface TriangleRef {
  dRow: number;
  dCol: number;
  slot: TriSlot;
}

export interface PieceShape {
  name: string;
  triangles: TriangleRef[];
  color: string;
  minLevel: number;
}

export interface Piece {
  shape: PieceShape;
  rotation: 0 | 1 | 2 | 3;
  triangles: TriangleRef[]; // current rotation
  anchorRow: number;
  anchorCol: number;
  wall: Wall | null;
  moving: boolean;
  moveAccum: number;
  rotations?: TriangleRef[][];
}

export interface Effect {
  type: 'flash' | 'ripple' | 'shake' | 'particle' | 'popup' | 'penalty' | 'wipe';
  x: number;
  y: number;
  ttl: number;
  maxTtl: number;
  color: string;
  data?: Record<string, unknown>;
}

export interface GameState {
  board: (BoardCell | null)[][]; // 20x20 virtual grid
  currentPiece: Piece | null;
  nextPieces: PieceShape[];
  score: number;
  level: number;
  linesCleared: number;
  comboCount: number;
  effects: Effect[];
  status: 'playing' | 'paused' | 'gameover';
  lastTimestamp: number;
  lastInputTime: number; // performance.now(), 3min inactivity → gameover
  inactivityGameOver: boolean;
  canvasShake: { x: number; y: number; frames: number };
}
