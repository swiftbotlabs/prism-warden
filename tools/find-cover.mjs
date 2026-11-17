// Finds the cover frame offline: plays many autopilot runs in Node with the game's own rules, scores every step, and writes
// the best seed and step into shots.json for 1-play.jpg (the game's ?shot=play replays exactly that step in the browser).
// Usage: node tools/find-cover.mjs [boss|wave] [runs] [--any-phase] [--loose] [--write]   (modes: boss | teach | wave)
import { readFileSync, writeFileSync } from 'node:fs';
import { ARENA_H, ARENA_W, CORE_RADIUS, CORE_X, CORE_Y, WHITE } from '../game/js/config.js';
import { createPilot } from '../game/js/autopilot.js';
import { playUntil } from '../game/js/shots.js';
import { clearEffects, floatersNear } from '../game/js/particles.js';
import { harmingColour, lightHarmsShade } from '../game/js/shades.js';
import { BOSS_PHASES } from '../game/js/rules.js';
import { incomingByKind } from '../game/js/waves.js';
import { UPGRADES } from '../game/js/upgrades.js';
import { comboMultiplier } from '../game/js/world.js';

const mode = process.argv[2] ?? 'boss';
const runs = Number(process.argv[3] ?? 300);
const REACTION = 0.3;

/** The screen areas the HUD covers this frame ({x, y, w, h}), so screenshots can keep Shades out from under panels. */
function hudPanelRects(world) {
  const rects = [
    { x: 16, y: 14, w: 320, h: 90 },
    { x: ARENA_W / 2 - 180, y: 14, w: 360, h: 90 },
    { x: ARENA_W / 2 - 290, y: 108, w: 580, h: 36 },
    { x: ARENA_W - 316, y: 14, w: 300, h: 80 },
    { x: ARENA_W / 2 - 220, y: ARENA_H - 107, w: 440, h: 30 },
    { x: ARENA_W / 2 - 238, y: ARENA_H - 62, w: 476, h: 46 },
    { x: ARENA_W - 392, y: ARENA_H - 74, w: 376, h: 66 },
  ];
  if (world.log.some((entry) => world.time - entry.time < 5)) rects.push({ x: 16, y: 112, w: 330, h: 90 });
  if (world.director && world.state === 'fight') {
    const rows = Math.max(1, Math.min(6, incomingByKind(world).length));
    rects.push({ x: ARENA_W - 252, y: 102, w: 236, h: 40 + rows * 28 });
  }
  const owned = UPGRADES.filter((upgrade) => world.upgrades[upgrade.id] > 0).length;
  if (owned > 0) {
    const rows = Math.ceil(owned / 3);
    rects.push({ x: 16, y: ARENA_H - 46 - (rows - 1) * 34 - 22, w: 3 * 122, h: (rows - 1) * 34 + 52 });
  }
  if (world.boss && !world.boss.dead) rects.push({ x: ARENA_W / 2 - 250, y: 150, w: 500, h: 46 });
  return rects;
}

/** Minions in clear view (away from the edges and the boss's glow), their colours and kinds. */
function visibleMinions(world) {
  const boss = world.boss && !world.boss.dead ? world.boss : null;
  return world.shades.filter((s) => !s.dead && s.kind !== 'eclipse' && s.kind !== 'umbra' && s.x > 30 && s.x < 1250 && s.y > 110 && s.y < 690
    && (!boss || Math.hypot(s.x - boss.x, s.y - boss.y) > boss.r + 40));
}

/** Nothing important under the HUD: no Shade centred under a panel, the Warden away from the edges. */
function framedClear(world) {
  const rects = hudPanelRects(world);
  const under = (x, y) => rects.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const { x, y } = world.warden;
  return !world.shades.some((s) => !s.dead && under(s.x, s.y)) && !under(x, y) && y > 160 && y < 660 && x > 80 && x < 1200;
}

/** Colours of minions harmed by the Prism branches (not the main beam). */
function branchStrikes(world) {
  const colours = new Set();
  for (const beam of world.beams.slice(1)) {
    for (const hit of beam.hits) {
      if (hit.shade.kind !== 'eclipse' && !hit.shade.dead && lightHarmsShade(hit.shade, hit.part, beam.colour)) colours.add(hit.shade.colour);
    }
  }
  return colours;
}

/** How many frames each cover rule rejected, printed with the result so the binding rule is visible. */
const rejected = {};
function reject(reason) {
  rejected[reason] = (rejected[reason] ?? 0) + 1;
  return -1;
}

/** Distance from (x, y) to a beam's polyline. */
function distanceToBeam(beam, x, y) {
  let best = Infinity;
  for (let i = 2; i < beam.points.length; i += 2) {
    const [ax, ay, bx, by] = [beam.points[i - 2], beam.points[i - 1], beam.points[i], beam.points[i + 1]];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
    best = Math.min(best, Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t));
  }
  return best;
}

const ANY_PHASE = process.argv.includes('--any-phase');

function bossDrama(world) {
  const boss = world.boss;
  if (world.state !== 'fight' || world.banner || !boss || boss.dead || boss.entering > 0 || world.director.elapsed < 15) return -1;
  const health = (BOSS_PHASES.length - 1 - boss.phase + boss.hp / boss.maxHp) / BOSS_PHASES.length;
  const main = world.beams[0];
  if (!main || main.colour !== boss.colour || !main.hits.some((hit) => hit.shade === boss)) return reject('warden not casting the boss colour into it');
  if (!ANY_PHASE && (health < 0.3 || health > 0.7)) return reject('boss health outside 30-70%');
  if (world.core.hp < world.core.maxHp * (10 / 12)) return reject('Core below 10/12');
  if (comboMultiplier(world) < 3) return reject('multiplier below x3');
  // The boss in the middle 60% of the arena, with open floor between it and the Core.
  if (boss.x < ARENA_W * 0.2 || boss.x > ARENA_W * 0.8 || boss.y < ARENA_H * 0.2 || boss.y > ARENA_H * 0.8) return reject('boss outside the middle 60%');
  const coreGap = Math.hypot(boss.x - CORE_X, boss.y - CORE_Y) - boss.r - CORE_RADIUS;
  if (coreGap < 140) return reject('boss too close to the Core');
  // The threat: a Shadow Ring burst in flight, or the ring tightening.
  const orbs = world.shades.filter((s) => s.kind === 'umbra' && !s.dead && s.x > 0 && s.x < ARENA_W && s.y > 0 && s.y < ARENA_H).length;
  if (orbs < 4 && boss.charging <= 0) return reject('no Shadow Ring threat');
  // The response: Prism branches bouncing at least twice and harming creatures of the other colours.
  const branchBounces = world.beams.slice(1).reduce((sum, beam) => sum + beam.bounces.length / 2, 0);
  const struck = [...branchStrikes(world)].filter((c) => c !== boss.colour);
  if (world.beams.length < 2 || branchBounces < 2 || struck.length < 1) return reject('branches not bouncing into other colours');
  // The battle: at least 8 creatures on screen in two or more colours, some close to the beams.
  const creatures = world.shades.filter((s) => !s.dead && s.kind !== 'eclipse' && s.age > 0.35 && s.x > 25 && s.x < ARENA_W - 25 && s.y > 25 && s.y < ARENA_H - 25
    && Math.hypot(s.x - boss.x, s.y - boss.y) > boss.r * 1.3);
  const colours = new Set(creatures.map((s) => s.colour).filter((c) => c !== WHITE)).size;
  const nearBeams = creatures.filter((s) => world.beams.some((beam) => distanceToBeam(beam, s.x, s.y) < 250)).length;
  if (creatures.length < 8) return reject('fewer than 8 creatures on screen');
  if (colours < 2 || nearBeams < 3) return reject('creatures not in two colours near the beams');
  const popups = floatersNear(CORE_X, CORE_Y, 2000);
  if (floatersNear(boss.x, boss.y, boss.r) > 0) return reject('popup over the boss face');
  if (!framedClear(world)) return reject('something under the HUD');
  // A clear triangle: boss, Warden and Core apart, with open floor on every side.
  const w = world.warden;
  const shortest = Math.min(Math.hypot(w.x - boss.x, w.y - boss.y) - boss.r, Math.hypot(w.x - CORE_X, w.y - CORE_Y) - CORE_RADIUS, coreGap);
  if (shortest < 70) return reject('no clear boss-Warden-Core triangle');
  return Math.min(creatures.length, 16) * 2 + colours * 4 + nearBeams + struck.length * 6 + Math.min(branchBounces, 4) * 3 + world.beams.length * 3
    + (popups === 1 ? 4 : 0) + (world.core.hp / world.core.maxHp) * 8 + Math.min(orbs, 10) + (boss.charging > 0 ? 6 : 0)
    + Math.min(shortest, 260) / 15 + Math.min(comboMultiplier(world), 6) * 2;
}

function waveDrama(world) {
  if (world.wave !== 8 || world.state !== 'fight' || world.banner || world.combo < 10 || world.beams.length < 3) return -1;
  const minions = visibleMinions(world);
  const popups = floatersNear(CORE_X, CORE_Y, 2000);
  const colours = new Set(minions.map((s) => s.colour).filter((c) => c !== WHITE)).size;
  if (branchStrikes(world).size < 1 || colours < 3 || popups < 1 || popups > 2 || !framedClear(world)) return -1;
  const bounces = world.beams.reduce((sum, beam) => sum + beam.bounces.length / 2, 0);
  return Math.min(minions.length, 12) + Math.min(bounces, 4) * 3 + (world.core.hp / world.core.maxHp) * 10;
}

/** A teaching frame: the Prism split sends all three colours, each beam harming a creature of its own colour, and one
 * beam glancing off a creature of another colour (the game tags it WRONG COLOUR). `--loose` lets one beam be the glancing one. */
const LOOSE = process.argv.includes('--loose');
function teachDrama(world) {
  if (world.state !== 'fight' || world.banner || world.beams.length < 3) return -1;
  const own = (beam) => beam.hits.some((hit) => !hit.shade.dead && harmingColour(hit.shade, hit.part) === beam.colour);
  const glancing = (beam) => beam.hits.some((hit) => !hit.shade.dead && !lightHarmsShade(hit.shade, hit.part, beam.colour));
  const owners = world.beams.filter(own).length;
  if (owners < (LOOSE ? 2 : 3)) return reject('beams not each hitting their own colour');
  if (!world.beams.some(glancing)) return reject('no beam glancing off another colour');
  const creatures = world.shades.filter((s) => !s.dead && s.kind !== 'umbra' && s.age > 0.35 && s.x > 25 && s.x < ARENA_W - 25 && s.y > 25 && s.y < ARENA_H - 25);
  if (creatures.length < 6) return reject('fewer than 6 creatures');
  if (world.core.hp < world.core.maxHp * 0.6) return reject('Core below 60%');
  if (!framedClear(world)) return reject('something under the HUD');
  const boss = world.boss && !world.boss.dead ? 12 : 0;
  return Math.min(creatures.length, 14) * 2 + new Set(creatures.map((s) => s.kind)).size * 3 + owners * 5 + boss
    + Math.min(comboMultiplier(world), 6) * 2 + (world.core.hp / world.core.maxHp) * 6;
}

const drama = mode === 'boss' ? bossDrama : mode === 'teach' ? teachDrama : waveDrama;
const done = mode === 'boss' ? (w) => w.wave === 10 && w.boss && w.boss.dead : mode === 'teach' ? (w) => w.state === 'won' : (w) => w.wave > 8;
const focus = mode !== 'wave';
let best = { seed: 0, step: -1, score: 0 };
for (let n = 0; n < runs; n += 1) {
  const seed = 7 + n * 101;
  clearEffects();
  playUntil(seed, (world, step) => {
    const score = drama(world);
    if (score > best.score) best = { seed, step, score, world: { creatures: world.shades.filter((x) => !x.dead && x.kind !== 'eclipse' && x.age > 0.35 && x.x > 25 && x.x < ARENA_W - 25 && x.y > 25 && x.y < ARENA_H - 25 && (!world.boss || Math.hypot(x.x - world.boss.x, x.y - world.boss.y) > world.boss.r * 1.3)).length, multiplier: comboMultiplier(world), core: `${Math.ceil(world.core.hp)}/${world.core.maxHp}` } };
    return done(world);
  }, createPilot(REACTION, 0, focus));
}
console.log('rejected by rule:', JSON.stringify(rejected));
if (best.step < 0) {
  console.log(`no ${mode} frame passed`);
  process.exit(1);
}
const query = `?shot=play&seed=${best.seed}&step=${best.step}&reaction=${REACTION}${focus ? '&focus=1' : ''}`;
if (best.world) console.log(`frame: ${best.world.creatures} creatures, x${best.world.multiplier}, Core ${best.world.core}`);
console.log(`best ${mode} frame: score ${best.score.toFixed(1)} ${query}`);
if (process.argv.includes('--write')) {
  const path = new URL('../shots.json', import.meta.url);
  const shots = JSON.parse(readFileSync(path, 'utf8'));
  shots.find((shot) => shot.name === '1-play.jpg').query = query;
  writeFileSync(path, JSON.stringify(shots, null, 2) + '\n');
}
