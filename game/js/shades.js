// The Shades: each enemy kind's stats and movement, edge spawning, and which colour of light harms which part of a Shade.
import { ARENA_H, ARENA_W, CORE_X, CORE_Y, TAU, WHITE } from './config.js';

/** Base stats per kind; speed is pixels per second before the wave's speed-up. */
export const SHADE_KINDS = {
  drifter: { label: 'Drifter', radius: 15, hp: 2.0, speed: 44, value: 10, coreDamage: 1 },
  darter: { label: 'Darter', radius: 11, hp: 1.1, speed: 92, value: 15, coreDamage: 1 },
  splitter: { label: 'Splitter', radius: 19, hp: 3.0, speed: 38, value: 20, coreDamage: 2 },
  shard: { label: 'Shard', radius: 9, hp: 0.7, speed: 74, value: 5, coreDamage: 1 },
  prismling: { label: 'Prismling', radius: 14, hp: 2.4, speed: 50, value: 25, coreDamage: 1 },
  bulwark: { label: 'Bulwark', radius: 27, hp: 2.6, speed: 25, value: 60, coreDamage: 3, shellHp: 2.2 },
  eclipse: { label: 'The Eclipse', radius: 60, hp: 1, speed: 0, value: 0, coreDamage: 0 },
};

/** Seconds between a Prismling's colour changes. */
export const PRISMLING_PERIOD = 2;

let nextShadeId = 1;

/** A new Shade of `kind` and `colour` at (x, y); the wave scales its speed and toughness. */
export function createShade(kind, colour, x, y, speedScale = 1, counts = true, toughness = 1) {
  const base = SHADE_KINDS[kind];
  const shade = {
    id: nextShadeId++,
    kind,
    colour,
    baseColour: colour,
    x, y,
    r: base.radius,
    hp: base.hp * toughness,
    maxHp: base.hp * toughness,
    speed: base.speed * speedScale,
    value: base.value,
    coreDamage: base.coreDamage,
    age: 0,
    seed: (x * 7.13 + y * 3.71) % TAU,
    weave: (Math.floor(x + y) & 1) === 0 ? 1 : -1,
    flash: 0,
    dead: false,
    counts,
    shell: null,
    rot: 0,
    spin: 0,
  };
  if (kind === 'bulwark') {
    shade.shell = [0, 1, 2].map((c) => ({ colour: c, hp: base.shellHp * toughness, max: base.shellHp * toughness }));
    shade.spin = 0.55 * shade.weave;
  }
  return shade;
}

/** A point just outside a random arena edge (edges weighted by length). */
export function edgeSpawnPoint(random) {
  const perimeter = 2 * (ARENA_W + ARENA_H);
  let along = random() * perimeter;
  const pad = 36;
  if (along < ARENA_W) return { x: along, y: -pad };
  along -= ARENA_W;
  if (along < ARENA_H) return { x: ARENA_W + pad, y: along };
  along -= ARENA_H;
  if (along < ARENA_W) return { x: along, y: ARENA_H + pad };
  along -= ARENA_W;
  return { x: -pad, y: along };
}

/** Moves every Shade toward the Core in its own pattern; Prismlings cycle colour and Bulwarks spin their shells. */
export function moveShades(shades, dt) {
  for (const shade of shades) {
    if (shade.dead || shade.kind === 'eclipse') continue;
    shade.age += dt;
    shade.flash = Math.max(0, shade.flash - dt);
    const dx = CORE_X - shade.x;
    const dy = CORE_Y - shade.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    let lateral = 0;
    switch (shade.kind) {
      case 'drifter':
        lateral = Math.sin(shade.age * 1.3 + shade.seed) * 0.35;
        break;
      case 'darter':
        lateral = Math.sin(shade.age * 3.4 + shade.seed) > 0 ? 0.95 : -0.95;
        break;
      case 'splitter':
        lateral = Math.sin(shade.age * 0.8 + shade.seed) * 0.2;
        break;
      case 'prismling':
        lateral = 0.8 * shade.weave;
        shade.colour = (shade.baseColour + Math.floor(shade.age / PRISMLING_PERIOD)) % 3;
        break;
      case 'bulwark':
        shade.rot = (shade.rot + shade.spin * dt) % TAU;
        break;
      default:
        break;
    }
    const vx = ux - uy * lateral;
    const vy = uy + ux * lateral;
    const norm = Math.hypot(vx, vy) || 1;
    shade.x += (vx / norm) * shade.speed * dt;
    shade.y += (vy / norm) * shade.speed * dt;
  }
}

/** Which part of a Shade a beam touching (hx, hy) strikes: a Bulwark shell segment index, or -1 for the body or heart. */
export function partStruck(shade, hx, hy) {
  if (!shade.shell) return -1;
  let angle = Math.atan2(hy - shade.y, hx - shade.x) - shade.rot;
  angle = ((angle % TAU) + TAU) % TAU;
  const segment = Math.floor(angle / (TAU / 3)) % 3;
  return shade.shell[segment].hp > 0 ? segment : -1;
}

/** The colour of light that harms this part; WHITE means any light does (white Shades, a Bulwark's bared heart). */
export function harmingColour(shade, part) {
  if (part >= 0) return shade.shell[part].colour;
  if (shade.kind === 'bulwark') return WHITE;
  return shade.colour;
}

/** True when light of `colour` harms that part. */
export function lightHarms(shade, part, colour) {
  const needed = harmingColour(shade, part);
  return needed === WHITE || needed === colour;
}
