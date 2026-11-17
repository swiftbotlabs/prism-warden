// The in-play HUD, kept calm: one slim top bar with big numbers, the WIN/LOSE line, an INCOMING strip, two log lines, colours, build icons.
import { ARENA_H, ARENA_W, COMBO_TUNING, FONT, LIGHTS, PALETTE, TOTAL_WAVES } from './config.js';
import { drawLightGlyph, drawUpgradeIcon, traceShape } from './icons.js';
import { drawCreature } from './sprites.js';
import { UPGRADES } from './upgrades.js';
import { incomingByKind, waveProgress } from './waves.js';
import { LOSE_RULE, WAVE_TABLE, WIN_RULE } from './rules.js';
import { comboMultiplier } from './world.js';
import { eclipseTitle } from './boss.js';

/** A rounded translucent panel behind HUD text. */
export function drawPanel(ctx, x, y, w, h, radius = 12, fill = PALETTE.panel, edge = PALETTE.panelEdge) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = edge;
  ctx.stroke();
}

function text(ctx, value, x, y, size, colour, align = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
}

function textWidth(ctx, value, size, weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  return ctx.measureText(value).width;
}

function bar(ctx, x, y, w, h, ratio, colour, back = 'rgba(42,26,18,0.16)') {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = back;
  ctx.fill();
  if (ratio <= 0) return;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(h, w * Math.min(1, ratio)), h, h / 2);
  ctx.fillStyle = colour;
  ctx.fill();
}

/** Everything drawn over the arena during a wave: big numbers, few labels, the middle left clear. */
export function drawHud(ctx, world, best, time, muted) {
  drawTopBar(ctx, world, best, time);
  drawWinLoseLine(ctx, ARENA_W / 2, 86, 14, true);
  drawBossBar(ctx, world);
  drawIncomingStrip(ctx, world);
  drawEventLog(ctx, world);
  drawColourSelector(ctx, world.warden.colour, time);
  drawBuildIcons(ctx, world.upgrades, 16, ARENA_H - 56);
  drawHint(ctx, world);
  if (world.wave === 1) drawKeyCaps(ctx, muted);
  if (world.banner && !world.cinematic) drawWaveBanner(ctx, world.banner);
}

/** One slim bar across the top: Core health (0 = run lost), wave and its progress, score and multiplier. */
function drawTopBar(ctx, world, best, time) {
  const core = world.core;
  const ratio = core.hp / core.maxHp;
  drawPanel(ctx, 16, 10, ARENA_W - 32, 56, 14);
  ctx.beginPath();
  traceShape(ctx, 'diamond', 40, 38, 12);
  ctx.fillStyle = ratio < 0.34 && Math.sin(time * 8) > 0 ? PALETTE.danger : '#7fbfff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  text(ctx, `${Math.ceil(core.hp)}/${core.maxHp}${core.shield ? ' +' + core.shield : ''}`, 60, 30, 26, PALETTE.ink, 'left', 900);
  bar(ctx, 60, 47, 150, 9, ratio, ratio > 0.6 ? '#3a9ad8' : ratio > 0.33 ? '#d8952a' : PALETTE.danger);
  text(ctx, '0 = RUN LOST', 220, 51, 13, PALETTE.danger, 'left', 900);
  const cx = ARENA_W / 2;
  text(ctx, `WAVE ${world.wave}/${TOTAL_WAVES}`, cx, 30, 26, PALETTE.ink, 'center', 900);
  bar(ctx, cx - 110, 50, 220, 6, waveProgress(world), PALETTE.gold);
  const right = ARENA_W - 32;
  if (world.combo > 0) {
    text(ctx, `x${comboMultiplier(world)}`, right, 38, 32, PALETTE.gold, 'right', 900);
    bar(ctx, right - 50, 56, 50, 4, world.comboTimer / COMBO_TUNING.window, PALETTE.gold, 'rgba(0,0,0,0)');
  }
  text(ctx, world.score.toLocaleString('en-US'), right - 64, 32, 28, PALETTE.ink, 'right', 900);
  text(ctx, `BEST ${Math.max(best, world.score).toLocaleString('en-US')}`, right - 64, 53, 12, PALETTE.dim, 'right', 800);
}

/** THE ECLIPSE's name, phase and three phase bars, under the top bar while it fights. */
function drawBossBar(ctx, world) {
  const boss = world.boss;
  if (!boss || boss.dead) return;
  const cx = ARENA_W / 2;
  drawPanel(ctx, cx - 210, 104, 420, 40, 10, PALETTE.panel, LIGHTS[boss.colour].hex);
  text(ctx, eclipseTitle(boss), cx, 116, 13, PALETTE.ink, 'center', 900);
  for (let i = 0; i < 3; i += 1) {
    const ratio = i < boss.phase ? 0 : i > boss.phase ? 1 : boss.hp / boss.maxHp;
    bar(ctx, cx - 196 + i * 132, 128, 126, 9, ratio, i === boss.phase ? LIGHTS[boss.colour].hex : 'rgba(42,26,18,0.45)');
  }
}

/** INCOMING: a strip of creature portraits with how many of each this wave still sends. */
function drawIncomingStrip(ctx, world) {
  if (!world.director || world.state !== 'fight') return;
  const rows = incomingByKind(world).slice(0, 5);
  if (rows.length === 0) return;
  const width = rows.length * 66 + 12;
  const x = ARENA_W - 16 - width;
  drawPanel(ctx, x, 72, width, 42, 12);
  rows.forEach((row, i) => {
    const colours = [...row.colours].filter((c) => c !== 3);
    drawCreature(ctx, row.kind, colours[0] ?? 3, x + 26 + i * 66, 93, row.kind === 'eclipse' ? 30 : 38);
    text(ctx, `x${row.count}`, x + 44 + i * 66, 95, 16, PALETTE.ink, 'left', 900);
  });
}

/** At most two short log lines, newest at the bottom, fading out. */
function drawEventLog(ctx, world) {
  world.log.filter((entry) => world.time - entry.time < 3.5).slice(-2).forEach((entry, index) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, (3.5 - (world.time - entry.time)) / 1.5));
    const width = textWidth(ctx, entry.text, 15) + 22;
    drawPanel(ctx, 16, 74 + index * 30, width, 26, 13, PALETTE.inkPanel, PALETTE.panelEdge);
    text(ctx, entry.text, 27, 88 + index * 30, 15, entry.colour, 'left', 800);
    ctx.restore();
  });
}

/** The owned upgrades as a row of icon cards with their level; names appear on the pause screen. */
export function drawBuildIcons(ctx, levels, x, y) {
  UPGRADES.filter((upgrade) => levels[upgrade.id] > 0).forEach((upgrade, i) => {
    drawPanel(ctx, x + i * 46, y, 42, 42, 9, PALETTE.inkPanel, PALETTE.panelEdge);
    drawUpgradeIcon(ctx, upgrade.id, x + i * 46 + 21, y + 19, 30);
    text(ctx, ['I', 'II', 'III', 'IV'][levels[upgrade.id] - 1], x + i * 46 + 36, y + 35, 11, '#ffcf7a', 'right', 900);
  });
}

/** Width of the WIN / LOSE line at `size` (with an optional lead-in), for layout. */
function winLoseWidth(ctx, size, prefix) {
  return textWidth(ctx, prefix, size, 900) + textWidth(ctx, 'WIN: ', size, 900) + textWidth(ctx, `${WIN_RULE}  ·  `, size, 700)
    + textWidth(ctx, 'LOSE: ', size, 900) + textWidth(ctx, LOSE_RULE, size, 700);
}

/** "WIN: break THE ECLIPSE after wave 10 · LOSE: the Core shatters", centred on (cx, y), optionally on a pill and after a gold lead-in. */
export function drawWinLoseLine(ctx, cx, y, size, onPill = false, prefix = '') {
  const width = winLoseWidth(ctx, size, prefix);
  if (onPill) drawPanel(ctx, cx - width / 2 - 18, y - size * 0.95, width + 36, size * 1.9, size);
  let x = cx - width / 2;
  const part = (value, colour, weight) => {
    text(ctx, value, x, y + 1, size, colour, 'left', weight);
    x += textWidth(ctx, value, size, weight);
  };
  if (prefix) part(prefix, PALETTE.gold, 900);
  part('WIN: ', PALETTE.win, 900);
  part(`${WIN_RULE}  ·  `, PALETTE.ink, 700);
  part('LOSE: ', PALETTE.danger, 900);
  part(LOSE_RULE, PALETTE.ink, 700);
}

/** The three lights as keyed chips; the selected one glows. */
export function drawColourSelector(ctx, selected, time) {
  const width = 152;
  const gap = 10;
  const left = ARENA_W / 2 - (width * 3 + gap * 2) / 2;
  const y = ARENA_H - 62;
  for (let i = 0; i < 3; i += 1) {
    const light = LIGHTS[i];
    const x = left + i * (width + gap);
    const active = i === selected;
    drawPanel(ctx, x, y, width, 46, 10, PALETTE.panel, active ? light.hex : PALETTE.panelEdge);
    if (active) {
      ctx.fillStyle = `rgba(${light.rgb},0.3)`;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = light.hex;
      ctx.stroke();
    }
    drawLightGlyph(ctx, i, x + 24, y + 23, active ? 10 + Math.sin(time * 6) : 9, active ? 1 : 0.55);
    text(ctx, light.key, x + 46, y + 23, 15, active ? PALETTE.ink : PALETTE.faint, 'left', 900);
    text(ctx, light.name.toUpperCase(), x + 62, y + 23, 16, active ? PALETTE.ink : PALETTE.dim, 'left', 800);
  }
}

function drawHint(ctx, world) {
  const plan = WAVE_TABLE[world.wave - 1];
  if (!plan.hint || world.state !== 'fight') return;
  const showFor = world.wave <= 2 ? Infinity : 14;
  if (world.director.elapsed > showFor) return;
  ctx.font = `600 17px ${FONT}`;
  const width = ctx.measureText(plan.hint).width + 40;
  drawPanel(ctx, ARENA_W / 2 - width / 2, ARENA_H - 150, width, 36, 18);
  text(ctx, plan.hint, ARENA_W / 2, ARENA_H - 132, 17, PALETTE.ink, 'center', 700);
}

/** Key caps for every control, bottom right: two rows of keys with what each does, on one cream panel. */
export function drawKeyCaps(ctx, muted) {
  const rows = [[['WASD', 'move'], ['LMB', 'cast'], ['WHEEL', 'colour']], [['P', 'pause'], ['M', muted ? 'muted' : 'mute'], ['R', 'restart']]];
  const itemWidth = ([key, action]) => textWidth(ctx, key, 13, 900) + 14 + 6 + textWidth(ctx, action, 14, 800) + 14;
  const width = Math.max(...rows.map((row) => row.reduce((sum, item) => sum + itemWidth(item), 0))) + 8;
  drawPanel(ctx, ARENA_W - 16 - width, ARENA_H - 74, width, 62, 10);
  rows.forEach((row, r) => {
    let x = ARENA_W - 16 - width + 12;
    const y = ARENA_H - 57 + r * 28;
    for (const item of row) {
      const capW = textWidth(ctx, item[0], 13, 900) + 14;
      drawPanel(ctx, x, y - 11, capW, 22, 5, PALETTE.inkPanel, PALETTE.inkPanel);
      text(ctx, item[0], x + capW / 2, y + 1, 13, PALETTE.cream, 'center', 900);
      text(ctx, item[1], x + capW + 6, y + 1, 14, PALETTE.ink, 'left', 800);
      x += itemWidth(item);
    }
  });
}

/** "WAVE n" and its title, sliding in at the start of a wave. */
export function drawWaveBanner(ctx, banner) {
  const t = banner.time;
  const alpha = Math.min(1, t * 3, (2.6 - t) * 2);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const y = 250 - Math.max(0, 0.3 - t) * 80;
  const glow = ctx.createLinearGradient(ARENA_W / 2 - 300, 0, ARENA_W / 2 + 300, 0);
  glow.addColorStop(0, 'rgba(42,26,18,0)');
  glow.addColorStop(0.5, 'rgba(42,26,18,0.85)');
  glow.addColorStop(1, 'rgba(42,26,18,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(ARENA_W / 2 - 300, y - 46, 600, 92);
  text(ctx, banner.title, ARENA_W / 2, y - 10, 46, PALETTE.cream, 'center', 900);
  text(ctx, banner.sub.toUpperCase(), ARENA_W / 2, y + 28, 18, '#ffcf7a', 'center', 700);
  ctx.restore();
}
