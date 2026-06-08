import "./style.css";
import { initGame, gameLoop, resetGame, getGameState } from "./game";
import { renderTitleScreen } from "./renderer";

let playerName = "";
let gameStarted = false;
let gameOverHandled = false;

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

// Name OK button
document.getElementById("name-ok")?.addEventListener("click", () => {
  const input = document.getElementById("player-name") as HTMLInputElement | null;
  const name = input?.value?.trim();
  if (!name) return;
  playerName = name;
  localStorage.setItem("origami_player_name", name);
  document.getElementById("name-confirmed")?.classList.add("show");
  const startBtn = document.getElementById("start") as HTMLButtonElement | null;
  if (startBtn) startBtn.disabled = false;
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
  if (!playerName) {
    const input = document.getElementById("player-name") as HTMLInputElement | null;
    playerName = input?.value?.trim() || "Jugador";
  }
  gameStarted = true;
  const startEl = document.getElementById("start");
  const nameGroup = document.getElementById("name-group");
  const nameDisplay = document.getElementById("player-name-display");
  const resetEl = document.getElementById("reset");
  if (startEl) startEl.style.display = "none";
  if (nameGroup) nameGroup.style.display = "none";
  if (nameDisplay) { nameDisplay.textContent = `Jugador: ${playerName}`; nameDisplay.style.display = ""; }
  if (resetEl) resetEl.style.display = "";
  initGame();
});

// Reset / New Game
document.getElementById("reset")?.addEventListener("click", () => {
  resetGame();
  gameOverHandled = false;
});

updateScoreDisplay();

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
  const canvas = document.querySelector<HTMLCanvasElement>("#game");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx) renderTitleScreen(ctx, canvas, playerName);
  }
}

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
