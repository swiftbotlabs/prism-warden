// Screenshot scenes behind ?shot=title|play|upgrade|results|defeat&seed=n: the real game played forward by the autopilot at fixed steps, frozen on the moment.
import { STEP } from './config.js';
import { autopilotControls, autopilotPick, createPilot } from './autopilot.js';
import { beginWave, createWorld, stepWorld } from './world.js';
import { applyUpgrade, dealUpgradeCards } from './upgrades.js';
import { liveParticleCount, updateEffects, clearEffects } from './particles.js';
import { simRandom } from './random.js';
import { updateTitleScene } from './screens.js';

/** The upgrades a shot's pilot prefers: the ones that show off split and reflected light. */
const SHOT_PICKS = ['prism', 'reflect', 'lens', 'focus', 'chain', 'bastion', 'lance', 'harvest', 'swift'];
const MAX_SECONDS = 60 * 12;

/**
 * Plays a run with the autopilot until `stop(world)` says so (checked once a step), taking upgrades on the way.
 * Returns the world, or null if the run ended or ran out of time first.
 */
function playUntil(seed, stop, picks = SHOT_PICKS) {
  const world = createWorld(seed);
  const pilot = createPilot(0);
  for (let step = 0; step < MAX_SECONDS / STEP; step += 1) {
    if (world.state === 'cleared' && world.stateTime > 1.3) {
      if (stop(world)) return world;
      const hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
      const preferred = picks.find((id) => hand.includes(id));
      applyUpgrade(world, preferred ?? hand[autopilotPick(hand, world.upgrades)]);
      beginWave(world, world.wave + 1);
    }
    stepWorld(world, autopilotControls(world, pilot, STEP), STEP);
    world.events.length = 0;
    updateEffects(STEP);
    if (stop(world)) return world;
    if (world.state === 'lost' && world.stateTime > 2.5) return null;
  }
  return null;
}

/** A busy, readable mid-run frame: wave 7+, many Shades of several kinds, split and bounced beams, a live combo. */
function isDramatic(world) {
  if (world.wave < 7 || world.state !== 'fight' || world.banner) return false;
  const onScreen = world.shades.filter((s) => !s.dead && s.x > 20 && s.x < 1260 && s.y > 110 && s.y < 720);
  const kinds = new Set(onScreen.map((s) => s.kind));
  const bounces = world.beams.reduce((sum, beam) => sum + beam.bounces.length / 2, 0);
  const warden = world.warden;
  return onScreen.length >= 13 && kinds.size >= 4 && world.beams.length >= 3 && bounces >= 2
    && world.combo >= 8 && world.core.hp >= world.core.maxHp * 0.6 && liveParticleCount() > 120
    && warden.y > 150 && warden.y < 690;
}

/** Sets up scene `kind` from `seed`, draws it once and flags `window.__shotReady` for the capture script. */
export function runShotScene(game, kind, seed, hooks) {
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
        game.best = Math.max(game.best, 41250);
        hooks.setMode('title');
        world = game.titleScene;
        break;
      case 'play':
        world = playUntil(runSeed, isDramatic);
        if (world) {
          game.world = world;
          game.colour = world.warden.colour;
          hooks.setMode('play');
        }
        break;
      case 'upgrade':
        world = playUntil(runSeed, (w) => w.wave === 5 && w.state === 'cleared' && w.stateTime > 1.3);
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
          game.newBest = true;
          game.best = world.score;
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
  window.__shotScene = { kind, found: Boolean(world) };
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
