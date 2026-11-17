// Screenshot scenes behind ?shot=title|play|entrance|upgrade|results|defeat: the real game played by the autopilot, frozen on the moment.
import { STEP } from './config.js';
import { autopilotControls, autopilotPick, createPilot } from './autopilot.js';
import { beginWave, createWorld, stepWorld } from './world.js';
import { applyUpgrade, dealUpgradeCards } from './upgrades.js';
import { clearEffects, updateEffects } from './particles.js';
import { saveBestScore, saveFeats } from './storage.js';
import { simRandom } from './random.js';
import { updateTitleScene } from './screens.js';

/** The upgrades a shot's pilot prefers: the ones that show off split and reflected light. */
const SHOT_PICKS = ['prism', 'reflect', 'lens', 'focus', 'chain', 'bastion', 'lance', 'pact', 'harvest', 'swift'];
const MAX_SECONDS = 60 * 12;
/** The best score on record in every scene, so the four screenshots tell one story (the winning run beats it). */
const RECORDED_BEST = 28410;
/** The feats that profile's winning run earned. */
const RECORDED_FEATS = ['Eclipse Breaker', 'Half-Hundred Combo', 'Named Build'];

/** Plays a run with the autopilot until `stop(world, step)`, taking upgrades between waves on a difficulty. */
export function playUntil(seed, stop, pilot = createPilot(0), difficulty = 'standard') {
  const world = createWorld(seed, difficulty);
  for (let step = 0; step < MAX_SECONDS / STEP; step += 1) {
    if (world.state === 'cleared' && world.stateTime > 1.3) {
      if (stop(world, step)) return world;
      const hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp, world.wave);
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

/** Sets up scene `kind`, draws it once and flags `window.__shotReady`; `play` replays seed to `step` (found by tools/find-cover.mjs). */
export function runShotScene(game, kind, seed, hooks) {
  const params = new URLSearchParams(window.location.search);
  saveBestScore(RECORDED_BEST);
  saveFeats(RECORDED_FEATS);
  hooks.loadProfile();
  let world = null;
  if (kind === 'play') {
    const step = Number(params.get('step'));
    world = playUntil(seed, (w, s) => s === step, createPilot(Number(params.get('reaction') ?? 0), 0, params.get('focus') === '1'));
    if (world) {
      game.world = world;
      game.colour = world.warden.colour;
      hooks.setMode('play');
    }
  }
  for (let attempt = 0; attempt < 6 && !world && kind !== 'play'; attempt += 1) {
    const runSeed = seed + attempt * 101;
    clearEffects();
    if (kind === 'entrance') {
      world = playUntil(runSeed, (w) => w.cinematic && w.cinematic.time > 1.15);
      if (world) {
        game.world = world;
        hooks.setMode('play');
      }
    } else if (kind === 'upgrade') {
      world = playUntil(runSeed, (w) => w.wave === 9 && w.state === 'cleared' && w.stateTime > 1.3);
      if (world) {
        game.world = world;
        game.hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp, world.wave);
        game.hovered = 1;
        game.time = 1;
        hooks.setMode('upgrade');
      }
    } else if (kind === 'results' || kind === 'defeat') {
      world = kind === 'results' ? playUntil(runSeed, (w) => w.state === 'won' && w.stateTime > 2.4) : playIdleUntilLost(runSeed);
      if (world && world.state === (kind === 'results' ? 'won' : 'lost')) {
        game.world = world;
        hooks.finishRun(world);
        game.time = 0.25;
        hooks.setMode('results');
      } else {
        world = null;
      }
    } else {
      for (let t = 0; t < 4.6; t += STEP) {
        updateTitleScene(game.titleScene, STEP);
        updateEffects(STEP);
      }
      game.time = 4.6;
      hooks.setMode('title');
      world = game.titleScene;
    }
  }
  hooks.drawFrame();
  window.__shotReady = true;
  window.__shotScene = { kind, found: Boolean(world), seed: world?.seed, wave: world?.wave, score: world?.score, best: game.best };
}
