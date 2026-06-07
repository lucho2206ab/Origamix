import type { Piece } from "./types.ts";

export type Handlers = {
  rotate: () => void;
  setWallOrShift: (dir: 'left'|'right'|'top'|'bottom') => void;
  softDrop: () => void;
};

let initialized = false;

export function initInput(h: Handlers) {
  if (initialized) return;
  window.addEventListener('keydown', (ev) => {
    switch (ev.code) {
      case 'Space':
        ev.preventDefault();
        h.rotate();
        break;
      case 'ArrowLeft':
        ev.preventDefault();
        h.setWallOrShift('left');
        break;
      case 'ArrowRight':
        ev.preventDefault();
        h.setWallOrShift('right');
        break;
      case 'ArrowUp':
        ev.preventDefault();
        h.setWallOrShift('top');
        break;
      case 'ArrowDown':
        ev.preventDefault();
        h.setWallOrShift('bottom');
        break;
      case 'KeyS':
        ev.preventDefault();
        h.softDrop();
        break;
    }
  });
  initialized = true;
}

export default initInput;
