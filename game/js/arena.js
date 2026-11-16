// The arena's geometry: per-wave Mirror shard layouts, arena bounds, and pushing bodies out of mirrors and the Core.
import { ARENA_H, ARENA_W, CORE_RADIUS, CORE_X, CORE_Y, TAU } from './config.js';

/** A mirror shard: a reflective segment centred on (cx, cy), `angle` along its length, with its unit normal. */
export function makeMirror(cx, cy, length, angle) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const half = length / 2;
  return {
    cx, cy, length, angle,
    x1: cx - ux * half, y1: cy - uy * half,
    x2: cx + ux * half, y2: cy + uy * half,
    nx: -uy, ny: ux,
    glow: 0,
    born: 0,
  };
}

/** Lays out this wave's mirror shards around the Core: two at first, five by the late waves, never crowding each other. */
export function layoutMirrors(wave, random) {
  const count = Math.min(2 + Math.floor(wave / 3), 5);
  const mirrors = [];
  const ringOffset = random() * TAU;
  for (let tries = 0; mirrors.length < count && tries < 400; tries += 1) {
    const slot = (mirrors.length + random() * 0.6) / count;
    const angle = ringOffset + slot * TAU;
    const distance = 190 + random() * 150;
    const cx = CORE_X + Math.cos(angle) * distance * 1.45;
    const cy = CORE_Y + Math.sin(angle) * distance * 0.92;
    if (cx < 110 || cx > ARENA_W - 110 || cy < 130 || cy > ARENA_H - 140) continue;
    if (mirrors.some((m) => Math.hypot(m.cx - cx, m.cy - cy) < 220)) continue;
    const length = 110 + random() * 50;
    const tilt = angle + Math.PI / 2 + (random() - 0.5) * 1.3;
    mirrors.push(makeMirror(cx, cy, length, tilt));
  }
  return mirrors;
}

/** Keeps a circular body inside the arena. */
export function clampToArena(body, radius) {
  body.x = Math.min(ARENA_W - radius, Math.max(radius, body.x));
  body.y = Math.min(ARENA_H - radius, Math.max(radius, body.y));
}

/** Pushes a circular body off a mirror segment; returns true if it touched. */
export function pushOutOfMirror(body, radius, mirror) {
  const ex = mirror.x2 - mirror.x1;
  const ey = mirror.y2 - mirror.y1;
  const t = Math.max(0, Math.min(1, ((body.x - mirror.x1) * ex + (body.y - mirror.y1) * ey) / (ex * ex + ey * ey)));
  const px = mirror.x1 + ex * t;
  const py = mirror.y1 + ey * t;
  const dx = body.x - px;
  const dy = body.y - py;
  const distance = Math.hypot(dx, dy);
  const reach = radius + 3;
  if (distance >= reach) return false;
  const nx = distance > 1e-6 ? dx / distance : mirror.nx;
  const ny = distance > 1e-6 ? dy / distance : mirror.ny;
  body.x = px + nx * reach;
  body.y = py + ny * reach;
  return true;
}

/** Pushes a circular body off the Core. */
export function pushOutOfCore(body, radius) {
  const dx = body.x - CORE_X;
  const dy = body.y - CORE_Y;
  const distance = Math.hypot(dx, dy) || 1;
  const reach = radius + CORE_RADIUS + 6;
  if (distance >= reach) return;
  body.x = CORE_X + (dx / distance) * reach;
  body.y = CORE_Y + (dy / distance) * reach;
}

