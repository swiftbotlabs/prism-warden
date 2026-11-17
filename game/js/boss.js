// THE ECLIPSE, the wave-10 boss: three phases with their own colour and orbit, minion legions from the edges, and a telegraphed Shadow Ring.
import { ARENA_W, CORE_X, CORE_Y, EMBER, LIGHTS, TAU, WHITE } from './config.js';
import { BOSS_PHASES } from './rules.js';
import { createShade, edgeSpawnPoint } from './shades.js';
import { simRandom } from './random.js';

/** Breaks the current phase: the next one starts at full health with its own colour, orbit and summons. */
export function nextEclipsePhase(boss) {
  boss.phase += 1;
  boss.hp = BOSS_PHASES[boss.phase].hp;
  boss.maxHp = boss.hp;
  boss.broken = 1.2;
  boss.summonTimer = 1.5;
}

/** Damages THE ECLIPSE: returns 'hit', 'phase' when a phase breaks, or 'dead' when the last one does. */
export function damageEclipsePhase(boss, amount) {
  if (boss.entering > 0) return 'immune';
  boss.hp -= amount;
  boss.flash = 0.06;
  if (boss.hp > 0) return 'hit';
  if (boss.phase >= BOSS_PHASES.length - 1) {
    boss.dead = true;
    return 'dead';
  }
  nextEclipsePhase(boss);
  return 'phase';
}

/** Seconds between colour shifts in the cycling phase. */
const TOTALITY_SHIFT = 2.6;

export function createEclipse() {
  const boss = createShade('eclipse', EMBER, ARENA_W / 2, -90, 1, true);
  boss.phase = 0;
  boss.hp = BOSS_PHASES[0].hp;
  boss.maxHp = boss.hp;
  boss.orbit = -Math.PI / 2;
  boss.orbitRadius = 300;
  boss.summonTimer = 2.5;
  boss.ringTimer = 7;
  boss.charging = 0;
  boss.entering = 2.2;
  boss.broken = 0;
  return boss;
}

/** Moves THE ECLIPSE along its orbit, cycles its colour in the last phase, and summons minions into `world.shades`. */
export function updateEclipse(world, boss, dt) {
  const phase = BOSS_PHASES[boss.phase];
  boss.age += dt;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.broken = Math.max(0, boss.broken - dt);
  boss.rot += dt * (0.4 + boss.phase * 0.25);

  const targetRadius = boss.phase === 2 ? 170 + 80 * (0.5 + 0.5 * Math.cos(boss.age * 0.5)) : phase.radius;
  boss.orbitRadius += (targetRadius - boss.orbitRadius) * Math.min(1, dt * 0.8);
  boss.orbit += phase.orbitSpeed * dt;
  const goalX = CORE_X + Math.cos(boss.orbit) * boss.orbitRadius * 1.4;
  const goalY = CORE_Y + 20 + Math.sin(boss.orbit) * boss.orbitRadius * 0.68;
  const ease = boss.entering > 0 ? 1.6 : 6;
  boss.x += (goalX - boss.x) * Math.min(1, dt * ease);
  boss.y += (goalY - boss.y) * Math.min(1, dt * ease);
  if (boss.entering > 0) {
    boss.entering -= dt;
    return;
  }

  boss.colour = phase.colour >= 0 ? phase.colour : Math.floor(boss.age / TOTALITY_SHIFT) % 3;

  boss.summonTimer -= dt;
  if (boss.summonTimer <= 0) {
    boss.summonTimer = phase.every;
    summonLegion(world, phase.legion);
  }
  boss.ringTimer -= dt;
  if (boss.ringTimer <= 0 && boss.charging <= 0) {
    boss.charging = CHARGE_TIME;
    boss.ringTimer = 9 - boss.phase;
    world.events.push({ type: 'boss' });
    world.log.push({ text: 'Shadow Ring!', colour: '#c9a0ff', time: world.time });
  }
  if (boss.charging > 0) {
    boss.charging -= dt;
    if (boss.charging <= 0) releaseShadowRing(world, boss, phase.ring);
  }
}

/** Seconds the Shadow Ring is telegraphed (the boss darkens and its halo tightens) before it is released. */
export const CHARGE_TIME = 1.5;

/** Seconds of THE ECLIPSE's entrance: the fight pauses while it rises, fills the screen and is named. */
export const ENTRANCE_TIME = 2.4;

/** A legion of minions from the arena edges, spread round the field, their colours rotating through all three lights. */
function summonLegion(world, kinds) {
  const offset = Math.floor(simRandom() * 3);
  for (let i = 0; i < kinds.length; i += 1) {
    const point = edgeSpawnPoint(simRandom);
    world.shades.push(createShade(kinds[i % kinds.length], (offset + i) % 3, point.x, point.y, world.speedScale, false, world.toughness));
  }
}

/** The Shadow Ring: Umbra orbs fly out from the boss in every direction; any light cuts them, and those reaching the Core crack it. */
function releaseShadowRing(world, boss, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = boss.rot + (i / count) * TAU;
    const orb = createShade('umbra', WHITE, boss.x + Math.cos(angle) * (boss.r + 8), boss.y + Math.sin(angle) * (boss.r + 8), 1, false, world.toughness);
    orb.vx = Math.cos(angle) * orb.speed;
    orb.vy = Math.sin(angle) * orb.speed;
    world.shades.push(orb);
  }
  world.events.push({ type: 'phase' });
}

/** The name and colour label the HUD shows above the boss bar. */
export function eclipseTitle(boss) {
  const phase = BOSS_PHASES[boss.phase];
  return `THE ECLIPSE · ${phase.name} · ${phase.colour >= 0 ? LIGHTS[phase.colour].name.toUpperCase() : 'SHIFTING'}`;
}
