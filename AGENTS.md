# Origamix — triangular-grid puzzle game

## Quick start
- `npm run dev` — Vite dev server (HMR)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build
- Entry: `index.html` → `src/main.ts`

## Architecture
- **Canvas 2D only** (no game libraries, no WebGL)
- Vite + TypeScript `^5.5`, target `es2023`, `bundler` module resolution
- Strict tsconfig: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`
- **No test framework** configured
- **No lint/typecheck scripts** in package.json

## File dependency order (build on earlier files)
`types.ts` → `board.ts` → `piece.ts` → `score.ts` → `renderer.ts` → `effects.ts` → `input.ts` → `game.ts` → `main.ts`

## Todo tracking
- Each source file has a `// DONE:` comment at top when complete
- `claude.md` (case-sensitive filename) is the canonical design doc — exhaustive spec of game mechanics and rendering

## Key game mechanics not obvious from names
- **Triangular half-cells**: every board cell has `TL` / `BR` slots; diagonal direction alternates via `(row+col)%2`. Never draw full squares.
- **20×20 virtual grid**, cells outside the cross (5 zones: CENTER, TOP, BOTTOM, LEFT, RIGHT) are `null`.
- **Directional gravity**: arrow key → sets piece `wall` direction → auto-moves toward that wall each frame. Space = rotate 90° CW, S = soft drop.
- **Rotation**: 90° CW with slot flip when destination diagonal differs; wall-kick offsets attempted (7 candidates).
- **Gravity** (after line clear): pulls toward center per zone — TOP cells drop down, BOTTOM cells rise up, LEFT cells slide right, RIGHT cells slide left.
- **Scoring**: 10pts per placement, 100/300/600 for 1/2/3+ lines clear, level up every 500 pts (level = `floor(score/500)+1`).
- **Spawn**: spiral search in CENTER zone; game over if no cell fits.
- **Penalty system** removed from code (CLAUDE.md docs it but it's not implemented).
- Piece rendering uses **internal diagonal** (`(dRow+dCol)%2`), not cell diagonal.

## Dead / unused files
- `src/counter.ts` — Vite template leftover, not imported anywhere
- `src/_placeholder.ts` — empty placeholder, safe to delete
- `src/style.css` — heavy mix of Vite template styles and game styles; most template rules unused by game

## Visual constants
- Canvas: 760×650, cell size = 26px, board offset (20, 100)
- Colors: bg `#0d0d0d`, empty tri `#1e1e1e`, gold accent `#c8960c`, text `#e0e0e0`, penalty glow `#ff3300`
- Font: `'Courier New'` everywhere
- Empty cells always render diagonal lines (`rgba(255,255,255,0.08)`)

## localStorage keys
- `origami_scores` — top 10 JSON array `{name, score, date}[]`
- `origami_player_name` — saved player name string

## CI/CD
- `.github/workflows/opencode.yml` — triggers on issue/PR comments containing `/oc` or `/opencode`
- Uses `opencode/kimi-k2.5-free` model via `anomalyco/opencode/github@latest`

## Commands reference
| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | `vite build` to `dist/` |
| `npm run preview` | `vite preview` production build |
