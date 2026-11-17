// The wave director: the ten-wave plan, each wave's spawn queue (kind, colour, edge, timing), its progress and when it is cleared.
import { WHITE, ARENA_W, ARENA_H, TOTAL_WAVES } from './config.js';
import { DIFFICULTIES, WAVE_TABLE } from './rules.js';
import { createShade, edgeSpawnPoint } from './shades.js';
import { createEclipse } from './boss.js';
import { layoutMirrors } from './arena.js';
import { simRandom, simShuffle } from './random.js';



/** The run's goal as the HUD states it: hold the waves, then break THE ECLIPSE on the last one to win. */
export function waveGoalText(wave) {
  const left = TOTAL_WAVES - wave;
  return left > 0 ? `${left} WAVE${left > 1 ? 'S' : ''} TO THE ECLIPSE` : 'BREAK THE ECLIPSE';
}

/** A wave is cleared when nothing is left to spawn and no Shade (or boss) remains. */
export function isWaveCleared(world) {
  const director = world.director;
  return director.queue.length === 0 && director.bossDue <= 0 && world.shades.every((shade) => shade.dead);
}

/** Shade speed multiplier for a wave. */
export function waveSpeedScale(wave) {
  return 1 + 0.045 * (wave - 1);
}

/** Shade health multiplier for a wave. */
export function waveToughness(wave) {
  return 1 + 0.05 * (wave - 1);
}

/** Begins wave `number` (1-based): new mirror layout, a shuffled spawn queue, and the boss on wave 10. */
export function startWave(world, number) {
  const plan = WAVE_TABLE[number - 1];
  world.wave = number;
  const difficulty = DIFFICULTIES.find((d) => d.id === world.difficulty);
  world.speedScale = waveSpeedScale(number) * difficulty.speed;
  world.toughness = waveToughness(number);
  world.mirrors = layoutMirrors(number, simRandom);
  const kinds = [];
  for (const [kind, count] of Object.entries(plan.mix)) for (let i = 0; i < Math.max(1, Math.round(count * difficulty.count)); i += 1) kinds.push(kind);
  simShuffle(kinds);
  const queue = kinds.map((kind, index) => ({
    kind,
    colour: plan.white > 0 && simRandom() < plan.white && kind !== 'bulwark' ? WHITE : pickColour(plan.colours, index),
    pack: index > 0 && simRandom() < 0.28,
  }));
  world.director = {
    plan,
    queue,
    timer: 1.6,
    total: queue.length + (plan.boss ? 1 : 0),
    defeated: 0,
    lastPoint: null,
    bossDue: plan.boss ? 2.5 : -1,
    elapsed: 0,
  };
}

/** Early waves alternate colours in runs so a new player meets one colour at a time. */
function pickColour(colours, index) {
  if (colours.length === 1) return colours[0];
  if (colours.length === 2) return colours[Math.floor(index / 3) % 2];
  return colours[Math.floor(simRandom() * colours.length)];
}

/** Releases queued Shades as their time comes; packs arrive together from one edge. Spawns quicken as the wave goes on. */
export function updateDirector(world, dt) {
  const director = world.director;
  director.elapsed += dt;
  if (director.bossDue > 0) {
    director.bossDue -= dt;
    if (director.bossDue <= 0) {
      world.boss = createEclipse();
      world.shades.push(world.boss);
      world.events.push({ type: 'boss' });
    }
  }
  if (director.queue.length === 0) return;
  director.timer -= dt;
  if (director.timer > 0) return;
  const entry = director.queue.shift();
  const point = entry.pack && director.lastPoint ? nearbyEdgePoint(director.lastPoint) : edgeSpawnPoint(simRandom);
  director.lastPoint = point;
  world.shades.push(createShade(entry.kind, entry.colour, point.x, point.y, world.speedScale, true, world.toughness));
  const progress = 1 - director.queue.length / Math.max(1, director.total);
  const next = director.queue[0];
  director.timer = next && next.pack ? 0.22 : director.plan.gap * (1.15 - 0.4 * progress) * (0.75 + simRandom() * 0.5);
}

function nearbyEdgePoint(point) {
  const shift = (simRandom() - 0.5) * 120;
  const onSide = point.x < 0 || point.x > ARENA_W;
  return {
    x: onSide ? point.x : Math.min(ARENA_W, Math.max(0, point.x + shift)),
    y: onSide ? Math.min(ARENA_H, Math.max(0, point.y + shift)) : point.y,
  };
}

/** Share of this wave's Shades already dealt with, 0..1. */
export function waveProgress(world) {
  const director = world.director;
  if (!director) return 0;
  return Math.min(1, director.defeated / Math.max(1, director.total));
}

/** What this wave still has to send, by kind: [{kind, count, colours}] with the most numerous first (the boss last). */
export function incomingByKind(world) {
  const director = world.director;
  const byKind = new Map();
  for (const entry of director.queue) {
    const row = byKind.get(entry.kind) ?? { kind: entry.kind, count: 0, colours: new Set() };
    row.count += 1;
    row.colours.add(entry.colour);
    byKind.set(entry.kind, row);
  }
  const rows = [...byKind.values()].sort((a, b) => b.count - a.count);
  if (director.bossDue > 0) rows.push({ kind: 'eclipse', count: 1, colours: new Set([0]) });
  return rows;
}
