// Boots Prism Warden: canvas and devicePixelRatio scaling, the fixed-step loop, the screen flow (title, play, upgrade, pause, results) and sound cues.
import { ARENA_H, ARENA_W, LIGHTS, PALETTE, STEP } from './config.js';
import { createInput, movementAxes, takeClicks, takePresses, takeWheel } from './input.js';
import { isMuted, playSound, setBeamHum, setMusicMood, setMuted, unlockAudio } from './audio.js';
import { buildBackdrop, drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { cardAt, createTitleScene, drawPause, drawResults, drawTitle, drawUpgradeChoice, updateTitleScene } from './screens.js';
import { beginWave, createWorld, stepWorld } from './world.js';
import { applyUpgrade, dealUpgradeCards, upgradeById } from './upgrades.js';
import { clearEffects, updateEffects } from './particles.js';
import { loadBestScore, loadMuted, saveBestScore, saveMuted } from './storage.js';
import { simRandom } from './random.js';
import { runShotScene } from './shots.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const view = { scale: 1, offsetX: 0, offsetY: 0, ratio: 1 };

/** Everything the screen flow needs between frames. */
const game = {
  mode: 'title',
  world: null,
  titleScene: createTitleScene(),
  hand: [],
  hovered: -1,
  best: loadBestScore(),
  newBest: false,
  previousBest: 0,
  colour: 0,
  time: 0,
  modeTime: 0,
  frozen: false,
};

/** Sizes the canvas to the window at device resolution and letterboxes the 16:10 arena inside it. */
function fitCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  view.ratio = ratio;
  view.scale = Math.min(width / ARENA_W, height / ARENA_H);
  view.offsetX = (width - ARENA_W * view.scale) / 2;
  view.offsetY = (height - ARENA_H * view.scale) / 2;
  buildBackdrop(ratio * view.scale);
}

function toArena(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left - view.offsetX) / view.scale, y: (clientY - rect.top - view.offsetY) / view.scale };
}

const input = createInput(canvas, toArena);

function announce(message) {
  statusLine.textContent = message;
}

function setMode(mode) {
  game.mode = mode;
  game.modeTime = 0;
}

/** A fresh run from wave 1. */
export function startRun(seed = (Date.now() ^ (performance.now() * 1000)) >>> 0) {
  clearEffects();
  game.world = createWorld(seed);
  game.colour = 0;
  game.newBest = false;
  setMode('play');
  setMusicMood('play');
  announce('Wave 1 begins. Defend the Core.');
}

function toTitle() {
  clearEffects();
  game.world = null;
  setMode('title');
  setMusicMood('title');
  setBeamHum(false, 0, false);
  announce('Title screen. Click to begin.');
}

function toggleMute() {
  setMuted(!isMuted());
  saveMuted(isMuted());
}

/** Takes card `index` from the hand and starts the next wave. */
function pickCard(index) {
  const id = game.hand[index];
  if (!id) return;
  applyUpgrade(game.world, id);
  playSound('card', 0, index);
  beginWave(game.world, game.world.wave + 1);
  setMode('play');
  setMusicMood(game.world.wave === 10 ? 'calm' : 'play');
  announce(`${upgradeById(id).name} chosen. Wave ${game.world.wave} begins.`);
}

/** Reads this step's presses and clicks and moves between screens. */
function handleScreenInput() {
  const presses = takePresses(input);
  const clicks = takeClicks(input);
  const wheel = takeWheel(input);
  if (presses.length > 0 || clicks > 0) unlockAudio();
  if (presses.includes('KeyM')) toggleMute();

  switch (game.mode) {
    case 'title':
      if (clicks > 0 || presses.includes('Enter') || presses.includes('Space')) {
        playSound('click');
        startRun();
      }
      break;
    case 'play': {
      if (presses.includes('KeyP') || presses.includes('Escape')) {
        setMode('paused');
        playSound('pause');
        announce('Paused.');
        break;
      }
      if (presses.includes('KeyR')) {
        startRun();
        break;
      }
      for (const code of presses) {
        const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
        if (index >= 0) game.colour = index;
      }
      if (wheel !== 0) game.colour = (game.colour + (wheel > 0 ? 1 : 2)) % 3;
      break;
    }
    case 'upgrade': {
      const hovered = cardAt(input.mouseX, input.mouseY, game.hand.length);
      if (hovered !== game.hovered && hovered >= 0) playSound('hover', 0, hovered);
      game.hovered = hovered;
      const key = presses.map((code) => ['Digit1', 'Digit2', 'Digit3'].indexOf(code)).find((index) => index >= 0);
      if (key !== undefined) pickCard(key);
      else if (clicks > 0 && hovered >= 0 && game.modeTime > 0.3) pickCard(hovered);
      break;
    }
    case 'paused':
      if (presses.includes('KeyP') || presses.includes('Escape')) {
        setMode('play');
        playSound('pause');
        announce('Resumed.');
      } else if (presses.includes('KeyR')) startRun();
      else if (presses.includes('KeyQ')) toTitle();
      break;
    case 'results':
      if (game.modeTime < 0.8) break;
      if (presses.includes('KeyR') || presses.includes('Enter') || presses.includes('Space') || clicks > 0) startRun();
      else if (presses.includes('Escape')) toTitle();
      break;
    default:
      break;
  }
}

/** Turns the run's events into sounds and spoken status. */
function playWorldEvents(world) {
  for (const event of world.events) {
    switch (event.type) {
      case 'kill':
        playSound('kill', event.colour, event.combo);
        break;
      case 'hit':
        playSound('hit', event.colour);
        break;
      case 'select':
        playSound('select', event.colour);
        break;
      case 'boss':
        playSound('boss');
        setMusicMood('boss');
        announce('THE ECLIPSE rises.');
        break;
      case 'cleared':
        playSound('shield');
        announce(`Wave ${world.wave} cleared.`);
        break;
      case 'victory':
        playSound('victory');
        setMusicMood('calm');
        announce('Victory! The Core holds.');
        break;
      case 'defeat':
        playSound('defeat');
        setMusicMood('calm');
        announce('The Core shattered.');
        break;
      default:
        playSound(event.type);
        break;
    }
  }
  world.events.length = 0;
}

/** One fixed step of the whole game. */
function stepGame(dt) {
  game.time += dt;
  game.modeTime += dt;
  handleScreenInput();
  const world = game.world;
  if (game.mode === 'title') {
    updateTitleScene(game.titleScene, dt);
  } else if (game.mode === 'play' || game.mode === 'results') {
    const axes = movementAxes(input);
    stepWorld(world, {
      moveX: game.mode === 'play' ? axes.x : 0,
      moveY: game.mode === 'play' ? axes.y : 0,
      aimX: input.mouseX,
      aimY: input.mouseY,
      casting: game.mode === 'play' && input.mouseDown,
      colour: game.colour,
    }, dt);
    playWorldEvents(world);
    if (game.mode === 'play' && world.state === 'cleared' && world.stateTime > 1.3) {
      game.hand = dealUpgradeCards(world.upgrades, simRandom, world.core.hp / world.core.maxHp);
      game.hovered = -1;
      setMode('upgrade');
      setMusicMood('calm');
    }
    if (game.mode === 'play' && (world.state === 'won' || world.state === 'lost') && world.stateTime > 2.4) {
      game.previousBest = game.best;
      game.newBest = world.score > game.best;
      game.best = saveBestScore(world.score);
      setMode('results');
    }
  }
  if (game.mode !== 'paused') updateEffects(dt);
  const casting = game.mode === 'play' && game.world?.state === 'fight' && input.mouseDown;
  setBeamHum(casting, game.colour, casting && game.world.hitting);
}

/** Draws the current screen, letterboxed and scaled for the device. */
export function drawFrame() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05040d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const k = view.ratio * view.scale;
  ctx.setTransform(k, 0, 0, k, view.offsetX * view.ratio, view.offsetY * view.ratio);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ARENA_W, ARENA_H);
  ctx.clip();
  const world = game.world;
  switch (game.mode) {
    case 'title':
      drawTitle(ctx, game.titleScene, game.best, game.time);
      break;
    case 'upgrade':
      drawUpgradeChoice(ctx, world, game.hand, game.hovered, game.time);
      break;
    case 'results':
      drawResults(ctx, world, game.best, game.newBest, game.previousBest, game.time);
      break;
    default:
      drawWorld(ctx, world, game.time, game.mode === 'play');
      drawHud(ctx, world, game.best, game.time, isMuted());
      if (game.mode === 'paused') drawPause(ctx, isMuted());
      break;
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.strokeRect(0, 0, ARENA_W, ARENA_H);
}

let last = performance.now();
let backlog = 0;
function frame(now) {
  if (game.frozen) return;
  backlog = Math.min(backlog + (now - last) / 1000, 0.25);
  last = now;
  while (backlog >= STEP) {
    stepGame(STEP);
    backlog -= STEP;
  }
  drawFrame();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', fitCanvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'play') setMode('paused');
});
setMuted(loadMuted());
fitCanvas();

/** Read-only handle for automated playtests: the current screen and run. */
window.__prismWarden = { get mode() { return game.mode; }, get world() { return game.world; }, get best() { return game.best; } };

const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  game.frozen = true;
  runShotScene(game, params.get('shot'), Number(params.get('seed') ?? 7), { setMode, drawFrame, startRun });
  if (params.has('live')) {
    game.frozen = false;
    last = performance.now();
    requestAnimationFrame(frame);
  }
} else {
  announce(`Prism Warden. ${LIGHTS.map((light) => light.name).join(', ')}. Click to begin.`);
  requestAnimationFrame(frame);
}
