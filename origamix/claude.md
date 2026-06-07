# CLAUDE.md — Origami Neon v2 (Triangular Grid)

> Read this file ENTIRELY before touching any code.
> On context reset: read this file → check // DONE: comments → continue from next task.

---

## 📁 Project Structure

```
origamix/
├─ index.html         # Canvas shell
├─ package.json       # Vite + TypeScript (npm run dev)
├─ tsconfig.json      # Strict mode, no `any`
├─ CLAUDE.md          # THIS FILE
└─ src/
   ├─ types.ts        # ALL interfaces and types — source of truth
   ├─ board.ts        # Cross board, zone detection, collision, line clear
   ├─ piece.ts        # Triangle piece definitions, rotation, spawn
   ├─ score.ts        # Scoring, combos, level, speed, penalty interval
   ├─ renderer.ts     # Canvas rendering: triangles, board, UI, ghost
   ├─ effects.ts      # Visual effects: flash, wipe, ripple, particles
   ├─ input.ts        # Keyboard handling, directional gravity input
   ├─ game.ts         # State machine, game loop update logic
   └─ main.ts         # Entry point, canvas setup, rAF loop
```

---

## 🔺 THE MOST IMPORTANT CONCEPT: TRIANGULAR HALF-CELLS

Every square on the board is split into 2 triangles by a diagonal.
The diagonal direction alternates in a checkerboard pattern:
- (row + col) % 2 === 0 → diagonal is `\` (top-left to bottom-right)
- (row + col) % 2 === 1 → diagonal is `/` (top-right to bottom-left)

Each square has two slots: `TL` (top-left triangle) and `BR` (bottom-right triangle).

```
Diagonal '\' square:        Diagonal '/' square:
┌────────┐                  ┌────────┐
│TL  /   │                  │   \  TL│
│   /    │                  │    \   │
│  / BR  │                  │ BR  \  │
└────────┘                  └────────┘
```

A square is COMPLETE when both TL and BR are filled.
A LINE is COMPLETE when all squares in that row/column are complete.

---

## 📐 Core TypeScript Interfaces (types.ts)

```typescript
type DiagonalDir = '\\' | '/';
type TriSlot = 'TL' | 'BR';
type Wall = 'top' | 'bottom' | 'left' | 'right';
type Zone = 'CENTER' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

interface HalfCell {
  filled: boolean;
  color: string;
  isPenalty: boolean;
}

interface BoardCell {
  diag: DiagonalDir;  // fixed by (row+col)%2, never changes
  TL: HalfCell;
  BR: HalfCell;
}

interface TriangleRef {
  dRow: number;       // row offset from piece anchor
  dCol: number;       // col offset from piece anchor
  slot: TriSlot;      // which half of that square
}

interface PieceShape {
  name: string;
  triangles: TriangleRef[];
  color: string;
  minLevel: number;
}

interface Piece {
  shape: PieceShape;
  rotation: 0 | 1 | 2 | 3;
  triangles: TriangleRef[];  // current rotation's triangles (precomputed)
  anchorRow: number;
  anchorCol: number;
  wall: Wall | null;         // null = not yet directed
  moving: boolean;
  moveAccum: number;         // accumulated movement (for delta-time)
}

interface Effect {
  type: 'flash' | 'ripple' | 'shake' | 'particle' | 'popup' | 'penalty' | 'wipe';
  x: number;
  y: number;
  ttl: number;
  maxTtl: number;
  color: string;
  data?: Record<string, unknown>;
}

interface GameState {
  board: (BoardCell | null)[][];   // 20x20, null = outside cross
  currentPiece: Piece | null;
  nextPieces: PieceShape[];        // queue of next 2
  score: number;
  level: number;
  linesCleared: number;
  penaltyCount: number;            // 0..5, game over at 5
  penaltyTimer: number;            // seconds remaining
  comboCount: number;
  effects: Effect[];
  status: 'playing' | 'paused' | 'gameover';
  lastTimestamp: number;
  canvasShake: { x: number; y: number; frames: number };
}
```

---

## 🗺️ Board Zones

```
Virtual 20×20 grid. Cells outside cross = null.

         TOP (rows 0–6, cols 7–12)
              ┌──────┐
              │      │
LEFT    ┌─────┼──────┼─────┐    RIGHT
(r7-12, │     │CENTER│     │ (r7-12,
c0-6)   │     │r7-12 │     │  c13-19)
        └─────┼c7-12─┼─────┘
              │      │
              └──────┘
         BOTTOM (rows 13–19, cols 7–12)
```

Key functions in board.ts:
```typescript
getZone(row, col): Zone | null
getDiagonal(row, col): DiagonalDir   // (row+col)%2===0 ? '\\' : '/'
isInCross(row, col): boolean
createBoard(): (BoardCell|null)[][]  // initialize all cells
```

---

## 🔷 Piece System

### Rotation (90° CW)
```typescript
// For bounding box height H:
// newRow = dCol
// newCol = (H - 1) - dRow
// Then: if diagonal of new cell differs from old → flip slot (TL↔BR)
function rotateCW(triangles: TriangleRef[]): TriangleRef[]
```

All 4 rotation states are precomputed at startup for each piece shape.

### Piece selection by level
```typescript
function selectPieceForLevel(level: number): PieceShape {
  const available = PIECE_SHAPES.filter(p => p.minLevel <= level);
  return available[Math.floor(Math.random() * available.length)];
}
```

---

## 🎮 Directional Gravity

```
SPACEBAR pressed  → rotate piece 90° CW (only if piece.moving === false)
ARROW KEY pressed →
  if piece.wall === null:
    set piece.wall = direction
    set piece.moving = true
  else (already moving):
    shift piece laterally (perpendicular to movement direction)
```

Movement each frame (in game.ts updatePieceMovement):
```typescript
piece.moveAccum += speedCellsPerSec * delta;
while (piece.moveAccum >= 1) {
  piece.moveAccum -= 1;
  if (canMoveToward(piece, board)) {
    moveOneStep(piece);          // row or col ±1 toward wall
  } else {
    lockPiece(piece, board);     // write triangles to board
    checkLineClears(board, state);
    spawnNextPiece(state);
    break;
  }
}
```

---

## 🖼️ Triangle Rendering (renderer.ts — CRITICAL)

Every triangle MUST use this exact approach:

```typescript
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,  // top-left pixel of the square cell
  S: number,               // cell size in pixels
  diag: DiagonalDir,
  slot: TriSlot,
  color: string,
  alpha: number = 1
): void {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.fillStyle = color;

  if (diag === '\\') {
    if (slot === 'TL') {
      ctx.moveTo(px,     py);
      ctx.lineTo(px + S, py);
      ctx.lineTo(px,     py + S);
    } else {
      ctx.moveTo(px + S, py);
      ctx.lineTo(px + S, py + S);
      ctx.lineTo(px,     py + S);
    }
  } else {
    if (slot === 'TL') {
      ctx.moveTo(px,     py);
      ctx.lineTo(px + S, py);
      ctx.lineTo(px + S, py + S);
    } else {
      ctx.moveTo(px,     py);
      ctx.lineTo(px + S, py + S);
      ctx.lineTo(px,     py + S);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

// After drawing both triangles, always draw the diagonal line:
function drawDiagonalLine(ctx, px, py, S, diag): void {
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  if (diag === '\\') {
    ctx.moveTo(px, py); ctx.lineTo(px+S, py+S);
  } else {
    ctx.moveTo(px+S, py); ctx.lineTo(px, py+S);
  }
  ctx.stroke();
}
```

Empty triangles → color `#1e1e1e`
Ghost piece triangles → alpha 0.2, dashed stroke in piece color
Penalty triangles → color `#ff3300` with pulsing glow

---

## 📏 Line Clear Logic

```typescript
// Horizontal: row R is complete if every cross cell in row R has both TL+BR filled
function isRowComplete(board, row): boolean

// Vertical: col C is complete if every cross cell in col C has both TL+BR filled
function isColComplete(board, col): boolean

// After clear: apply gravity
// TOP/BOTTOM arms: filled triangles fall toward CENTER (downward/upward)
// LEFT/RIGHT arms: filled triangles slide toward CENTER (rightward/leftward)
// Gravity moves HalfCells, preserving slot assignments where diagonal matches
```

---

## ⚠️ Penalty Cells

Placement order in CENTER zone (corners first):
1. (7,7) TL
2. (7,12) BR
3. (12,7) BR
4. (12,12) TL
5. (9,9) TL

penaltyTimer counts DOWN each frame using delta-time.
Resets to full interval on ANY line clear.
Game over when penaltyCount >= 5.

---

## 🎨 Visual Style (never change)

- Background: `#0d0d0d`
- Empty triangle: `#1e1e1e`
- Grid diagonal lines: `rgba(255,255,255,0.08)`
- UI text: `#e0e0e0`, font: `'Courier New'`
- Accent/borders: `#c8960c` (gold)
- Penalty: `#ff3300` with red glow
- Active wall arm: border glow in piece color

---

## 📊 Difficulty Table

| Level | Speed (sq/s) | Penalty interval | Piece max size |
|-------|-------------|-----------------|----------------|
| 1     | 2           | 15s             | 2–3 triangles  |
| 2     | 3           | 13s             | 3–4 triangles  |
| 3     | 4           | 11s             | 4–5 triangles  |
| 4     | 5           | 9s              | 5–6 triangles  |
| 5+    | 6           | 7s              | 5–6 triangles  |

Level up every 500 points.

---

## 🚦 Task Execution Order

Implement in this exact order. Add `// DONE: description` at top of each file when complete.

- [ ] 1. `types.ts`    — All interfaces
- [ ] 2. `board.ts`    — Cross board, zones, collision, lock, line clear, gravity
- [ ] 3. `piece.ts`    — Piece definitions, rotation, spawn
- [ ] 4. `score.ts`    — Score, combos, level, speed, penalty interval
- [ ] 5. `renderer.ts` — drawTriangle, drawBoard, drawPiece, drawGhost, drawUI
- [ ] 6. `effects.ts`  — All effect types
- [ ] 7. `input.ts`    — Keyboard, directional gravity logic
- [ ] 8. `game.ts`     — State machine, update, penalty timer, movement, line clear
- [ ] 9. `main.ts`     — Canvas setup, scaling, rAF loop

---

## 🔁 Context Recovery

If resuming after a model switch:
1. `ls src/` — see which files exist
2. Check top of each file for `// DONE:` comment
3. Read `types.ts` to understand current interfaces
4. Continue with next unchecked task above
5. Never re-implement a file already marked DONE

---

## ❌ Hard Rules

- NO `any` types — use proper interfaces or `unknown`
- NO game libraries — Canvas 2D API only
- NO square fills for pieces — every rendered piece cell is a triangle via drawTriangle()
- The diagonal checkerboard pattern MUST be respected everywhere
- Empty cells MUST show the diagonal line (mosaic appearance)
- Piece locking writes individual HalfCells, never full squares
- New files must be added to this CLAUDE.md before creating them

---

## ✅ Current Status

> Update after each completed task:

- [ ] types.ts
- [ ] board.ts
- [ ] piece.ts
- [ ] score.ts
- [ ] renderer.ts
- [ ] effects.ts
- [ ] input.ts
- [ ] game.ts
- [ ] main.ts