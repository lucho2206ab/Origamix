// DONE: addTouchControls moved outside step() - was adding listeners every frame
// DONE: virtual dpad buttons replace swipe - touchstart fires key immediately
import "./style.css";
import { initGame, gameLoop, resetGame, getGameState } from "./game";
import { renderTitleScreen } from "./renderer";

let playerName = "";
let gameStarted = false;
let gameOverHandled = false;

function sanitizeName(name: string): string {
  return name.replace(/[<>&"']/g, "").trim().slice(0, 20) || "Jugador";
}

function saveScore(name: string, score: number) {
  const raw = localStorage.getItem("origami_scores");
  const scores: { name: string; score: number; date: string }[] = raw ? JSON.parse(raw) : [];
  scores.push({ name, score, date: new Date().toISOString() });
  scores.sort((a, b) => b.score - a.score);
  if (scores.length > 10) scores.length = 10;
  localStorage.setItem("origami_scores", JSON.stringify(scores));
  updateScoreDisplay();
}

function updateScoreDisplay() {
  const raw = localStorage.getItem("origami_scores");
  const scores: { name: string; score: number }[] = raw ? JSON.parse(raw) : [];
  const el = document.getElementById("high-score");
  if (!el) return;
  el.textContent = scores.length > 0 ? `${scores[0].score} — ${scores[0].name}` : "--";
}

// Restore saved name
const savedName = localStorage.getItem("origami_player_name");
if (savedName) {
  playerName = savedName;
  const input = document.getElementById("player-name") as HTMLInputElement | null;
  if (input) input.value = savedName;
  document.getElementById("name-confirmed")?.classList.add("show");
  const startBtn = document.getElementById("start") as HTMLButtonElement | null;
  if (startBtn) startBtn.disabled = false;
}

function redrawTitleScreen() {
  const canvas = document.querySelector<HTMLCanvasElement>("#game");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx && !gameStarted) renderTitleScreen(ctx, canvas, playerName);
  }
}

// Name OK button
document.getElementById("name-ok")?.addEventListener("click", () => {
  const input = document.getElementById("player-name") as HTMLInputElement | null;
  const name = sanitizeName(input?.value ?? "");
  if (!name) return;
  playerName = name;
  if (input) input.value = name;
  localStorage.setItem("origami_player_name", name);
  document.getElementById("name-confirmed")?.classList.add("show");
  const startBtn = document.getElementById("start") as HTMLButtonElement | null;
  if (startBtn) startBtn.disabled = false;
  redrawTitleScreen();
});

// Enter key submits name
document.getElementById("player-name")?.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    (document.getElementById("name-ok") as HTMLButtonElement | null)?.click();
  }
});

// START button
document.getElementById("start")?.addEventListener("click", () => {
  if (gameStarted) return;
  const input = document.getElementById("player-name") as HTMLInputElement | null;
  playerName = sanitizeName(input?.value ?? "");
  gameStarted = true;
  const startEl = document.getElementById("start");
  const nameGroup = document.getElementById("name-group");
  const nameDisplay = document.getElementById("player-name-display");
  const resetEl = document.getElementById("reset");
  if (startEl) startEl.style.display = "none";
  if (nameGroup) nameGroup.style.display = "none";
  if (nameDisplay) { nameDisplay.textContent = `Jugador: ${playerName}`; nameDisplay.style.display = ""; }
  if (resetEl) resetEl.style.display = "";
  fitCanvas();
  initGame();
});

// Reset / New Game
document.getElementById("reset")?.addEventListener("click", () => {
  resetGame();
  gameOverHandled = false;
});

function fitCanvas() {
  const canvas = document.querySelector<HTMLCanvasElement>("#game");
  if (!canvas) return;
  const availW = window.innerWidth - 32;
  const availH = window.innerHeight - 130;
  const scale = Math.min(1, availW / 760, availH / 650);
  canvas.style.width = `${760 * scale}px`;
  canvas.style.height = `${650 * scale}px`;
}

updateScoreDisplay();
fitCanvas();
window.addEventListener("resize", fitCanvas);

// Draw initial title screen
const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (canvas) {
  const ctx = canvas.getContext("2d");
  if (ctx) renderTitleScreen(ctx, canvas, playerName);
}

function returnToTitle() {
  gameStarted = false;
  gameOverHandled = false;
  const startEl = document.getElementById("start");
  const nameGroup = document.getElementById("name-group");
  const nameDisplay = document.getElementById("player-name-display");
  const resetEl = document.getElementById("reset");
  if (startEl) startEl.style.display = "";
  if (nameGroup) nameGroup.style.display = "";
  if (nameDisplay) nameDisplay.style.display = "none";
  if (resetEl) resetEl.style.display = "none";
  fitCanvas();
  redrawTitleScreen();
}

// ── Mobile virtual D-pad controls ─────────────────────────────────────
// This must be OUTSIDE step() so it only runs ONCE on page load
(function addTouchControls() {
  function fireKey(code: string): void {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code,
        key: code === 'Space' ? ' ' : code,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  const buttons: { id: string; code: string }[] = [
    { id: 'btn-up',     code: 'ArrowUp'    },
    { id: 'btn-down',   code: 'ArrowDown'  },
    { id: 'btn-left',   code: 'ArrowLeft'  },
    { id: 'btn-right',  code: 'ArrowRight' },
    { id: 'btn-rotate', code: 'Space'      },
  ];

  for (const { id, code } of buttons) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      fireKey(code);
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
    }, { passive: false });

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      fireKey(code);
    });

    btn.addEventListener('mouseup', () => {
      btn.classList.remove('pressed');
    });
  }

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (canvas) {
    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
      if (dx < 8 && dy < 8) fireKey('Space');
    }, { passive: false });
  }
})();

// ── Game loop ──────────────────────────────────────────────────────────
function step(timestamp: number) {
  if (!gameStarted) { requestAnimationFrame(step); return; }

  gameLoop(timestamp);
  const gs = getGameState();

  if (gs.status === "gameover" && !gameOverHandled) {
    gameOverHandled = true;
    saveScore(playerName, gs.score);
    if (gs.inactivityGameOver) {
      returnToTitle();
      return;
    }
  }

  if (gs.status === "playing") gameOverHandled = false;

  requestAnimationFrame(step);
}

requestAnimationFrame(step);
