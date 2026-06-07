export function speedForLevel(level: number): number {
  // slightly more responsiveness and smoother scaling
  if (level <= 1) return 2.5;
  if (level === 2) return 3.5;
  if (level === 3) return 4.5;
  if (level === 4) return 5.5;
  return 6.5;
}

export function penaltyIntervalForLevel(level: number): number {
  if (level <= 1) return 15;
  if (level === 2) return 13;
  if (level === 3) return 11;
  if (level === 4) return 9;
  return 7;
}

export function maxPieceSizeForLevel(level: number): number {
  if (level === 1) return 3;
  if (level === 2) return 4;
  if (level === 3) return 5;
  return 6;
}
export function addScore(state: any, points: number): void {
  state.score += points;
}

export function softDropIncrement(level: number): number {
  // how many cell-steps a soft drop triggers per press
  return Math.max(1, Math.floor(speedForLevel(level) * 1.5));
}
