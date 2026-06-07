import type { GameState, BoardCell, DiagonalDir, TriSlot } from "./types.ts";

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  S: number,
  diag: DiagonalDir,
  slot: TriSlot,
  color: string,
  alpha: number = 1
) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.fillStyle = color;
  if (diag === '\\') {
    if (slot === 'TL') {
      ctx.moveTo(px, py);
      ctx.lineTo(px + S, py);
      ctx.lineTo(px, py + S);
    } else {
      ctx.moveTo(px + S, py);
      ctx.lineTo(px + S, py + S);
      ctx.lineTo(px, py + S);
    }
  } else {
    if (slot === 'TL') {
      ctx.moveTo(px, py);
      ctx.lineTo(px + S, py);
      ctx.lineTo(px + S, py + S);
    } else {
      ctx.moveTo(px, py);
      ctx.lineTo(px + S, py + S);
      ctx.lineTo(px, py + S);
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

function drawDiagonalLine(ctx: CanvasRenderingContext2D, px: number, py: number, S: number, diag: DiagonalDir) {
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  if (diag === '\\') {
    ctx.moveTo(px, py); ctx.lineTo(px + S, py + S);
  } else {
    ctx.moveTo(px + S, py); ctx.lineTo(px, py + S);
  }
  ctx.stroke();
}

export function render(state: GameState) {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rows = state.board.length;
  const cols = state.board[0].length;
  const S = 26; // cell size
  const boardX = 20;
  const boardY = 100;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid cells (diagonals + halves)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = state.board[r][c];
      if (!cell) continue;
      const px = boardX + c * S;
      const py = boardY + r * S;
      // empty halves
      drawTriangle(ctx, px, py, S, cell.diag, 'TL', '#1e1e1e');
      drawTriangle(ctx, px, py, S, cell.diag, 'BR', '#1e1e1e');
      drawDiagonalLine(ctx, px, py, S, cell.diag);
      // filled halves
      if (cell.TL.filled) {
        ctx.shadowColor = cell.TL.color;
        ctx.shadowBlur = cell.TL.isPenalty ? 18 : 10;
        drawTriangle(ctx, px, py, S, cell.diag, 'TL', cell.TL.color);
        ctx.shadowBlur = 0;
      }
      if (cell.BR.filled) {
        ctx.shadowColor = cell.BR.color;
        ctx.shadowBlur = cell.BR.isPenalty ? 18 : 10;
        drawTriangle(ctx, px, py, S, cell.diag, 'BR', cell.BR.color);
        ctx.shadowBlur = 0;
      }
    }
  }

  // Draw active piece
  const p = state.currentPiece;
  if (p) {
    ctx.shadowColor = p.shape.color;
    ctx.shadowBlur = 16;
    for (const t of p.triangles) {
      const r = p.anchorRow + t.dRow;
      const c = p.anchorCol + t.dCol;
      const cell = state.board[r] && state.board[r][c];
      if (!cell) continue;
      const px = boardX + c * S;
      const py = boardY + r * S;
      drawTriangle(ctx, px, py, S, cell.diag, t.slot, p.shape.color, 1);
    }
    ctx.shadowBlur = 0;
  }

  // UI
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '16px Courier New';
  ctx.fillText(`Puntaje: ${state.score}`, 20, 36);
  ctx.fillText(`Nivel: ${state.level}`, 180, 36);
  ctx.fillText(`Líneas: ${state.linesCleared}`, 320, 36);

  // effects (simple)
  if (state.effects && state.effects.length) {
    for (const eff of state.effects) {
      const a = Math.max(0, eff.ttl / eff.maxTtl);
      if (eff.type === 'popup') {
        ctx.globalAlpha = a;
        ctx.fillStyle = eff.color;
        ctx.font = 'bold 20px Courier New';
        ctx.fillText(eff.data?.text as string || '!', eff.x, eff.y - (1 - a) * 40);
        ctx.globalAlpha = 1;
      }
      if (eff.type === 'flash') {
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = eff.color;
        ctx.fillRect(boardX, boardY, cols * S, rows * S);
        ctx.globalAlpha = 1;
      }
    }
  }
  // draw particles and ripples
  if (state.effects && state.effects.length) {
    for (const eff of state.effects) {
      const a = Math.max(0, eff.ttl / eff.maxTtl);
      if (eff.type === 'particle' && eff.data?.particles) {
        for (const p of eff.data.particles) {
          ctx.globalAlpha = Math.max(0, a * 0.9);
          ctx.fillStyle = eff.color || '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.8, p.size), 0, Math.PI*2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (eff.type === 'ripple' && eff.data) {
        const r = eff.data.radius || 10;
        ctx.beginPath();
        ctx.strokeStyle = eff.color || 'rgba(122,252,255,0.5)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.max(0, (eff.ttl / eff.maxTtl));
        ctx.arc(eff.x, eff.y, r, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (eff.type === 'penalty') {
        ctx.globalAlpha = Math.max(0, eff.ttl / eff.maxTtl);
        ctx.fillStyle = eff.color || '#ff3300';
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, 18, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}
