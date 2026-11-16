// Finds the cover frame offline: plays many autopilot runs in Node with the game's own rules, scores every step, and writes
// the best seed and step into shots.json for 1-play.jpg (the game's ?shot=play replays exactly that step in the browser).
// Usage: node tools/find-cover.mjs [boss|wave] [runs]
import { readFileSync, writeFileSync } from 'node:fs';
import { ARENA_H, ARENA_W, CORE_X, CORE_Y, WHITE } from '../game/js/config.js';
import { createPilot } from '../game/js/autopilot.js';
import { playUntil } from '../game/js/shots.js';
import { clearEffects, floatersNear } from '../game/js/particles.js';
import { lightHarmsShade } from '../game/js/shades.js';
import { ECLIPSE_PHASES } from '../game/js/boss.js';
import { incomingByKind } from '../game/js/waves.js';
import { UPGRADES } from '../game/js/upgrades.js';

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
    { x: ARENA_W - 300, y: ARENA_H - 34, w: 284, h: 24 },
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

function bossDrama(world) {
  const boss = world.boss;
  if (world.state !== 'fight' || world.banner || !boss || boss.dead || boss.entering > 0 || world.director.elapsed < 15 || world.combo < 5) return -1;
  const health = (ECLIPSE_PHASES.length - 1 - boss.phase + boss.hp / boss.maxHp) / ECLIPSE_PHASES.length;
  const main = world.beams[0];
  if (health < 0.35 || health > 0.65 || world.core.hp < world.core.maxHp * 0.5 || !main || main.colour !== boss.colour || !main.hits.some((hit) => hit.shade === boss)) return -1;
  const bounces = world.beams.reduce((sum, beam) => sum + beam.bounces.length / 2, 0);
  const struck = branchStrikes(world);
  if (world.beams.length < 2 || bounces < 2 || struck.size < 1) return -1;
  const popups = floatersNear(CORE_X, CORE_Y, 2000);
  const minions = visibleMinions(world);
  const colours = new Set(minions.map((s) => s.colour).filter((c) => c !== WHITE)).size;
  if (popups < 1 || popups > 2 || minions.length < 4 || colours < 2 || !framedClear(world)) return -1;
  if (boss.y > 600 || boss.x < 140 || boss.x > 1140 || boss.y < 230) return -1;
  if (world.shades.some((s) => s !== boss && !s.dead && Math.abs(s.x - boss.x) < 80 && Math.abs(s.y - boss.y - boss.r - 34) < 22)) return -1;
  const orbs = world.shades.filter((s) => s.kind === 'umbra' && !s.dead && s.x > 0 && s.x < ARENA_W && s.y > 0 && s.y < ARENA_H).length;
  return Math.min(minions.length, 12) * 2 + colours * 4 + struck.size * 5 + Math.min(bounces, 4) * 3 + world.beams.length * 4
    + (popups === 1 ? 6 : 0) + (world.core.hp / world.core.maxHp) * 10 + Math.min(orbs, 8) * 2.5 + Math.min(world.combo, 20) / 2
    + (1 - Math.abs(health - 0.5)) * 6;
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

const drama = mode === 'boss' ? bossDrama : waveDrama;
const done = mode === 'boss' ? (w) => w.wave === 10 && w.boss && w.boss.dead : (w) => w.wave > 8;
const focus = mode === 'boss';
let best = { seed: 0, step: -1, score: 0 };
for (let n = 0; n < runs; n += 1) {
  const seed = 7 + n * 101;
  clearEffects();
  playUntil(seed, (world, step) => {
    const score = drama(world);
    if (score > best.score) best = { seed, step, score };
    return done(world);
  }, createPilot(REACTION, 0, focus));
}
if (best.step < 0) {
  console.log(`no ${mode} frame passed`);
  process.exit(1);
}
const query = `?shot=play&seed=${best.seed}&step=${best.step}&reaction=${REACTION}${focus ? '&focus=1' : ''}`;
console.log(`best ${mode} frame: score ${best.score.toFixed(1)} ${query}`);
if (process.argv.includes('--write')) {
  const path = new URL('../shots.json', import.meta.url);
  const shots = JSON.parse(readFileSync(path, 'utf8'));
  shots.find((shot) => shot.name === '1-play.jpg').query = query;
  writeFileSync(path, JSON.stringify(shots, null, 2) + '\n');
}
