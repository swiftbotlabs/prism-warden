// The in-play HUD that teaches at a glance: Core and stakes, WIN/LOSE, wave goal, score, INCOMING, colour rule, build, event log.
import { ARENA_H, ARENA_W, COMBO_TUNING, FONT, LIGHTS, PALETTE, TOTAL_WAVES } from './config.js';
import { drawLightGlyph, drawUpgradeIcon, traceShape } from './icons.js';
import { drawCreature } from './sprites.js';
import { upgradeLabel, UPGRADES } from './upgrades.js';
import { incomingByKind, waveGoalText, waveProgress } from './waves.js';
import { LOSE_RULE, SHADE_KINDS, WAVE_TABLE, WIN_RULE } from './rules.js';
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

/** Everything drawn over the arena during a wave; the panels hug the edges so the middle stays clear. */
export function drawHud(ctx, world, best, time, muted) {
  drawCorePanel(ctx, world, time);
  drawEventLog(ctx, world);
  drawWavePanel(ctx, world);
  drawScorePanel(ctx, world, best);
  drawIncomingPanel(ctx, world);
  drawRuleStrip(ctx);
  drawColourSelector(ctx, world.warden.colour, time);
  drawBuildTray(ctx, world.upgrades);
  drawHint(ctx, world);
  drawKeyCaps(ctx, muted);
  if (world.banner) drawWaveBanner(ctx, world.banner);
}

/** CORE n / max, its bar, shields, and the stakes: at 0 the run is lost. */
function drawCorePanel(ctx, world, time) {
  const core = world.core;
  const ratio = core.hp / core.maxHp;
  drawPanel(ctx, 16, 14, 320, 90);
  ctx.beginPath();
  traceShape(ctx, 'diamond', 40, 40, 12);
  ctx.fillStyle = ratio < 0.34 && Math.sin(time * 8) > 0 ? PALETTE.danger : '#7fbfff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  text(ctx, 'CORE', 62, 33, 18, PALETTE.ink);
  text(ctx, `${Math.ceil(core.hp)} / ${core.maxHp}`, 320, 33, 22, PALETTE.ink, 'right');
  const colour = ratio > 0.6 ? '#3a9ad8' : ratio > 0.33 ? '#d8952a' : PALETTE.danger;
  bar(ctx, 30, 50, 290, 16, ratio, colour);
  if (core.shield > 0) {
    text(ctx, 'SHIELD', 30, 86, 14, '#2a7fc0', 'left', 800);
    for (let i = 0; i < core.shield; i += 1) {
      ctx.beginPath();
      ctx.arc(94 + i * 15, 86, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#2a7fc0';
      ctx.fill();
    }
  }
  text(ctx, '0 = RUN LOST', 320, 86, 16, PALETTE.danger, 'right', 900);
}

/** WAVE n / 10, its name and progress, and the goal: how many waves to hold before THE ECLIPSE. */
function drawWavePanel(ctx, world) {
  const cx = ARENA_W / 2;
  drawPanel(ctx, cx - 180, 14, 360, 90);
  const plan = WAVE_TABLE[world.wave - 1];
  text(ctx, `WAVE ${world.wave} / ${TOTAL_WAVES}`, cx, 34, 26, PALETTE.ink, 'center');
  text(ctx, plan.title.toUpperCase(), cx, 56, 14, PALETTE.dim, 'center', 700);
  bar(ctx, cx - 155, 65, 310, 6, waveProgress(world), PALETTE.gold);
  text(ctx, waveGoalText(world.wave), cx, 87, 16, PALETTE.gold, 'center', 900);
  drawWinLoseLine(ctx, cx, 126, 17, true);
  const boss = world.boss;
  if (boss && !boss.dead) {
    drawPanel(ctx, cx - 250, 150, 500, 46, 10, PALETTE.panel, LIGHTS[boss.colour].hex);
    text(ctx, eclipseTitle(boss), cx, 164, 14, PALETTE.ink, 'center');
    for (let i = 0; i < 3; i += 1) {
      const x = cx - 234 + i * 158;
      const ratio = i < boss.phase ? 0 : i > boss.phase ? 1 : boss.hp / boss.maxHp;
      bar(ctx, x, 178, 152, 10, ratio, i === boss.phase ? LIGHTS[boss.colour].hex : 'rgba(42,26,18,0.45)');
    }
  }
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

function drawScorePanel(ctx, world, best) {
  const right = ARENA_W - 16;
  drawPanel(ctx, right - 300, 14, 300, 70);
  text(ctx, 'SCORE', right - 284, 32, 14, PALETTE.dim);
  text(ctx, world.score.toLocaleString('en-US'), right - 284, 59, 30, PALETTE.ink);
  text(ctx, `BEST ${Math.max(best, world.score).toLocaleString('en-US')}`, right - 16, 32, 14, PALETTE.dim, 'right', 700);
  if (world.combo > 0) {
    const multiplier = comboMultiplier(world);
    text(ctx, `x${multiplier}`, right - 16, 60, 30, PALETTE.gold, 'right', 900);
    text(ctx, `${world.combo} COMBO`, right - 74 - (multiplier > 9 ? 18 : 0), 61, 15, PALETTE.dim, 'right', 800);
    bar(ctx, right - 300, 88, 300, 5, world.comboTimer / COMBO_TUNING.window, PALETTE.gold, 'rgba(0,0,0,0)');
  }
}

/** INCOMING: each Shade kind this wave still has to send, with its picture, the colours it comes in and how many. */
function drawIncomingPanel(ctx, world) {
  if (!world.director || world.state !== 'fight') return;
  const rows = incomingByKind(world).slice(0, 6);
  const width = 236;
  const x = ARENA_W - 16 - width;
  const y = 102;
  const height = 40 + Math.max(1, rows.length) * 28;
  drawPanel(ctx, x, y, width, height, 12);
  text(ctx, 'INCOMING', x + 14, y + 18, 15, PALETTE.gold, 'left', 900);
  const onField = world.shades.filter((shade) => !shade.dead).length;
  text(ctx, `${onField} ON FIELD`, x + width - 14, y + 18, 14, PALETTE.dim, 'right', 700);
  if (rows.length === 0) {
    text(ctx, 'all Shades are in · finish them', x + 14, y + 46, 15, PALETTE.dim, 'left', 600);
    return;
  }
  rows.forEach((row, index) => {
    const ry = y + 46 + index * 28;
    const colours = row.kind === 'bulwark' ? [0, 1, 2] : [...row.colours].sort();
    drawCreature(ctx, row.kind, colours[0] === 3 && colours.length > 1 ? colours[1] : colours[0], x + 24, ry, row.kind === 'eclipse' ? 30 : 34);
    const label = row.kind === 'eclipse' ? 'THE ECLIPSE' : SHADE_KINDS[row.kind].label;
    text(ctx, `${label} x${row.count}`, x + 46, ry, 17, PALETTE.ink, 'left', 800);
    if (row.kind !== 'eclipse') colours.forEach((colour, i) => drawLightGlyph(ctx, colour, x + width - 18 - i * 14, ry, 5));
  });
}

/** The last few scoring and danger events, newest at the bottom, fading out. */
function drawEventLog(ctx, world) {
  const recent = world.log.filter((entry) => world.time - entry.time < 5).slice(-3);
  recent.forEach((entry, index) => {
    const age = world.time - entry.time;
    const alpha = Math.max(0, Math.min(1, (5 - age) / 2));
    const y = 128 + index * 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    const width = textWidth(ctx, entry.text, 16) + 24;
    drawPanel(ctx, 16, y - 13, width, 26, 13, PALETTE.inkPanel, PALETTE.panelEdge);
    text(ctx, entry.text, 28, y + 1, 16, entry.colour, 'left', 800);
    ctx.restore();
  });
}

/** The one rule, by the colour bar: each beam colour harms the Shade shell of that colour and shape; white takes any. */
function drawRuleStrip(ctx) {
  const lead = 'MATCH COLOUR';
  const pairWidth = 52;
  const tail = 'ANY';
  const width = textWidth(ctx, lead, 15, 900) + pairWidth * 3 + textWidth(ctx, tail, 14, 800) + 70;
  const x = ARENA_W / 2 - width / 2;
  const y = ARENA_H - 92;
  drawPanel(ctx, x, y - 15, width, 30, 15);
  text(ctx, lead, x + 14, y + 1, 15, PALETTE.ink, 'left', 900);
  let px = x + 24 + textWidth(ctx, lead, 15, 900);
  for (let colour = 0; colour < 3; colour += 1) {
    const light = LIGHTS[colour];
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + 20, y);
    ctx.strokeStyle = light.hex;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    traceShape(ctx, light.shape, px + 34, y, 7);
    ctx.fillStyle = PALETTE.ink;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = light.hex;
    ctx.stroke();
    px += pairWidth;
  }
  ctx.beginPath();
  traceShape(ctx, 'diamond', px + 6, y, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  text(ctx, tail, px + 18, y + 1, 14, PALETTE.ink, 'left', 800);
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

/** The owned upgrades as named chips ("Prism II"), three to a row, stacking upward from the bottom-left corner. */
function drawBuildTray(ctx, levels) {
  const owned = UPGRADES.filter((upgrade) => levels[upgrade.id] > 0);
  if (owned.length === 0) return;
  const chipW = 118;
  const chipH = 30;
  const rows = Math.ceil(owned.length / 3);
  const bottom = ARENA_H - 16 - chipH;
  const labelY = bottom - (rows - 1) * (chipH + 4) - 14;
  drawPanel(ctx, 16, labelY - 11, 62, 22, 8);
  text(ctx, 'BUILD', 25, labelY + 1, 14, PALETTE.ink, 'left', 900);
  owned.forEach((upgrade, index) => {
    const x = 16 + (index % 3) * (chipW + 4);
    const y = bottom - Math.floor(index / 3) * (chipH + 4);
    drawPanel(ctx, x, y, chipW, chipH, 8);
    drawPanel(ctx, x + 3, y + 3, 26, chipH - 6, 6, PALETTE.inkPanel, PALETTE.inkPanel);
    drawUpgradeIcon(ctx, upgrade.id, x + 16, y + chipH / 2, 22);
    text(ctx, upgradeLabel(upgrade.id, levels[upgrade.id]), x + 32, y + chipH / 2 + 1, 15, PALETTE.ink, 'left', 800);
  });
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
