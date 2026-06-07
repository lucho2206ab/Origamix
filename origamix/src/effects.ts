import type { Effect, GameState } from "./types.ts";

export function addEffect(state: GameState, e: Effect) {
  // initialize runtime data for particles/ripples
  if (e.type === 'particle') {
    e.data = e.data || {};
    const particles = [] as Array<{x:number,y:number,vx:number,vy:number,size:number}>;
    for (let i=0;i< (e.data?.count as number || 12); i++) {
      const ang = Math.random()*Math.PI*2;
      const speed = 30 + Math.random()*80;
      particles.push({ x: e.x, y: e.y, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, size: 2 + Math.random()*3 });
    }
    e.data.particles = particles;
  }
  if (e.type === 'ripple') {
    e.data = e.data || {};
    e.data.radius = e.data.radius || 10;
    e.data.max = e.data.max || 120;
  }

  state.effects.push(e);
}

export function updateEffects(state: GameState, delta: number) {
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const eff = state.effects[i];
    eff.ttl -= delta;
    // update particle positions
    if (eff.type === 'particle' && eff.data?.particles) {
      for (const p of eff.data.particles) {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.size *= 0.996;
      }
    }
    if (eff.type === 'ripple' && eff.data) {
      eff.data.radius += (eff.data.max / Math.max(0.01, eff.maxTtl)) * (delta * eff.maxTtl);
    }
    if (eff.ttl <= 0) state.effects.splice(i, 1);
  }
}
// Simple effect stubs – real implementations will be added later
export function flashLine() {/* TODO */}
export function ripple() {/* TODO */}
export function shake() {/* TODO */}
export function scorePop() {/* TODO */}
export function burst() {/* TODO */}
