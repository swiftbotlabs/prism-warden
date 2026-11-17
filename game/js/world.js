// One run of Prism Warden: the run's state and its fixed step (steering, spawns, beams, damage, combo, the Core, win and loss).
import { COMBO_TUNING, CORE_BASE_HP, CORE_RADIUS, CORE_X, CORE_Y, LIGHTS, TOTAL_WAVES, WHITE } from './config.js';
import { createWarden, steerWarden, beamOrigin } from './warden.js';
import { castPrismBeams } from './beam.js';
import { createShade, lightHarmsShade, moveShades } from './shades.js';
import { DIFFICULTIES, SHADE_KINDS, WAVE_TABLE } from './rules.js';
import { damageEclipsePhase, updateEclipse } from './boss.js';
import { startWave, updateDirector, isWaveCleared } from './waves.js';
import { beamStats, chainDamage, createUpgradeLevels, harvestChance } from './upgrades.js';
import { burst, chainArc, floatText, killRing, scorch, sparks } from './particles.js';
import { fxRandom, seedRandom, simRandom } from './random.js';

/** A fresh run on wave 1. `seed` makes the whole run (spawns, mirrors, cards) repeatable. */
export function createWorld(seed, difficulty = 'standard') {
  seedRandom(seed);
  const world = {
    seed,
    difficulty,
    scoreScale: DIFFICULTIES.find((d) => d.id === difficulty).score,
    recentKills: [],
    time: 0,
    wave: 0,
    state: 'fight',
    stateTime: 0,
    core: { hp: CORE_BASE_HP, maxHp: CORE_BASE_HP, shield: 0, flash: 0, healFlash: 0 },
    warden: createWarden(),
    shades: [],
    mirrors: [],
    beams: [],
    motes: [],
    upgrades: createUpgradeLevels(),
    picks: [],
    boss: null,
    director: null,
    speedScale: 1,
    toughness: 1,
    score: 0,
    combo: 0,
    comboTimer: 0,
    hitting: false,
    stats: { kills: 0, onTarget: 0, offTarget: 0, bestCombo: 0, coreHits: 0, wavesCleared: 0, time: 0, burst: 0, waveScores: [] },
    shake: 0,
    slowmo: 0,
    banner: null,
    events: [],
    log: [],
  };
  beginWave(world, 1);
  return world;
}

/** Adds a line to the HUD's event log; the newest few stay on screen and fade. */
export function logEvent(world, text, colour = '#ece9ff') {
  world.log.push({ text, colour, time: world.time });
  if (world.log.length > 6) world.log.shift();
}

/** Starts wave `number`: Bastion shields recharge and the wave banner shows. */
export function beginWave(world, number) {
  startWave(world, number);
  world.state = 'fight';
  world.stateTime = 0;
  world.core.shield = world.upgrades.bastion;
  world.banner = { title: number === TOTAL_WAVES ? 'FINAL WAVE' : `WAVE ${number}`, sub: WAVE_TABLE[number - 1].title, time: 0 };
  world.events.push({ type: 'wave', wave: number });
  logEvent(world, `Wave ${number} begins`, '#ffd46e');
}

/** Score multiplier from the current combo: x1, then +1 every five kills in a row, up to x8. */
export function comboMultiplier(world) {
  return Math.min(COMBO_TUNING.maxMultiplier, 1 + Math.floor(world.combo / COMBO_TUNING.killsPerStep));
}

/** Share of beam contact time spent on a Shade the beam's colour could harm, as a whole percent. */
export function colourAccuracy(world) {
  const total = world.stats.onTarget + world.stats.offTarget;
  return total > 0 ? Math.round((100 * world.stats.onTarget) / total) : 100;
}

/** Advances the run by `dt` seconds of real time (slow motion stretches it) under `controls`. */
export function stepWorld(world, controls, dt) {
  world.stateTime += dt;
  world.shake = Math.max(0, world.shake - dt * 30);
  world.core.flash = Math.max(0, world.core.flash - dt);
  world.core.healFlash = Math.max(0, world.core.healFlash - dt);
  if (world.banner) {
    world.banner.time += dt;
    if (world.banner.time > 2.6) world.banner = null;
  }
  const scale = world.slowmo > 0 ? 0.28 : 1;
  world.slowmo = Math.max(0, world.slowmo - dt);
  const sdt = dt * scale;
  if (world.state === 'won' || world.state === 'lost') {
    world.beams = [];
    moveShades(world.shades, sdt * 0.3);
    return;
  }
  world.time += sdt;
  world.stats.time += sdt;

  steerWarden(world, controls, sdt);
  if (world.state === 'fight') updateDirector(world, sdt);
  moveShades(world.shades, sdt);
  if (world.boss && !world.boss.dead) updateEclipse(world, world.boss, sdt);
  resolveCoreContacts(world);

  const casting = controls.casting && world.state === 'fight';
  if (casting) {
    const origin = beamOrigin(world.warden);
    world.beams = castPrismBeams(world, origin.x, origin.y, world.warden.aimX, world.warden.aimY, world.warden.colour, world.upgrades);
  } else {
    world.beams = [];
  }
  applyBeams(world, sdt);
  updateMotes(world, sdt);
  for (const mirror of world.mirrors) {
    mirror.glow = Math.max(0, mirror.glow - dt * 4);
    mirror.born = Math.min(1, mirror.born + dt * 1.5);
  }

  if (world.combo > 0) {
    world.comboTimer -= sdt;
    if (world.comboTimer <= 0) world.combo = 0;
  }
  if (world.shades.some((shade) => shade.dead)) world.shades = world.shades.filter((shade) => !shade.dead);

  if (world.core.hp <= 0) {
    endRun(world, 'lost');
  } else if (world.state === 'fight' && isWaveCleared(world)) {
    world.stats.wavesCleared += 1;
    const bonus = Math.round(50 * world.wave * world.scoreScale);
    world.score += bonus;
    recordWaveScore(world);
    floatText(CORE_X, CORE_Y - 70, `WAVE CLEAR +${bonus}`, '#ffd46e', 24, 1.2);
    logEvent(world, `Wave ${world.wave} cleared +${bonus}`, '#ffd46e');
    if (world.wave >= TOTAL_WAVES) endRun(world, 'won');
    else {
      world.state = 'cleared';
      world.stateTime = 0;
      world.events.push({ type: 'cleared' });
    }
  }
}

/** Notes the score gained this wave, for the results chart. */
function recordWaveScore(world) {
  world.stats.waveScores.push(world.score - world.stats.waveScores.reduce((sum, value) => sum + value, 0));
}

function endRun(world, outcome) {
  if (outcome === 'lost') recordWaveScore(world);
  world.state = outcome;
  world.stateTime = 0;
  world.beams = [];
  world.events.push({ type: outcome === 'won' ? 'victory' : 'defeat' });
  if (outcome === 'lost') {
    world.shake = 24;
    burst(CORE_X, CORE_Y, '210,240,255', 120, 520, 1.6, 5);
    burst(CORE_X, CORE_Y, '255,84,104', 60, 300, 1.2, 4);
  }
}

/** Shades that reach the Core crack it (a Bastion shield takes the blow first) and break the combo. */
function resolveCoreContacts(world) {
  for (const shade of world.shades) {
    if (shade.dead || shade.kind === 'eclipse') continue;
    const dx = shade.x - CORE_X;
    const dy = shade.y - CORE_Y;
    if (dx * dx + dy * dy > (CORE_RADIUS + shade.r * 0.6) ** 2) continue;
    shade.dead = true;
    if (shade.counts) world.director.defeated += 1;
    const rgb = LIGHTS[shade.colour].rgb;
    if (world.core.shield > 0) {
      world.core.shield -= 1;
      world.events.push({ type: 'shield' });
      logEvent(world, 'Shield hit', '#78dcff');
      burst(shade.x, shade.y, '120,220,255', 30, 260, 0.6, 3);
      continue;
    }
    world.core.hp = Math.max(0, world.core.hp - shade.coreDamage);
    world.core.flash = 0.45;
    world.shake = Math.min(22, world.shake + 9 + shade.coreDamage * 3);
    world.stats.coreHits += 1;
    if (world.combo >= COMBO_TUNING.killsPerStep) floatText(CORE_X, CORE_Y + 64, 'COMBO BROKEN', '#ff5468', 20, 1.2);
    world.combo = 0;
    world.events.push({ type: 'crack' });
    logEvent(world, `Core cracked -${shade.coreDamage}`, '#ff5468');
    burst(shade.x, shade.y, rgb, 26, 240, 0.7, 3);
    burst(shade.x, shade.y, '255,255,255', 12, 180, 0.4, 2);
  }
}

/** Applies every beam's hits: matching light damages (and nudges back) a Shade, the wrong colour only throws sparks. */
function applyBeams(world, dt) {
  const damage = beamStats(world.upgrades).damage;
  let onTarget = false;
  let offTarget = false;
  for (const beam of world.beams) {
    const beamRgb = LIGHTS[beam.colour].rgb;
    for (const hit of beam.hits) {
      const shade = hit.shade;
      if (shade.dead) continue;
      const harms = shade.kind === 'eclipse'
        ? shade.entering <= 0 && shade.colour === beam.colour
        : lightHarmsShade(shade, hit.part, beam.colour);
      if (!harms) {
        offTarget = true;
        if (fxRandom() < 0.3) sparks(hit.x, hit.y, -hit.dx, -hit.dy, '255,255,255', 1, 200, 1.3);
        if (fxRandom() < 0.3) sparks(hit.x, hit.y, -hit.dx, -hit.dy, beamRgb, 1, 160, 1.3);
        world.comboTimer -= dt * 0.6;
        continue;
      }
      onTarget = true;
      const amount = damage * beam.power * dt;
      if (fxRandom() < 0.45) sparks(hit.x, hit.y, -hit.dx, -hit.dy, beamRgb, 1, 240, 0.8);
      if (fxRandom() < 0.03) scorch(hit.x, hit.y, 5 + fxRandom() * 4, beamRgb);
      if (shade.kind === 'eclipse') {
        hurtEclipse(world, shade, amount, beam.colour);
        continue;
      }
      shade.flash = 0.06;
      shade.x += hit.dx * 16 * dt;
      shade.y += hit.dy * 16 * dt;
      if (hit.part >= 0) {
        const segment = shade.shell[hit.part];
        segment.hp -= amount;
        if (segment.hp <= 0 && !segment.broken) {
          segment.broken = true;
          logEvent(world, `${LIGHTS[segment.colour].name} shell broken`, LIGHTS[segment.colour].hex);
          burst(hit.x, hit.y, LIGHTS[segment.colour].rgb, 22, 220, 0.6, 3);
          world.events.push({ type: 'split' });
        }
      } else {
        shade.hp -= amount;
        if (shade.hp <= 0) killShade(world, shade, beam.colour, 0);
      }
    }
  }
  if (onTarget) world.stats.onTarget += dt;
  else if (offTarget) world.stats.offTarget += dt;
  if (onTarget) world.events.push({ type: 'hit', colour: world.warden.colour });
  else if (offTarget) world.events.push({ type: 'wrong' });
  world.hitting = onTarget;
}

function hurtEclipse(world, boss, amount, colour) {
  const result = damageEclipsePhase(boss, amount);
  if (result === 'phase' || result === 'dead') {
    const points = Math.round((result === 'dead' ? 2000 : 500) * comboMultiplier(world) * world.scoreScale);
    world.score += points;
    world.slowmo = result === 'dead' ? 1.4 : 0.9;
    world.shake = 20;
    burst(boss.x, boss.y, LIGHTS[colour].rgb, 90, 460, 1.3, 5);
    burst(boss.x, boss.y, '255,255,255', 50, 300, 1, 3);
    floatText(boss.x, boss.y - 80, result === 'dead' ? `ECLIPSE BROKEN +${points}` : `PHASE BROKEN +${points}`, '#ffd46e', 28, 1.8);
    world.events.push({ type: 'phase' });
    logEvent(world, result === 'dead' ? `ECLIPSE BROKEN +${points}` : `PHASE BROKEN +${points}`, '#ffd46e');
  }
  if (result === 'dead') {
    for (const shade of world.shades) {
      if (shade.dead) continue;
      shade.dead = true;
      burst(shade.x, shade.y, LIGHTS[shade.colour].rgb, 16, 220, 0.8, 3);
    }
    world.director.queue.length = 0;
    world.director.defeated = world.director.total;
  }
}

/** Kills a Shade: score with the combo multiplier, burst, Splitter children, Chain arcs and Harvest motes. */
function killShade(world, shade, colour, depth) {
  shade.dead = true;
  if (shade.counts) world.director.defeated += 1;
  world.combo += 1;
  world.comboTimer = COMBO_TUNING.window;
  world.stats.bestCombo = Math.max(world.stats.bestCombo, world.combo);
  world.stats.kills += 1;
  world.recentKills = world.recentKills.filter((t) => world.time - t < 1).concat(world.time);
  world.stats.burst = Math.max(world.stats.burst, world.recentKills.length);
  const multiplier = comboMultiplier(world);
  const points = Math.round(shade.value * multiplier * world.scoreScale);
  world.score += points;
  const light = LIGHTS[shade.colour];
  floatText(shade.x, shade.y - shade.r - 8, `+${points}`, LIGHTS[colour].hex, 15 + Math.min(multiplier, 6) * 2);
  burst(shade.x, shade.y, light.rgb, 14 + shade.r, 240, 0.75, 3.5);
  burst(shade.x, shade.y, '255,255,255', 6, 150, 0.35, 2.5);
  killRing(shade.x, shade.y, light.rgb, shade.r * 2.6);
  scorch(shade.x, shade.y, shade.r * 1.1, light.rgb);
  world.events.push({ type: 'kill', colour, combo: world.combo });
  if (depth > 0) logEvent(world, `+${points} CHAIN x${depth + 1}`, LIGHTS[colour].hex);
  else if (shade.kind === 'bulwark' || shade.kind === 'prismling' || shade.kind === 'splitter') {
    logEvent(world, `+${points} ${SHADE_KINDS[shade.kind].label}`, light.hex);
  }
  if (world.combo > 0 && world.combo % 10 === 0) logEvent(world, `${world.combo} COMBO · x${multiplier}`, '#ffd46e');

  if (shade.kind === 'splitter') {
    const first = shade.colour === WHITE ? Math.floor(simRandom() * 3) : (shade.colour + 1) % 3;
    const second = (first + 1) % 3 === shade.colour ? (first + 2) % 3 : (first + 1) % 3;
    for (const [index, childColour] of [first, second].entries()) {
      const side = index === 0 ? 1 : -1;
      const child = createShade('shard', childColour, shade.x + side * 16, shade.y - side * 16, world.speedScale, false, world.toughness);
      world.shades.push(child);
    }
    world.events.push({ type: 'split' });
  }

  if (world.upgrades.chain > 0 && depth < 3) arcChain(world, shade, colour, depth);
  if (simRandom() < harvestChance(world.upgrades)) {
    world.motes.push({ x: shade.x, y: shade.y, vx: (simRandom() - 0.5) * 120, vy: (simRandom() - 0.5) * 120, age: 0 });
  }
}

/** Chain: the kill's light leaps to the nearest Shade that colour can harm. */
function arcChain(world, from, colour, depth) {
  const range = 150 + 40 * world.upgrades.chain;
  let target = null;
  let best = range * range;
  for (const shade of world.shades) {
    if (shade.dead || shade === from || shade.shell || shade.kind === 'eclipse' || !lightHarmsShade(shade, -1, colour)) continue;
    const d = (shade.x - from.x) ** 2 + (shade.y - from.y) ** 2;
    if (d < best) {
      best = d;
      target = shade;
    }
  }
  if (!target) return;
  chainArc(from.x, from.y, target.x, target.y, LIGHTS[colour].rgb);
  world.events.push({ type: 'chain' });
  if (target.shell) return;
  target.hp -= chainDamage(world.upgrades);
  target.flash = 0.1;
  if (target.hp <= 0) killShade(world, target, colour, depth + 1);
}

/** Harvest motes drift, then home in on the Core and heal it by 1. */
function updateMotes(world, dt) {
  for (const mote of world.motes) {
    mote.age += dt;
    const dx = CORE_X - mote.x;
    const dy = CORE_Y - mote.y;
    const distance = Math.hypot(dx, dy) || 1;
    const pull = Math.min(900, 80 + mote.age * 500);
    mote.vx = mote.vx * 0.94 + (dx / distance) * pull * dt * 4;
    mote.vy = mote.vy * 0.94 + (dy / distance) * pull * dt * 4;
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    if (distance < CORE_RADIUS) {
      mote.age = -1;
      if (world.core.hp < world.core.maxHp) {
        world.core.hp += 1;
        world.core.healFlash = 0.4;
        floatText(CORE_X, CORE_Y - 52, '+1', '#9fffcf', 16, 0.8);
        logEvent(world, 'Harvest +1', '#9fffcf');
      }
      world.events.push({ type: 'heal' });
    }
  }
  if (world.motes.some((mote) => mote.age < 0)) world.motes = world.motes.filter((mote) => mote.age >= 0);
}
