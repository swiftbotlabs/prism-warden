// The wave director: the ten-wave plan, each wave's spawn queue (kind, colour, edge, timing), its progress and when it is cleared.
import { EMBER, VERDANT, AZURE, WHITE, ARENA_W, ARENA_H } from './config.js';
import { createShade, edgeSpawnPoint } from './shades.js';
import { createEclipse } from './boss.js';
import { layoutMirrors } from './arena.js';
import { simRandom, simShuffle } from './random.js';

const ALL = [EMBER, VERDANT, AZURE];

/** Ten waves: who comes, which colours, the gap between spawns, the chance of a white Shade, and the first-time hint. */
export const WAVE_PLAN = [
  { title: 'First Light', mix: { drifter: 8 }, colours: [EMBER], gap: 1.5, white: 0,
    hint: 'Hold the left mouse button to cast light. Ember (1) burns red Shades.' },
  { title: 'Two Hues', mix: { drifter: 14 }, colours: [EMBER, VERDANT], gap: 1.15, white: 0,
    hint: 'Press 2 (or scroll) for Verdant. Only light of a Shade\'s own colour harms it.' },
  { title: 'Darters', mix: { drifter: 10, darter: 9 }, colours: ALL, gap: 0.95, white: 0,
    hint: 'Azure is 3. Darters zig-zag fast. Bounce light off mirror shards to reach them.' },
  { title: 'Splitters', mix: { drifter: 9, darter: 8, splitter: 5 }, colours: ALL, gap: 0.95, white: 0,
    hint: 'Splitters burst into two small Shades of the other colours.' },
  { title: 'Prismlings', mix: { drifter: 9, darter: 9, splitter: 4, prismling: 6 }, colours: ALL, gap: 0.86, white: 0.08,
    hint: 'Prismlings change colour every 2 s. White Shades fall to any light.' },
  { title: 'Bulwarks', mix: { drifter: 10, darter: 10, splitter: 5, prismling: 6, bulwark: 3 }, colours: ALL, gap: 0.8, white: 0.08,
    hint: 'Break one Bulwark shell segment with its colour, then hit its heart through the gap.' },
  { title: 'Converging Dark', mix: { drifter: 13, darter: 13, splitter: 7, prismling: 7, bulwark: 4 }, colours: ALL, gap: 0.72, white: 0.1 },
  { title: 'Storm of Hues', mix: { drifter: 14, darter: 15, splitter: 8, prismling: 9, bulwark: 4 }, colours: ALL, gap: 0.66, white: 0.1 },
  { title: 'The Last Dusk', mix: { drifter: 15, darter: 17, splitter: 9, prismling: 10, bulwark: 5 }, colours: ALL, gap: 0.62, white: 0.1 },
  { title: 'THE ECLIPSE', mix: { drifter: 10, darter: 8, prismling: 4 }, colours: ALL, gap: 2.4, white: 0.15, boss: true,
    hint: 'Match the Eclipse\'s colour to break its phases. Survive all three.' },
];

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
  const plan = WAVE_PLAN[number - 1];
  world.wave = number;
  world.speedScale = waveSpeedScale(number);
  world.toughness = waveToughness(number);
  world.mirrors = layoutMirrors(number, simRandom);
  const kinds = [];
  for (const [kind, count] of Object.entries(plan.mix)) for (let i = 0; i < count; i += 1) kinds.push(kind);
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

/** A wave is cleared when nothing is left to spawn and no Shade (or boss) remains. */
export function waveCleared(world) {
  const director = world.director;
  return director.queue.length === 0 && director.bossDue <= 0 && world.shades.every((shade) => shade.dead);
}
