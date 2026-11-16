// Screenshot scenes behind ?shot=title|play|wave|upgrade|results|defeat&seed=n: the real game played by the autopilot, frozen on the moment.
import { CORE_X, CORE_Y, STEP, WHITE } from './config.js';
import { autopilotControls, autopilotPick, createPilot } from './autopilot.js';
import { beginWave, createWorld, stepWorld } from './world.js';
import { applyUpgrade, dealUpgradeCards } from './upgrades.js';
import { clearEffects, floatersNear, updateEffects } from './particles.js';
import { hudPanelRects } from './hud.js';
import { lightHarmsShade } from './shades.js';
import { ECLIPSE_PHASES } from './boss.js';
import { loadBestScore, saveBestScore } from './storage.js';
import { simRandom } from './random.js';
import { updateTitleScene } from './screens.js';

/** The upgrades a shot's pilot prefers: the ones that show off split and reflected light. */
const SHOT_PICKS = ['prism', 'reflect', 'lens', 'focus', 'chain', 'bastion', 'lance', 'harvest', 'swift'];
const MAX_SECONDS = 60 * 12;
/** The best score on record in every scene, so the four screenshots tell one story (the winning run beats it). */
const RECORDED_BEST = 28410;
/** The cover's pilot re-thinks its target every 0.3 s, like a person, so minions stay alive as in a real fight. */
const COVER_REACTION = 0.3;
/** How many runs (seed, seed + 101, ...) the cover search compares. */
const COVER_RUNS = 200;

/** Plays a run with the autopilot until `stop(world, step)`, taking upgrades between waves; null if the run ends first. */
function playUntil(seed, stop, pilot = createPilot(0)) {
  const world = createWorld(seed);
  for (let step = 0; step < MAX_SECONDS / STEP; step += 1) {
    if (world.state === 'cleared' && world.stateTime > 1.3) {
      if (stop(world, step)) return world;
      const hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
      applyUpgrade(world, SHOT_PICKS.find((id) => hand.includes(id)) ?? hand[autopilotPick(hand, world.upgrades)]);
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

/** What a frame shows: minions in clear view (not in the boss's glow or at the edges), their kinds and colours, mirror bounces, and whether a beam is harming a minion. */
function frameFacts(world) {
  const boss = world.boss && !world.boss.dead ? world.boss : null;
  const onScreen = world.shades.filter((s) => !s.dead && s.kind !== 'eclipse' && s.x > 30 && s.x < 1250 && s.y > 110 && s.y < 690
    && (!boss || Math.hypot(s.x - boss.x, s.y - boss.y) > boss.r + 40));
  const minionStruck = world.beams.some((beam) => beam.hits.some((hit) => hit.shade.kind !== 'eclipse' && !hit.shade.dead
    && lightHarmsShade(hit.shade, hit.part, beam.colour)));
  return {
    onScreen,
    kinds: new Set(onScreen.map((s) => s.kind)).size,
    colours: new Set(onScreen.map((s) => s.colour).filter((c) => c !== WHITE)).size,
    bounces: world.beams.reduce((sum, beam) => sum + beam.bounces.length / 2, 0),
    minionStruck,
    popups: floatersNear(CORE_X, CORE_Y, 2000),
  };
}

/** True when nothing important hides under the HUD: no Shade centred under a panel, the Warden clear of the edges. */
function framedClear(world) {
  const rects = hudPanelRects(world);
  const under = (x, y) => rects.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const { x, y } = world.warden;
  return !world.shades.some((s) => !s.dead && under(s.x, s.y)) && !under(x, y) && y > 160 && y < 660 && x > 80 && x < 1200;
}

/** A boss frame: THE ECLIPSE half broken, struck by the beam in its colour, branches and bounces hitting minions of all three colours. */
function bossDrama(world) {
  const boss = world.boss;
  if (world.state !== 'fight' || world.banner || !boss || boss.dead || boss.entering > 0) return -1;
  const health = (ECLIPSE_PHASES.length - 1 - boss.phase + boss.hp / boss.maxHp) / ECLIPSE_PHASES.length;
  const main = world.beams[0];
  if (health < 0.25 || health > 0.75 || !main || main.colour !== boss.colour || !main.hits.some((hit) => hit.shade === boss)) return -1;
  const facts = frameFacts(world);
  if (world.beams.length < 2 || facts.bounces < 2 || !facts.minionStruck || facts.colours < 3 || facts.onScreen.length < 4) return -1;
  if (facts.popups < 1 || facts.popups > 2 || !framedClear(world) || boss.y > 600 || boss.x < 140 || boss.x > 1140) return -1;
  if (world.shades.some((s) => s !== boss && !s.dead && Math.abs(s.x - boss.x) < 80 && Math.abs(s.y - boss.y - boss.r - 34) < 22)) return -1;
  return Math.min(facts.onScreen.length, 12) * 2 + facts.kinds * 2 + Math.min(facts.bounces, 4) * 3 + world.beams.length * 4
    + (facts.popups === 1 ? 6 : 0) + (world.core.hp / world.core.maxHp) * 10 + (1 - Math.abs(health - 0.5)) * 6;
}

/** The fallback: a busy wave-8 frame with the split beam harming minions of several colours. */
function waveDrama(world) {
  if (world.wave !== 8 || world.state !== 'fight' || world.banner || world.combo < 10) return -1;
  const facts = frameFacts(world);
  if (world.beams.length < 3 || !facts.minionStruck || facts.colours < 3 || facts.popups < 1 || facts.popups > 2 || !framedClear(world)) return -1;
  return Math.min(facts.onScreen.length, 12) + facts.kinds * 3 + Math.min(facts.bounces, 4) * 3 + (world.core.hp / world.core.maxHp) * 10;
}

/** Scores every step of each seed's run with `drama` until `done`, then replays the best seed to its best step (the rules are deterministic). */
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
  const runs = Array.from({ length: COVER_RUNS }, (_, n) => seed + n * 101);
  let world = null;
  if (kind === 'play') {
    world = mostDramaticMoment(runs, bossDrama, (w) => w.wave === 10 && w.boss && (w.boss.dead || w.boss.phase === 2), () => createPilot(COVER_REACTION, 0, true));
  }
  if (kind === 'wave' || (kind === 'play' && !world)) {
    world = mostDramaticMoment(runs.slice(0, 20), waveDrama, (w) => w.wave > 8, () => createPilot(COVER_REACTION));
  }
  if (world) {
    game.world = world;
    game.colour = world.warden.colour;
    hooks.setMode('play');
  }
  for (let attempt = 0; attempt < 6 && !world; attempt += 1) {
    const runSeed = seed + attempt * 101;
    clearEffects();
    if (kind === 'title') {
      for (let t = 0; t < 4.6; t += STEP) {
        updateTitleScene(game.titleScene, STEP);
        updateEffects(STEP);
      }
      game.time = 4.6;
      hooks.setMode('title');
      world = game.titleScene;
    } else if (kind === 'upgrade') {
      world = playUntil(runSeed, (w) => w.wave === 9 && w.state === 'cleared' && w.stateTime > 1.3);
      if (world) {
        game.world = world;
        game.hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
        game.hovered = 1;
        game.time = 1;
        hooks.setMode('upgrade');
      }
    } else if (kind === 'results' || kind === 'defeat') {
      world = kind === 'results' ? playUntil(runSeed, (w) => w.state === 'won' && w.stateTime > 2.4) : playIdleUntilLost(runSeed);
      if (world && world.state === (kind === 'results' ? 'won' : 'lost')) {
        game.world = world;
        game.previousBest = game.best;
        game.newBest = world.score > game.best;
        game.best = Math.max(saveBestScore(world.score), world.score, game.best);
        game.time = 0.25;
        hooks.setMode('results');
      } else {
        world = null;
      }
    } else {
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
