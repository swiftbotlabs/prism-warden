// The menu screens: the title (with a live beam show), the upgrade choice of three cards, the results (VICTORY / CORE SHATTERED) and pause.
import { ARENA_H, ARENA_W, CORE_X, CORE_Y, FONT, LIGHTS, PALETTE, TAU, TOTAL_WAVES } from './config.js';
import { drawLightGlyph, drawUpgradeIcon } from './icons.js';
import { drawPanel, drawWinLoseLine } from './hud.js';
import { drawEclipse, drawWorld } from './render.js';
import { makeMirror } from './arena.js';
import { castPrismBeams } from './beam.js';
import { createShade, SHADE_KINDS } from './shades.js';
import { createEclipse, ECLIPSE_PHASES } from './boss.js';
import { createUpgradeLevels, upgradeById, upgradeLabel, upgradeSynergy, UPGRADES } from './upgrades.js';
import { WAVE_PLAN } from './waves.js';
import { colourAccuracy } from './world.js';

function text(ctx, value, x, y, size, colour, align = 'center', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
}

/** Splits `value` into lines no wider than `width` at the current font. */
function wrapLines(ctx, value, width) {
  const lines = [];
  let line = '';
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(5,4,16,${alpha})`;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
}

function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ----- Title -----------------------------------------------------------------------------------------------

/** The title's living backdrop: the real beam code bending light around mirrors past a ring of idle Shades. */
export function createTitleScene() {
  const levels = createUpgradeLevels();
  levels.prism = 2;
  levels.reflect = 2;
  const shades = [
    createShade('drifter', 0, 0, 0), createShade('darter', 1, 0, 0), createShade('prismling', 2, 0, 0),
    createShade('splitter', 1, 0, 0), createShade('bulwark', 0, 0, 0), createShade('drifter', 2, 0, 0),
  ];
  return {
    time: 0,
    levels,
    mirrors: [makeMirror(470, 300, 130, 0.9), makeMirror(830, 300, 130, -0.9), makeMirror(560, 590, 120, -0.35), makeMirror(740, 590, 120, 0.35)]
      .map((mirror) => ({ ...mirror, born: 1 })),
    shades,
    beams: [],
    motes: [],
    core: { hp: 12, maxHp: 12, shield: 1, flash: 0, healFlash: 0 },
    warden: { x: CORE_X, y: CORE_Y + 110, r: 13, colour: 0, aimX: 0, aimY: 0, swapFlash: 0 },
    state: 'title',
    stateTime: 0,
    shake: 0,
  };
}

/** Moves the title's Warden in a slow orbit, sweeping a prism-split beam, and keeps the Shades circling. */
export function updateTitleScene(scene, dt) {
  scene.time += dt;
  const t = scene.time;
  scene.shades.forEach((shade, index) => {
    const angle = t * 0.12 + (index / scene.shades.length) * TAU;
    shade.x = CORE_X + Math.cos(angle) * 225;
    shade.y = CORE_Y + 25 + Math.sin(angle) * 165;
    shade.age = t + index;
    if (shade.kind === 'prismling') shade.colour = Math.floor(t / 2) % 3;
    if (shade.shell) shade.rot = t * 0.5;
  });
  const warden = scene.warden;
  warden.colour = Math.floor(t / 3) % 3;
  warden.x = CORE_X + Math.cos(t * 0.35) * 120;
  warden.y = CORE_Y + Math.sin(t * 0.35) * 80;
  const sweep = t * 0.35 + Math.PI * 0.9 + Math.sin(t * 0.8) * 0.5;
  warden.aimX = warden.x + Math.cos(sweep) * 300;
  warden.aimY = warden.y + Math.sin(sweep) * 300;
  scene.beams = castPrismBeams({ mirrors: scene.mirrors, shades: [] }, warden.x, warden.y, warden.aimX, warden.aimY, warden.colour, scene.levels);
}

export function drawTitle(ctx, scene, best, time) {
  drawWorld(ctx, scene, time, false);
  const glow = ctx.createLinearGradient(0, 0, 0, 260);
  glow.addColorStop(0, 'rgba(5,4,16,0.85)');
  glow.addColorStop(1, 'rgba(5,4,16,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ARENA_W, 260);

  ctx.save();
  ctx.font = `900 96px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gradient = ctx.createLinearGradient(ARENA_W / 2 - 360, 0, ARENA_W / 2 + 360, 0);
  gradient.addColorStop(0, LIGHTS[0].hex);
  gradient.addColorStop(0.5, LIGHTS[1].hex);
  gradient.addColorStop(1, LIGHTS[2].hex);
  ctx.shadowColor = 'rgba(200,190,255,0.8)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = gradient;
  ctx.fillText('PRISM WARDEN', ARENA_W / 2, 104);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText('PRISM WARDEN', ARENA_W / 2, 104);
  ctx.restore();
  text(ctx, 'Bend light. Hold the core.', ARENA_W / 2, 156, 26, '#f4f0ff', 'center', 600);
  drawObjectiveLine(ctx, ARENA_W / 2, 196);
  const shadeKinds = Object.keys(SHADE_KINDS).filter((kind) => kind !== 'eclipse').length;
  const phases = ['one', 'two', 'three', 'four'][ECLIPSE_PHASES.length - 1] ?? ECLIPSE_PHASES.length;
  text(ctx, `${TOTAL_WAVES} waves · ${shadeKinds} kinds of Shade · ${UPGRADES.length} upgrades · a ${phases}-phase boss`, ARENA_W / 2, 232, 19, PALETTE.gold, 'center', 800);
  ctx.save();
  ctx.translate(0, 24);

  drawPanel(ctx, 36, 236, 330, 300, 14);
  text(ctx, 'CONTROLS', 60, 266, 18, PALETTE.gold, 'left');
  const controls = [
    ['WASD / Arrows', 'move the Warden'],
    ['Hold left mouse', 'cast the beam'],
    ['1 2 3 / Wheel', 'change colour'],
    ['P or Esc', 'pause'],
    ['M', 'mute sound'],
    ['R', 'restart'],
  ];
  controls.forEach(([key, action], index) => {
    const y = 306 + index * 37;
    text(ctx, key, 60, y, 17, '#ffffff', 'left', 800);
    text(ctx, action, 210, y, 17, PALETTE.dim, 'left', 600);
  });

  drawPanel(ctx, ARENA_W - 366, 236, 330, 300, 14);
  text(ctx, 'RULES OF LIGHT', ARENA_W - 342, 266, 18, PALETTE.gold, 'left');
  const rules = ['Ember burns red Shades', 'Verdant burns green Shades', 'Azure burns blue Shades'];
  text(ctx, "Match the beam to the Shade's colour", ARENA_W - 342, 300, 16, PALETTE.gold, 'left', 900);
  rules.forEach((rule, index) => {
    const y = 334 + index * 30;
    drawLightGlyph(ctx, index, ARENA_W - 330, y, 10);
    text(ctx, rule, ARENA_W - 308, y, 17, '#ffffff', 'left', 700);
  });
  const notes = ['Mirrors bounce your beam', 'Shades that reach the Core crack it', `Survive ${TOTAL_WAVES} waves and THE ECLIPSE`, 'Pick an upgrade after each wave'];
  notes.forEach((note, index) => text(ctx, note, ARENA_W - 342, 428 + index * 28, 16, PALETTE.dim, 'left', 600));
  ctx.restore();

  const pulse = 0.6 + 0.4 * Math.sin(time * 3.5);
  drawPanel(ctx, ARENA_W / 2 - 190, 640, 380, 64, 32, `rgba(255,212,110,${0.12 + 0.12 * pulse})`, `rgba(255,212,110,${0.5 + 0.5 * pulse})`);
  text(ctx, 'CLICK TO BEGIN', ARENA_W / 2, 673, 32, '#ffffff', 'center', 900);
  text(ctx, best > 0 ? `BEST SCORE ${best.toLocaleString('en-US')}` : 'NO BEST SCORE YET · SET ONE', ARENA_W / 2, 734, 18, PALETTE.gold, 'center', 800);
  text(ctx, 'An original game of light and colour · all art and sound made in code', ARENA_W / 2, 772, 14, PALETTE.faint, 'center', 600);
}

/** "OBJECTIVE" followed by the same WIN / LOSE line the play HUD shows. */
function drawObjectiveLine(ctx, cx, y) {
  drawWinLoseLine(ctx, cx, y, 21, true, 'OBJECTIVE   ');
}

// ----- Upgrade choice ----------------------------------------------------------------------------------------

const CARD_W = 300;
const CARD_GAP = 40;
/** Card layouts: the usual one, and a shorter one that leaves room for the THE ECLIPSE preview after wave 9. */
const CARD_LAYOUTS = {
  usual: { top: 196, h: 392, icon: 116, iconSize: 112, name: 214, level: 248, effect: 282, divider: 326, synergy: 348, header: 92, sub: 142, bar: 618, build: 722 },
  bossNext: { top: 296, h: 336, icon: 76, iconSize: 88, name: 152, level: 182, effect: 212, divider: 256, synergy: 278, header: 46, sub: 84, bar: 648, build: 726 },
};

/** True on the screen between wave 9 and the boss wave: the game previews THE ECLIPSE there. */
export function bossIsNext(world) {
  return world.wave === TOTAL_WAVES - 1;
}

/** Where the three cards sit, for drawing and for clicks. */
export function upgradeCardRects(count = 3, bossNext = false) {
  const layout = bossNext ? CARD_LAYOUTS.bossNext : CARD_LAYOUTS.usual;
  const left = ARENA_W / 2 - (count * CARD_W + (count - 1) * CARD_GAP) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: left + i * (CARD_W + CARD_GAP), y: layout.top, w: CARD_W, h: layout.h }));
}

/** The index of the card under (x, y), or -1. */
export function cardAt(x, y, count = 3, bossNext = false) {
  return upgradeCardRects(count, bossNext).findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

export function drawUpgradeChoice(ctx, world, hand, hovered, time) {
  drawWorld(ctx, world, time, false);
  dim(ctx, 0.62);
  const bossNext = bossIsNext(world);
  const layout = bossNext ? CARD_LAYOUTS.bossNext : CARD_LAYOUTS.usual;
  text(ctx, `WAVE ${world.wave} CLEARED`, ARENA_W / 2, layout.header, bossNext ? 40 : 46, PALETTE.gold, 'center', 900);
  text(ctx, 'Choose one upgrade · press 1, 2, 3 or click a card', ARENA_W / 2, layout.sub, bossNext ? 18 : 20, PALETTE.ink, 'center', 600);
  if (bossNext) drawEclipsePreview(ctx, time);

  upgradeCardRects(hand.length, bossNext).forEach((rect, index) => {
    const upgrade = upgradeById(hand[index]);
    const level = world.upgrades[upgrade.id];
    const lift = index === hovered ? 10 : 0;
    const y = rect.y - lift;
    const cx = rect.x + rect.w / 2;
    const accent = LIGHTS[index].rgb;
    const fill = ctx.createLinearGradient(0, y, 0, y + rect.h);
    fill.addColorStop(0, `rgba(${accent},0.22)`);
    fill.addColorStop(0.55, 'rgba(16,13,40,0.95)');
    fill.addColorStop(1, 'rgba(10,8,28,0.95)');
    drawPanel(ctx, rect.x, y, rect.w, rect.h, 18, fill, index === hovered ? '#ffffff' : `rgba(${accent},0.7)`);
    if (index === hovered) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(rect.x + 34, y + 34, 18, 0, TAU);
    ctx.fillStyle = `rgba(${accent},0.9)`;
    ctx.fill();
    text(ctx, String(index + 1), rect.x + 34, y + 35, 20, '#0a0918', 'center', 900);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, y + layout.icon, 4, cx, y + layout.icon, layout.iconSize * 0.8);
    halo.addColorStop(0, 'rgba(200,190,255,0.25)');
    halo.addColorStop(1, 'rgba(200,190,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(rect.x, y + 20, rect.w, layout.icon + layout.iconSize * 0.6);
    ctx.restore();
    drawUpgradeIcon(ctx, upgrade.id, cx, y + layout.icon + Math.sin(time * 2 + index) * 3, layout.iconSize);
    text(ctx, upgrade.name.toUpperCase(), cx, y + layout.name, 32, '#ffffff', 'center', 900);
    text(ctx, level === 0 ? 'NEW' : `LEVEL ${level} → ${level + 1}`, cx, y + layout.level, 16, PALETTE.gold, 'center', 800);
    ctx.font = `600 19px ${FONT}`;
    wrapLines(ctx, upgrade.line, rect.w - 50).forEach((line, i) => text(ctx, line, cx, y + layout.effect + i * 25, 19, PALETTE.ink, 'center', 600));
    ctx.fillStyle = 'rgba(160,150,255,0.3)';
    ctx.fillRect(rect.x + 30, y + layout.divider, rect.w - 60, 1.5);
    ctx.font = `800 17px ${FONT}`;
    wrapLines(ctx, upgradeSynergy(upgrade.id, world.upgrades), rect.w - 44).forEach((line, i) => text(ctx, line, cx, y + layout.synergy + i * 22, 17, '#9fffcf', 'center', 800));
  });

  const next = WAVE_PLAN[world.wave];
  drawPanel(ctx, ARENA_W / 2 - 380, layout.bar, 760, 48, 24);
  const core = world.core;
  text(ctx, `CORE ${Math.ceil(core.hp)}/${core.maxHp}   ·   SCORE ${world.score.toLocaleString('en-US')}   ·   NEXT: WAVE ${world.wave + 1} · ${next.title}`, ARENA_W / 2, layout.bar + 24, 18, PALETTE.ink, 'center', 700);
  drawBuild(ctx, world.upgrades, ARENA_W / 2, layout.build, 'YOUR BUILD');
}

/** "NEXT: THE ECLIPSE": the boss drawn by its own renderer, beside its three phases named one per line. */
function drawEclipsePreview(ctx, time) {
  const cx = ARENA_W / 2;
  drawPanel(ctx, cx - 420, 104, 840, 176, 18, 'rgba(8,6,22,0.88)', 'rgba(255,212,110,0.45)');
  const boss = createEclipse();
  boss.x = 0;
  boss.y = 0;
  boss.entering = 0;
  boss.rot = time * 0.5;
  boss.colour = Math.floor(time / 2.6) % 3;
  ctx.save();
  ctx.translate(cx - 290, 192);
  ctx.scale(0.82, 0.82);
  drawEclipse(ctx, boss, time, { label: false });
  ctx.restore();
  const left = cx - 160;
  text(ctx, 'NEXT: THE ECLIPSE', left, 136, 34, PALETTE.gold, 'left', 900);
  ECLIPSE_PHASES.forEach((phase, index) => {
    const y = 176 + index * 30;
    if (phase.colour >= 0) drawLightGlyph(ctx, phase.colour, left + 8, y, 8);
    else [0, 1, 2].forEach((colour, i) => drawLightGlyph(ctx, colour, left + i * 9, y, 4.5));
    text(ctx, `${['I', 'II', 'III'][index]} · ${phase.name}`, left + 26, y + 1, 19, '#ffffff', 'left', 900);
    text(ctx, phase.blurb, left + 200, y + 1, 18, PALETTE.dim, 'left', 700);
  });
}

/** The upgrades a run owns as one centred row of named chips ("Prism II"), with a label in front. */
function drawBuild(ctx, levels, cx, y, label) {
  const owned = UPGRADES.filter((upgrade) => levels[upgrade.id] > 0);
  if (owned.length === 0) return;
  ctx.font = `800 17px ${FONT}`;
  const chips = owned.map((upgrade) => {
    const name = upgradeLabel(upgrade.id, levels[upgrade.id]);
    return { id: upgrade.id, name, width: ctx.measureText(name).width + 50 };
  });
  ctx.font = `900 15px ${FONT}`;
  const labelWidth = ctx.measureText(label).width + 14;
  const total = labelWidth + chips.reduce((sum, chip) => sum + chip.width + 8, -8);
  let x = cx - total / 2;
  text(ctx, label, x, y, 15, PALETTE.gold, 'left', 900);
  x += labelWidth;
  for (const chip of chips) {
    drawPanel(ctx, x, y - 17, chip.width, 34, 10, 'rgba(20,16,48,0.9)', 'rgba(160,150,255,0.35)');
    drawUpgradeIcon(ctx, chip.id, x + 20, y, 26);
    text(ctx, chip.name, x + 38, y + 1, 17, '#ffffff', 'left', 800);
    x += chip.width + 8;
  }
}

// ----- Results ------------------------------------------------------------------------------------------------

export function drawResults(ctx, world, best, isNewBest, previousBest, time) {
  drawWorld(ctx, world, time, false);
  const won = world.state === 'won';
  dim(ctx, won ? 0.5 : 0.66);
  ctx.save();
  ctx.shadowColor = won ? 'rgba(255,212,110,0.9)' : 'rgba(255,84,104,0.9)';
  ctx.shadowBlur = 34;
  text(ctx, won ? 'VICTORY' : 'CORE SHATTERED', ARENA_W / 2, 74, won ? 84 : 72, won ? '#fff2c9' : '#ff8293', 'center', 900);
  ctx.restore();
  if (won) drawFallenEclipse(ctx, ARENA_W / 2, 164, time);
  text(ctx, won ? 'THE ECLIPSE is broken. The Core holds.' : `The Shades broke through on wave ${world.wave}.`, ARENA_W / 2, won ? 226 : 150, 21, PALETTE.ink, 'center', 600);

  const panelX = ARENA_W / 2 - 300;
  const top = 250;
  drawPanel(ctx, panelX, top, 600, 284, 18, 'rgba(14,11,36,0.92)');
  const rows = [
    ['Waves cleared', `${world.stats.wavesCleared} / ${TOTAL_WAVES}`],
    ['Shades dispelled', String(world.stats.kills)],
    ['Colour accuracy', `${colourAccuracy(world)}%`],
    ['Best combo', String(world.stats.bestCombo)],
    ['Time', formatTime(world.stats.time)],
  ];
  rows.forEach(([label, value], index) => {
    const y = top + 30 + index * 34;
    text(ctx, label, panelX + 40, y, 20, PALETTE.dim, 'left', 600);
    text(ctx, value, panelX + 560, y, 22, '#ffffff', 'right', 800);
  });
  ctx.fillStyle = 'rgba(160,150,255,0.25)';
  ctx.fillRect(panelX + 30, top + 188, 540, 1.5);
  text(ctx, 'SCORE', panelX + 40, top + 218, 22, PALETTE.gold, 'left', 800);
  text(ctx, world.score.toLocaleString('en-US'), panelX + 560, top + 220, 42, '#ffffff', 'right', 900);
  const bestY = top + 258;
  text(ctx, isNewBest ? `PREVIOUS BEST ${previousBest.toLocaleString('en-US')}` : `BEST ${best.toLocaleString('en-US')}`, panelX + 40, bestY, 18, PALETTE.dim, 'left', 700);
  if (isNewBest) {
    const pop = 1 + 0.06 * Math.sin(time * 6);
    ctx.save();
    ctx.translate(panelX + 470, bestY + 2);
    ctx.scale(pop, pop);
    drawPanel(ctx, -90, -17, 180, 34, 17, 'rgba(255,212,110,0.95)', '#ffffff');
    text(ctx, 'NEW BEST!', 0, 1, 19, '#1a1030', 'center', 900);
    ctx.restore();
  } else {
    text(ctx, world.score >= best ? '' : `${(best - world.score).toLocaleString('en-US')} short of best`, panelX + 560, bestY, 16, PALETTE.dim, 'right', 600);
  }
  drawBuild(ctx, world.upgrades, ARENA_W / 2, 582, 'BUILD TAKEN');

  const pulse = 0.6 + 0.4 * Math.sin(time * 3.5);
  drawPanel(ctx, ARENA_W / 2 - 250, 628, 500, 60, 30, `rgba(255,212,110,${0.1 + 0.12 * pulse})`, `rgba(255,212,110,${0.5 + 0.5 * pulse})`);
  text(ctx, 'Press R or click to play again', ARENA_W / 2, 659, 26, '#ffffff', 'center', 800);
  text(ctx, 'Esc returns to the title', ARENA_W / 2, 712, 16, PALETTE.dim, 'center', 600);
  if (won) text(ctx, `Lose the Core and the run ends: CORE SHATTERED · press R to try again`, ARENA_W / 2, 744, 16, '#ff9aa8', 'center', 700);
}

/** The beaten boss under VICTORY: THE ECLIPSE drawn small by its own renderer, dimmed and cracked. */
function drawFallenEclipse(ctx, x, y, time) {
  const boss = createEclipse();
  boss.x = 0;
  boss.y = 0;
  boss.entering = 0;
  boss.dead = true;
  boss.rot = time * 0.1;
  boss.colour = 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.62, 0.62);
  drawEclipse(ctx, boss, time, { label: false, fallen: true });
  ctx.restore();
}

// ----- Pause -------------------------------------------------------------------------------------------------

export function drawPause(ctx, muted) {
  dim(ctx, 0.66);
  text(ctx, 'PAUSED', ARENA_W / 2, 270, 72, '#ffffff', 'center', 900);
  text(ctx, 'P or Esc to resume  ·  R to restart  ·  Q to quit to title', ARENA_W / 2, 350, 22, PALETTE.ink, 'center', 600);
  text(ctx, `M toggles sound (now ${muted ? 'off' : 'on'})`, ARENA_W / 2, 392, 18, PALETTE.dim, 'center', 600);
}
