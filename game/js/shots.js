// Screenshot scenes behind ?shot=title|play|upgrade|boss|results|defeat&seed=n: the real game played forward by the autopilot at fixed steps, frozen on the moment.
import { CORE_RADIUS, CORE_X, CORE_Y, STEP, WHITE } from './config.js';
import { autopilotControls, autopilotPick, createPilot } from './autopilot.js';
import { beginWave, createWorld, stepWorld } from './world.js';
import { applyUpgrade, dealUpgradeCards } from './upgrades.js';
import { clearEffects, floatersNear, liveParticleCount, updateEffects } from './particles.js';
import { hudPanelRects } from './hud.js';
import { harmingColour, lightHarmsShade } from './shades.js';
import { loadBestScore, saveBestScore } from './storage.js';
import { simRandom } from './random.js';
import { incomingByKind } from './waves.js';
import { updateTitleScene } from './screens.js';

/** The upgrades a shot's pilot prefers: the ones that show off split and reflected light. */
const SHOT_PICKS = ['prism', 'reflect', 'lens', 'focus', 'chain', 'bastion', 'lance', 'harvest', 'swift'];
const MAX_SECONDS = 60 * 12;
/**
 * The best score already on record in every scene's browser profile, so the four screenshots tell one story:
 * the title and the play HUD show it, and the winning run on the results beats it.
 */
const RECORDED_BEST = 28410;
/** The cover's pilot re-thinks its target every 0.3 s, like a person, so a crowd builds up as it would in a real run. */
const COVER_REACTION = 0.3;
/** The cover weighs the best moment across this many runs (seed, seed + 101, ...) rather than settling for the first. */
const COVER_SEEDS = Array.from({ length: 20 }, (_, n) => n);

/**
 * Plays a run with the autopilot until `stop(world, step)` says so (checked once a step), taking upgrades on the way.
 * Returns the world, or null if the run ended or ran out of time first.
 */
function playUntil(seed, stop, pilot = createPilot(0)) {
  const world = createWorld(seed);
  for (let step = 0; step < MAX_SECONDS / STEP; step += 1) {
    if (world.state === 'cleared' && world.stateTime > 1.3) {
      if (stop(world, step)) return world;
      const hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
      const preferred = SHOT_PICKS.find((id) => hand.includes(id));
      applyUpgrade(world, preferred ?? hand[autopilotPick(hand, world.upgrades)]);
      beginWave(world, world.wave + 1);
    }
    stepWorld(world, autopilotControls(world, pilot, STEP), STEP);
    world.events.length = 0;
    updateEffects(STEP);
    if (stop(world, step)) return world;
    if (world.state === 'lost' && world.stateTime > 2.5) return null;
  }
  return null;
}

/** Length of a beam's polyline, and of its first leg (the part that leaves the Warden). */
function beamLengths(beam) {
  let total = 0;
  let first = 0;
  for (let i = 2; i < beam.points.length; i += 2) {
    const leg = Math.hypot(beam.points[i] - beam.points[i - 2], beam.points[i + 1] - beam.points[i - 1]);
    if (i === 2) first = leg;
    total += leg;
  }
  return { total, first };
}

/** Facts shared by both mid-run framings: Shades on screen, kinds, colours, bounces, hits. */
function frameFacts(world) {
  const onScreen = world.shades.filter((s) => !s.dead && s.kind !== 'eclipse' && s.x > 20 && s.x < 1260 && s.y > 110 && s.y < 720);
  return {
    onScreen,
    kinds: new Set(onScreen.map((s) => s.kind)).size,
    colours: new Set(onScreen.map((s) => s.colour)).size,
    bounces: world.beams.reduce((sum, beam) => sum + beam.bounces.length / 2, 0),
    hits: world.beams.reduce((sum, beam) => sum + beam.hits.length, 0),
  };
}

/** True when the beams read at a glance: a long main beam leaving the Warden, and every Prism branch long too. */
function beamsReadable(world, mainFirst, branchTotal, minBeams) {
  if (world.beams.length < minBeams) return false;
  const [main, ...branches] = world.beams.map(beamLengths);
  return main.first >= mainFirst && branches.every((b) => b.total >= branchTotal);
}

/** Which beams are harming a Shade right now and how many different Shade colours they strike: the Prism split at work. */
function prismStrikes(world) {
  const colours = new Set();
  let beams = 0;
  for (const beam of world.beams) {
    const harmed = beam.hits.filter((hit) => !hit.shade.dead && hit.shade.kind !== 'eclipse' && lightHarmsShade(hit.shade, hit.part, beam.colour));
    if (harmed.length === 0) continue;
    beams += 1;
    for (const hit of harmed) colours.add(harmingColour(hit.shade, hit.part));
  }
  return { beams, colours: colours.size };
}

/** True when any Shade has its centre under a HUD panel or the build chips (mostly hidden in the screenshot). */
function shadeUnderHud(world) {
  const rects = hudPanelRects(world);
  return world.shades.some((s) => !s.dead && rects.some((r) => s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h));
}

/**
 * How striking a wave-7 or wave-8 frame is. Frames that would muddle the story score -1: a banner, a hurt Core, text over the
 * Core, the Warden under a HUD panel, a short main beam or stubby branches.
 */
function waveDrama(world) {
  if (world.wave < 7 || world.wave > 8 || world.state !== 'fight' || world.banner) return -1;
  const warden = world.warden;
  if (world.core.hp < world.core.maxHp * 0.6 || warden.y < 180 || warden.y > 630 || warden.x < 340 || warden.x > 1010) return -1;
  const popups = floatersNear(CORE_X, CORE_Y, 2000);
  if (floatersNear(CORE_X, CORE_Y, 90) > 0 || popups < 1 || popups > 2 || !beamsReadable(world, 150, 120, 3)) return -1;
  if (world.shades.some((s) => !s.dead && Math.hypot(s.x - CORE_X, s.y - CORE_Y) < CORE_RADIUS + s.r + 50)) return -1;
  if (!justDiedToOwnColour(world)) return -1;
  const main = beamLengths(world.beams[0]);
  const facts = frameFacts(world);
  const recentLog = world.log.filter((entry) => world.time - entry.time < 3).length;
  if (world.combo < 10 || facts.onScreen.length < 7 || facts.onScreen.length > 12 || facts.colours < 3) return -1;
  const incoming = incomingByKind(world);
  if (incoming.length < 3 || recentLog < 2) return -1;
  const struck = prismStrikes(world);
  if (struck.beams < 2 || struck.colours < 2 || shadeUnderHud(world)) return -1;
  return Math.min(main.total, 700) / 70 + facts.onScreen.length + facts.kinds * 3 + Math.min(facts.bounces, 4) * 3
    + Math.min(world.combo, 40) / 4 + recentLog * 2 + incoming.length * 3 + struck.colours * 8 + struck.beams * 4;
}

/** The colour rule in action: a Shade died to light of its own colour a moment ago, its burst in clear view. */
function justDiedToOwnColour(world) {
  const kill = world.lastKill;
  if (!kill || world.time - kill.time > 0.3 || kill.colour !== kill.beamColour || kill.colour === WHITE) return false;
  if (kill.x < 40 || kill.x > 1240 || kill.y < 40 || kill.y > 760) return false;
  return !hudPanelRects(world).some((r) => kill.x > r.x - 30 && kill.x < r.x + r.w + 30 && kill.y > r.y - 30 && kill.y < r.y + r.h + 30);
}

/**
 * How striking a boss frame is: the Warden casting THE ECLIPSE's own colour into it, branches and bounces,
 * minions of several colours, its phase bar mid-way, and its name label clear of everything.
 */
function bossDrama(world) {
  const boss = world.boss;
  if (world.wave !== 10 || world.state !== 'fight' || world.banner || !boss || boss.dead || boss.entering > 0) return -1;
  if (boss.phase !== 1 || boss.hp > boss.maxHp * 0.7 || boss.hp < boss.maxHp * 0.3) return -1;
  const warden = world.warden;
  const main = world.beams[0];
  if (!main || main.colour !== boss.colour || !main.hits.some((hit) => hit.shade === boss)) return -1;
  if (boss.x < 160 || boss.x > 1120 || boss.y < 230 || boss.y > 600 || warden.y < 150 || warden.y > 660) return -1;
  if (floatersNear(CORE_X, CORE_Y, 90) > 0 || !beamsReadable(world, 120, 160, 2)) return -1;
  const label = { left: boss.x - 80, right: boss.x + 80, top: boss.y + boss.r + 14, bottom: boss.y + boss.r + 52 };
  const blocksLabel = (x, y, r) => x + r > label.left && x - r < label.right && y + r > label.top && y - r < label.bottom;
  if (blocksLabel(warden.x, warden.y, warden.r + 6) || world.shades.some((s) => !s.dead && s !== boss && blocksLabel(s.x, s.y, s.r))) return -1;
  if (world.beams.some((beam) => beam.points.some((v, i) => i % 2 === 0 && blocksLabel(v, beam.points[i + 1], 4)))) return -1;
  const facts = frameFacts(world);
  if (facts.onScreen.length < 3 || facts.colours < 2) return -1;
  return facts.onScreen.length * 2 + world.beams.length * 6 + facts.colours * 4 + facts.kinds * 2 + Math.min(facts.bounces, 5) * 3 + facts.hits * 2
    + (world.core.hp / world.core.maxHp) * 12 + liveParticleCount() / 60;
}

/**
 * Plays each seed's run once, scoring every step with `drama`, until `done(world)`; then replays the best seed to exactly
 * its best-scoring step (the rules are deterministic, so the replay lands on the same frame).
 */
function mostDramaticMoment(seeds, drama, done, makePilot) {
  let best = { seed: 0, step: -1, score: 0 };
  for (const seed of seeds) {
    clearEffects();
    playUntil(seed, (world, step) => {
      const score = drama(world);
      if (score > best.score) best = { seed, step, score };
      return done(world);
    }, makePilot());
  }
  if (best.step < 0) return null;
  clearEffects();
  return playUntil(best.seed, (world, step) => step === best.step, makePilot());
}

/** Sets up scene `kind` from `seed`, draws it once and flags `window.__shotReady` for the capture script. */
export function runShotScene(game, kind, seed, hooks) {
  saveBestScore(RECORDED_BEST);
  game.best = Math.max(loadBestScore(), RECORDED_BEST);
  let world = null;
  for (let attempt = 0; attempt < 6 && !world; attempt += 1) {
    const runSeed = seed + attempt * 101;
    clearEffects();
    switch (kind) {
      case 'title':
        for (let t = 0; t < 4.6; t += STEP) {
          updateTitleScene(game.titleScene, STEP);
          updateEffects(STEP);
        }
        game.time = 4.6;
        hooks.setMode('title');
        world = game.titleScene;
        break;
      case 'play':
      case 'boss':
        world = kind === 'play'
          ? mostDramaticMoment(COVER_SEEDS.map((n) => seed + n * 101), waveDrama, (w) => w.wave > 8 || (w.wave === 8 && w.state === 'cleared'), () => createPilot(COVER_REACTION))
          : mostDramaticMoment([runSeed], bossDrama, (w) => w.wave === 10 && w.boss && (w.boss.dead || w.boss.phase > 1), () => createPilot(0, 0, true));
        if (world) {
          game.world = world;
          game.colour = world.warden.colour;
          hooks.setMode('play');
        }
        break;
      case 'upgrade':
        world = playUntil(runSeed, (w) => w.wave === 9 && w.state === 'cleared' && w.stateTime > 1.3);
        if (world) {
          game.world = world;
          game.hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
          game.hovered = 1;
          game.time = 1;
          hooks.setMode('upgrade');
        }
        break;
      case 'results':
      case 'defeat': {
        const wanted = kind === 'results' ? 'won' : 'lost';
        world = kind === 'results'
          ? playUntil(runSeed, (w) => w.state === 'won' && w.stateTime > 2.4)
          : playIdleUntilLost(runSeed);
        if (world && world.state === wanted) {
          game.world = world;
          game.previousBest = game.best;
          game.newBest = world.score > game.best;
          game.best = Math.max(saveBestScore(world.score), world.score, game.best);
          game.time = 0.25;
          hooks.setMode('results');
        } else {
          world = null;
        }
        break;
      }
      default:
        world = game.titleScene;
        break;
    }
  }
  hooks.drawFrame();
  window.__shotReady = true;
  window.__shotScene = { kind, found: Boolean(world), seed: world?.seed, wave: world?.wave, score: world?.score, best: game.best };
}

/** A run where the Warden never casts: the Shades reach the Core and it shatters. */
function playIdleUntilLost(seed) {
  const world = createWorld(seed);
  const idle = { moveX: 0, moveY: 0, aimX: 640, aimY: 200, casting: false, colour: 0 };
  for (let step = 0; step < MAX_SECONDS / STEP; step += 1) {
    stepWorld(world, idle, STEP);
    world.events.length = 0;
    updateEffects(STEP);
    if (world.state === 'lost' && world.stateTime > 2.4) return world;
  }
  return null;
}
