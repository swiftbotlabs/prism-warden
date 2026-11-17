// The menu screens: the title (with a live beam show), the upgrade choice of three cards, the results (VICTORY / CORE SHATTERED) and pause.
import { ARENA_H, ARENA_W, CORE_X, CORE_Y, FONT, LIGHTS, PALETTE, TAU, TOTAL_WAVES } from './config.js';
import { drawLightGlyph, drawUpgradeIcon } from './icons.js';
import { drawBuildIcons, drawKeyCaps, drawPanel, drawWinLoseLine } from './hud.js';
import { drawCreature } from './sprites.js';
import { drawEclipse, drawWorld } from './render.js';
import { makeMirror } from './arena.js';
import { castPrismBeams } from './beam.js';
import { createShade } from './shades.js';
import { createEclipse, ENTRANCE_TIME } from './boss.js';
import { BOSS_PHASES, DIFFICULTIES, FEATS, SHADE_KINDS, WAVE_TABLE } from './rules.js';
import { buildSynergies, createUpgradeLevels, upgradeById, upgradeLabel, upgradeSynergy, UPGRADES } from './upgrades.js';
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
  ctx.fillStyle = `rgba(40,22,10,${alpha})`;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
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

export function drawTitle(ctx, scene, profile, time) {
  drawWorld(ctx, scene, time, false);
  const glow = ctx.createLinearGradient(0, 0, 0, 260);
  glow.addColorStop(0, 'rgba(42,22,10,0.85)');
  glow.addColorStop(1, 'rgba(42,22,10,0)');
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
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#2a1a12';
  ctx.strokeText('PRISM WARDEN', ARENA_W / 2, 104);
  ctx.shadowColor = 'rgba(255,220,150,0.8)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = gradient;
  ctx.fillText('PRISM WARDEN', ARENA_W / 2, 104);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff4dc';
  ctx.strokeText('PRISM WARDEN', ARENA_W / 2, 104);
  ctx.restore();
  text(ctx, 'Bend light. Hold the core.', ARENA_W / 2, 156, 26, PALETTE.cream, 'center', 700);
  drawObjectiveLine(ctx, ARENA_W / 2, 196);
  drawRoster(ctx);
  drawColourRule(ctx);
  difficultyRects().forEach((rect, index) => {
    const difficulty = DIFFICULTIES[index];
    const chosen = difficulty.id === profile.difficulty;
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, 12, chosen ? '#f3c96a' : PALETTE.panel, chosen ? PALETTE.ink : PALETTE.panelEdge);
    text(ctx, difficulty.name, rect.x + rect.w / 2, rect.y + 15, 16, PALETTE.ink, 'center', 900);
    const best = profile.bests[difficulty.id];
    text(ctx, best > 0 ? `best ${best.toLocaleString('en-US')}` : 'no run yet', rect.x + rect.w / 2, rect.y + 33, 13, PALETTE.dim, 'center', 800);
  });
  const pulse = 0.6 + 0.4 * Math.sin(time * 3.5);
  drawPanel(ctx, ARENA_W / 2 - 190, 640, 380, 64, 32, `rgba(243,201,106,${0.85 + 0.15 * pulse})`, PALETTE.ink);
  text(ctx, 'CLICK TO BEGIN', ARENA_W / 2, 673, 32, PALETTE.ink, 'center', 900);
  drawPanel(ctx, ARENA_W / 2 - 80, 718, 160, 32, 16);
  text(ctx, `FEATS ${profile.feats.length} / ${FEATS.length}`, ARENA_W / 2, 735, 16, PALETTE.gold, 'center', 900);
  drawKeyCaps(ctx, false);
  if (profile.bestiary) drawBestiary(ctx);
}

const ROSTER = ['drifter', 'darter', 'splitter', 'prismling', 'bulwark', 'umbra', 'eclipse'];

/** The title's roster: every Shade kind as a portrait and a name (B opens the Bestiary with what each does). */
function drawRoster(ctx) {
  drawPanel(ctx, 36, 236, 250, 330, 14);
  ROSTER.forEach((kind, index) => {
    const y = 266 + index * 40;
    drawCreature(ctx, kind, index % 3, 72, y, kind === 'eclipse' ? 36 : 46);
    text(ctx, SHADE_KINDS[kind].label, 104, y + 1, 18, PALETTE.ink, 'left', 900);
  });
  text(ctx, 'B · Bestiary', 60, 552, 14, PALETTE.dim, 'left', 800);
}

/** The colour rule as pictures: each beam colour beside the creature it burns. */
function drawColourRule(ctx) {
  drawPanel(ctx, ARENA_W - 286, 236, 250, 214, 14);
  text(ctx, 'MATCH COLOUR', ARENA_W - 161, 262, 18, PALETTE.gold, 'center', 900);
  LIGHTS.slice(0, 3).forEach((light, index) => {
    const y = 310 + index * 50;
    ctx.beginPath();
    ctx.moveTo(ARENA_W - 262, y);
    ctx.lineTo(ARENA_W - 182, y);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = light.hex;
    ctx.lineWidth = 6;
    ctx.stroke();
    drawLightGlyph(ctx, index, ARENA_W - 160, y, 9);
    drawCreature(ctx, 'drifter', index, ARENA_W - 100, y, 50);
  });
}

/** The Bestiary (B on the title): each Shade with what it does. */
function drawBestiary(ctx) {
  drawPanel(ctx, ARENA_W / 2 - 300, 230, 600, 330, 16);
  ROSTER.forEach((kind, index) => {
    const y = 262 + index * 42;
    drawCreature(ctx, kind, index % 3, ARENA_W / 2 - 262, y, kind === 'eclipse' ? 32 : 40);
    text(ctx, SHADE_KINDS[kind].label, ARENA_W / 2 - 230, y, 17, PALETTE.ink, 'left', 900);
    text(ctx, SHADE_KINDS[kind].line, ARENA_W / 2 - 110, y, 16, PALETTE.dim, 'left', 700);
  });
}

/** The three difficulty chips under the title scene. */
function difficultyRects() {
  return DIFFICULTIES.map((_, i) => ({ x: ARENA_W / 2 - 262 + i * 178, y: 578, w: 168, h: 46 }));
}

/** The difficulty chip under (x, y), or -1. */
export function difficultyAt(x, y) {
  return difficultyRects().findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
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
  text(ctx, `WAVE ${world.wave} CLEARED`, ARENA_W / 2, layout.header, bossNext ? 40 : 46, '#ffcf7a', 'center', 900);
  text(ctx, 'Choose one upgrade · press 1, 2, 3 or click a card', ARENA_W / 2, layout.sub, bossNext ? 18 : 20, PALETTE.cream, 'center', 700);
  if (bossNext) drawEclipsePreview(ctx, time);

  upgradeCardRects(hand.length, bossNext).forEach((rect, index) => {
    const upgrade = upgradeById(hand[index]);
    const level = world.upgrades[upgrade.id];
    const lift = index === hovered ? 10 : 0;
    const y = rect.y - lift;
    const cx = rect.x + rect.w / 2;
    const accent = LIGHTS[index].rgb;
    const fill = ctx.createLinearGradient(0, y, 0, y + rect.h);
    fill.addColorStop(0, '#fbf1da');
    fill.addColorStop(1, '#ecd7ad');
    drawPanel(ctx, rect.x, y, rect.w, rect.h, 18, fill, upgrade.price ? PALETTE.danger : index === hovered ? PALETTE.ink : LIGHTS[index].hex);
    ctx.lineWidth = index === hovered ? 5 : 3.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rect.x + 34, y + 34, 18, 0, TAU);
    ctx.fillStyle = `rgba(${accent},0.9)`;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, String(index + 1), rect.x + 34, y + 35, 20, PALETTE.ink, 'center', 900);
    const well = layout.iconSize * 0.62;
    drawPanel(ctx, cx - well, y + layout.icon - well, well * 2, well * 2, 16, PALETTE.inkPanel, PALETTE.panelEdge);
    drawUpgradeIcon(ctx, upgrade.id, cx, y + layout.icon + Math.sin(time * 2 + index) * 3, layout.iconSize);
    text(ctx, upgrade.name.toUpperCase(), cx, y + layout.name, 32, PALETTE.ink, 'center', 900);
    text(ctx, level === 0 ? 'NEW' : `LEVEL ${level} → ${level + 1}`, cx, y + layout.level, 16, PALETTE.gold, 'center', 800);
    ctx.font = `600 19px ${FONT}`;
    wrapLines(ctx, upgrade.line, rect.w - 50).forEach((line, i) => text(ctx, line, cx, y + layout.effect + i * 25, 19, PALETTE.ink, 'center', 600));
    if (upgrade.price) text(ctx, upgrade.price, cx, y + layout.effect + 25, 17, PALETTE.danger, 'center', 900);
    ctx.fillStyle = 'rgba(42,26,18,0.3)';
    ctx.fillRect(rect.x + 30, y + layout.divider, rect.w - 60, 1.5);
    ctx.font = `800 17px ${FONT}`;
    const synergy = upgradeSynergy(upgrade.id, world.upgrades);
    if (synergy) wrapLines(ctx, synergy.text, rect.w - 44).forEach((line, i) => text(ctx, line, cx, y + layout.synergy + i * 22, 17, synergy.completes ? PALETTE.win : PALETTE.dim, 'center', 900));
  });

  const next = WAVE_TABLE[world.wave];
  drawPanel(ctx, ARENA_W / 2 - 380, layout.bar, 760, 48, 24);
  const core = world.core;
  text(ctx, `CORE ${Math.ceil(core.hp)}/${core.maxHp}   ·   SCORE ${world.score.toLocaleString('en-US')}   ·   NEXT: WAVE ${world.wave + 1} · ${next.title}`, ARENA_W / 2, layout.bar + 24, 18, PALETTE.ink, 'center', 700);
  drawBuild(ctx, world.upgrades, ARENA_W / 2, layout.build, 'YOUR BUILD');
}

/** "NEXT: THE ECLIPSE": the boss drawn by its own renderer, beside its three phases named one per line. */
function drawEclipsePreview(ctx, time) {
  const cx = ARENA_W / 2;
  drawPanel(ctx, cx - 420, 104, 840, 176, 18, PALETTE.inkPanel, PALETTE.panelEdge);
  const boss = createEclipse();
  boss.x = 0;
  boss.y = 0;
  boss.entering = 0;
  boss.rot = time * 0.5;
  boss.colour = Math.floor(time / 2.6) % 3;
  ctx.save();
  ctx.translate(cx - 290, 192);
  ctx.scale(0.55, 0.55);
  drawEclipse(ctx, boss, time);
  ctx.restore();
  const left = cx - 160;
  text(ctx, 'NEXT: THE ECLIPSE', left, 136, 34, '#ffcf7a', 'left', 900);
  BOSS_PHASES.forEach((phase, index) => {
    const y = 176 + index * 30;
    if (phase.colour >= 0) drawLightGlyph(ctx, phase.colour, left + 8, y, 8);
    else [0, 1, 2].forEach((colour, i) => drawLightGlyph(ctx, colour, left + i * 9, y, 4.5));
    text(ctx, `${['I', 'II', 'III'][index]} · ${phase.name}`, left + 26, y + 1, 19, PALETTE.cream, 'left', 900);
    text(ctx, phase.blurb, left + 200, y + 1, 18, '#d9c2a0', 'left', 700);
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
  const names = buildSynergies(levels).map((synergy) => synergy.name).join(' + ');
  if (names) label = `${label} · ${names}`;
  const labelWidth = ctx.measureText(label).width + 14;
  const total = labelWidth + chips.reduce((sum, chip) => sum + chip.width + 8, -8);
  let x = cx - total / 2;
  text(ctx, label, x, y, 15, '#ffcf7a', 'left', 900);
  x += labelWidth;
  for (const chip of chips) {
    drawPanel(ctx, x, y - 17, chip.width, 34, 10);
    drawPanel(ctx, x + 4, y - 13, 30, 26, 6, PALETTE.inkPanel, PALETTE.inkPanel);
    drawUpgradeIcon(ctx, chip.id, x + 19, y, 24);
    text(ctx, chip.name, x + 40, y + 1, 17, PALETTE.ink, 'left', 800);
    x += chip.width + 8;
  }
}

// ----- Results ------------------------------------------------------------------------------------------------

export function drawResults(ctx, world, profile, time) {
  drawWorld(ctx, world, time, false);
  const won = world.state === 'won';
  dim(ctx, won ? 0.5 : 0.66);
  ctx.save();
  ctx.shadowColor = won ? 'rgba(255,212,110,0.9)' : 'rgba(255,84,104,0.9)';
  ctx.shadowBlur = 34;
  text(ctx, won ? 'VICTORY' : 'CORE SHATTERED', ARENA_W / 2, 74, won ? 84 : 72, won ? '#fff2c9' : '#ff8293', 'center', 900);
  ctx.restore();
  if (won) drawFallenEclipse(ctx, ARENA_W / 2, 164, time);
  else text(ctx, `The Shades broke through on wave ${world.wave}`, ARENA_W / 2, 150, 21, PALETTE.cream, 'center', 700);

  const cx = ARENA_W / 2;
  const top = 246;
  drawPanel(ctx, cx - 230, top, 460, 262, 18);
  [['Waves', `${world.stats.wavesCleared}/${TOTAL_WAVES}`], ['Shades', String(world.stats.kills)], ['Accuracy', `${colourAccuracy(world)}%`], ['Best combo', String(world.stats.bestCombo)]]
    .forEach(([label, value], index) => {
      text(ctx, label, cx - 196, top + 32 + index * 36, 21, PALETTE.dim, 'left', 700);
      text(ctx, value, cx + 196, top + 32 + index * 36, 24, PALETTE.ink, 'right', 900);
    });
  text(ctx, world.score.toLocaleString('en-US'), cx + 196, top + 196, 48, PALETTE.ink, 'right', 900);
  text(ctx, 'SCORE', cx - 196, top + 196, 22, PALETTE.gold, 'left', 900);
  text(ctx, profile.newBest ? `NEW BEST · was ${profile.previousBest.toLocaleString('en-US')}` : `best ${profile.best.toLocaleString('en-US')}`,
    cx + 196, top + 238, 17, profile.newBest ? PALETTE.danger : PALETTE.dim, 'right', 900);

  drawPanel(ctx, 40, top, 300, 262, 18);
  text(ctx, 'SCORE PER WAVE', 60, top + 26, 15, PALETTE.gold, 'left', 900);
  const scores = world.stats.waveScores;
  const peak = Math.max(1, ...scores);
  scores.forEach((score, i) => {
    const h = 170 * (score / peak);
    ctx.fillStyle = i === TOTAL_WAVES - 1 ? PALETTE.danger : '#d8952a';
    ctx.fillRect(62 + i * 26, top + 222 - h, 20, h);
    text(ctx, String(i + 1), 72 + i * 26, top + 238, 12, PALETTE.dim, 'center', 800);
  });
  const right = ARENA_W - 340;
  drawPanel(ctx, right, top, 300, 262, 18);
  text(ctx, `FEATS ${profile.feats.length}/${FEATS.length}`, right + 22, top + 26, 15, PALETTE.gold, 'left', 900);
  (profile.runFeats.length ? profile.runFeats : ['none this run']).slice(0, 6).forEach((name, i) => text(ctx, `${profile.runFeats.length ? '★ ' : ''}${name}`, right + 22, top + 62 + i * 31, 18, PALETTE.ink, 'left', 800));

  const owned = UPGRADES.filter((upgrade) => world.upgrades[upgrade.id] > 0).length;
  drawBuildIcons(ctx, world.upgrades, cx - (owned * 46) / 2, 528);
  const names = buildSynergies(world.upgrades).map((synergy) => synergy.name).join(' + ');
  if (names) text(ctx, names, cx, 588, 17, '#ffcf7a', 'center', 900);
  const pulse = 0.6 + 0.4 * Math.sin(time * 3.5);
  drawPanel(ctx, cx - 250, 628, 500, 60, 30, `rgba(243,201,106,${0.85 + 0.15 * pulse})`, PALETTE.ink);
  text(ctx, 'Press R or click to play again', cx, 659, 26, PALETTE.ink, 'center', 900);
  text(ctx, 'Esc: title', cx, 712, 16, PALETTE.cream, 'center', 700);
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
  ctx.scale(0.5, 0.5);
  drawEclipse(ctx, boss, time, { fallen: true });
  ctx.restore();
}

// ----- Pause -------------------------------------------------------------------------------------------------

export function drawPause(ctx, muted, world) {
  dim(ctx, 0.66);
  text(ctx, 'PAUSED', ARENA_W / 2, 250, 72, '#ffffff', 'center', 900);
  text(ctx, 'P or Esc to resume  ·  R to restart  ·  Q to quit to title', ARENA_W / 2, 330, 22, PALETTE.cream, 'center', 700);
  text(ctx, `M toggles sound (now ${muted ? 'off' : 'on'})`, ARENA_W / 2, 372, 18, '#d9c2a0', 'center', 700);
  if (world) drawBuild(ctx, world.upgrades, ARENA_W / 2, 450, 'BUILD');
  drawKeyCaps(ctx, muted);
}

/** THE ECLIPSE's entrance (wave 10, the fight paused): the view closes in as its moon face rises to fill the screen, is named, eases back. */
export function drawBossEntrance(ctx, t) {
  const k = t / ENTRANCE_TIME;
  const open = Math.max(0, Math.min(1, k / 0.3, (1 - k) / 0.25));
  const ease = open * open * (3 - 2 * open);
  ctx.save();
  ctx.fillStyle = `rgba(30,12,8,${(0.62 * ease).toFixed(2)})`;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const boss = createEclipse();
  Object.assign(boss, { x: 0, y: 0, entering: 0, rot: t * 0.6, colour: BOSS_PHASES[0].colour });
  ctx.globalAlpha = ease;
  ctx.translate(ARENA_W / 2, 350 + (1 - Math.min(1, k / 0.45)) * 360);
  ctx.scale(0.4 + 2.1 * ease, 0.4 + 2.1 * ease);
  drawEclipse(ctx, boss, t);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = ease * Math.max(0, Math.min(1, (k - 0.3) / 0.15));
  ctx.font = `900 72px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = PALETTE.ink;
  ctx.strokeText('THE ECLIPSE', ARENA_W / 2, 690);
  ctx.fillStyle = PALETTE.cream;
  ctx.fillText('THE ECLIPSE', ARENA_W / 2, 690);
  drawPanel(ctx, ARENA_W / 2 - 150, 716, 300, 40, 20, PALETTE.inkPanel, LIGHTS[BOSS_PHASES[0].colour].hex);
  text(ctx, `PHASE I · ${BOSS_PHASES[0].name}`, ARENA_W / 2, 737, 20, '#ffcf7a', 'center', 900);
  ctx.restore();
}
