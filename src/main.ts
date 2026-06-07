import "./style.css";
import { initGame, gameLoop } from "./game";

// Initialize the game and start the animation loop
initGame();
requestAnimationFrame(function step(timestamp) {
  gameLoop(timestamp);
  requestAnimationFrame(step);
});
