// THE ECLIPSE, the wave-10 boss: three phases that change its colour, orbit and summons, with a slow-motion beat at each break.
import { ARENA_W, AZURE, CORE_X, CORE_Y, EMBER, LIGHTS, TAU, WHITE } from './config.js';
import { createShade } from './shades.js';
import { simRandom } from './random.js';

/** Each phase: its name, shell colour (-1 = cycles), health, orbit and what it summons how often. */
export const ECLIPSE_PHASES = [
  { name: 'UMBRA', colour: EMBER, hp: 30, orbitSpeed: 0.2, radius: 300, summon: 'drifters', every: 3.4 },
  { name: 'PENUMBRA', colour: AZURE, hp: 36, orbitSpeed: 0.32, radius: 285, summon: 'darterRing', every: 4.4 },
  { name: 'TOTALITY', colour: -1, hp: 44, orbitSpeed: 0.4, radius: 250, summon: 'splitters', every: 4.6 },
];
/** Seconds between colour shifts in the cycling phase. */
const TOTALITY_SHIFT = 2.6;

export function createEclipse() {
  const boss = createShade('eclipse', EMBER, ARENA_W / 2, -90, 1, true);
  boss.phase = 0;
  boss.hp = ECLIPSE_PHASES[0].hp;
  boss.maxHp = boss.hp;
  boss.orbit = -Math.PI / 2;
  boss.orbitRadius = 300;
  boss.summonTimer = 2.5;
  boss.orbTimer = 5;
  boss.entering = 2.2;
  boss.broken = 0;
  return boss;
}

/** Moves THE ECLIPSE along its orbit, cycles its colour in the last phase, and summons minions into `world.shades`. */
export function updateEclipse(world, boss, dt) {
  const phase = ECLIPSE_PHASES[boss.phase];
  boss.age += dt;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.broken = Math.max(0, boss.broken - dt);
  boss.rot += dt * (0.4 + boss.phase * 0.25);

  const targetRadius = boss.phase === 2 ? 170 + 80 * (0.5 + 0.5 * Math.cos(boss.age * 0.5)) : phase.radius;
  boss.orbitRadius += (targetRadius - boss.orbitRadius) * Math.min(1, dt * 0.8);
  boss.orbit += phase.orbitSpeed * dt;
  const goalX = CORE_X + Math.cos(boss.orbit) * boss.orbitRadius * 1.4;
  const goalY = CORE_Y + Math.sin(boss.orbit) * boss.orbitRadius * 0.82;
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
    summonMinions(world, boss, phase.summon);
  }
  boss.orbTimer -= dt;
  if (boss.orbTimer <= 0) {
    boss.orbTimer = 3.2 - boss.phase * 0.5;
    const orb = createShade('shard', WHITE, boss.x, boss.y, 1.3 + boss.phase * 0.15, false);
    world.shades.push(orb);
  }
}

function summonMinions(world, boss, pattern) {
  const speed = world.speedScale;
  if (pattern === 'drifters') {
    for (let i = 0; i < 2; i += 1) {
      const angle = boss.rot + i * Math.PI;
      world.shades.push(createShade('drifter', Math.floor(simRandom() * 3), boss.x + Math.cos(angle) * 70, boss.y + Math.sin(angle) * 70, speed, false, world.toughness));
    }
  } else if (pattern === 'darterRing') {
    for (let i = 0; i < 5; i += 1) {
      const angle = boss.rot + (i / 5) * TAU;
      world.shades.push(createShade('darter', i % 3, boss.x + Math.cos(angle) * 72, boss.y + Math.sin(angle) * 72, speed, false, world.toughness));
    }
  } else {
    const colour = (boss.colour + 1 + Math.floor(simRandom() * 2)) % 3;
    world.shades.push(createShade('splitter', colour, boss.x, boss.y, speed, false, world.toughness));
    world.shades.push(createShade('prismling', (colour + 1) % 3, boss.x + 40, boss.y, speed, false, world.toughness));
  }
}

/**
 * Deals damage to THE ECLIPSE. Returns 'hit', 'phase' when a phase breaks (the next one begins at full health)
 * or 'dead' when the last one does.
 */
export function damageEclipse(boss, amount) {
  if (boss.entering > 0) return 'immune';
  boss.hp -= amount;
  boss.flash = 0.06;
  if (boss.hp > 0) return 'hit';
  if (boss.phase >= ECLIPSE_PHASES.length - 1) {
    boss.dead = true;
    return 'dead';
  }
  boss.phase += 1;
  boss.hp = ECLIPSE_PHASES[boss.phase].hp;
  boss.maxHp = boss.hp;
  boss.broken = 1.2;
  boss.summonTimer = 1.5;
  return 'phase';
}

/** The name and colour label the HUD shows above the boss bar. */
export function eclipseTitle(boss) {
  const phase = ECLIPSE_PHASES[boss.phase];
  return `THE ECLIPSE · ${phase.name} · ${phase.colour >= 0 ? LIGHTS[phase.colour].name.toUpperCase() : 'SHIFTING'}`;
}
