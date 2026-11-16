// The in-play HUD, written to teach the game at a glance: Core health and the stakes, wave goal and progress, score and combo,
// what is still INCOMING, the colour rule, the colour selector, the named build, an event log, hints and banners.
import { ARENA_H, ARENA_W, COMBO_TUNING, FONT, LIGHTS, PALETTE, TOTAL_WAVES } from './config.js';
import { drawLightGlyph, drawShadeIcon, drawUpgradeIcon, traceShape } from './icons.js';
import { upgradeLabel, UPGRADES } from './upgrades.js';
import { incomingByKind, RUN_CONDITIONS, waveGoalText, waveProgress, WAVE_PLAN } from './waves.js';
import { comboMultiplier } from './world.js';
import { eclipseTitle } from './boss.js';
import { SHADE_KINDS } from './shades.js';

/** A rounded translucent panel behind HUD text. */
export function drawPanel(ctx, x, y, w, h, radius = 12, fill = PALETTE.panel, edge = PALETTE.panelEdge) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
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

function bar(ctx, x, y, w, h, ratio, colour, back = 'rgba(255,255,255,0.1)') {
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
  text(ctx, `P pause · M ${muted ? 'sound off' : 'mute'} · R restart`, ARENA_W - 20, ARENA_H - 22, 15, PALETTE.dim, 'right', 600);
  if (world.banner) drawWaveBanner(ctx, world.banner);
}

/**
 * The screen areas the HUD covers this frame, as {x, y, w, h}: used to frame screenshots so no Shade hides under a panel.
 * Sizes follow the drawing code below (text-sized panels are given their widest extent).
 */
export function hudPanelRects(world) {
  const rects = [
    { x: 16, y: 14, w: 320, h: 90 },
    { x: ARENA_W / 2 - 180, y: 14, w: 360, h: 90 },
    { x: ARENA_W / 2 - 290, y: 108, w: 580, h: 36 },
    { x: ARENA_W - 316, y: 14, w: 300, h: 80 },
    { x: ARENA_W / 2 - 300, y: ARENA_H - 107, w: 600, h: 30 },
    { x: ARENA_W / 2 - 238, y: ARENA_H - 62, w: 476, h: 46 },
    { x: ARENA_W - 300, y: ARENA_H - 34, w: 284, h: 24 },
  ];
  if (world.log.some((entry) => world.time - entry.time < 5)) rects.push({ x: 16, y: 112, w: 330, h: 90 });
  if (world.director && world.state === 'fight') {
    const rows = Math.max(1, Math.min(6, incomingByKind(world).length));
    rects.push({ x: ARENA_W - 252, y: 102, w: 236, h: 40 + rows * 28 });
  }
  const owned = UPGRADES.filter((upgrade) => world.upgrades[upgrade.id] > 0).length;
  if (owned > 0) {
    const rows = Math.ceil(owned / 3);
    rects.push({ x: 16, y: ARENA_H - 46 - (rows - 1) * 34 - 22, w: 3 * 122, h: (rows - 1) * 34 + 52 });
  }
  if (world.boss && !world.boss.dead) rects.push({ x: ARENA_W / 2 - 250, y: 150, w: 500, h: 46 });
  return rects;
}

/** CORE n / max, its bar, shields, and the stakes: at 0 the run is lost. */
function drawCorePanel(ctx, world, time) {
  const core = world.core;
  const ratio = core.hp / core.maxHp;
  drawPanel(ctx, 16, 14, 320, 90);
  ctx.beginPath();
  traceShape(ctx, 'diamond', 40, 40, 12);
  ctx.fillStyle = ratio < 0.34 && Math.sin(time * 8) > 0 ? PALETTE.danger : '#d2f0ff';
  ctx.fill();
  text(ctx, 'CORE', 62, 33, 18, PALETTE.ink);
  text(ctx, `${Math.ceil(core.hp)} / ${core.maxHp}`, 320, 33, 22, PALETTE.ink, 'right');
  const colour = ratio > 0.6 ? '#7fe7ff' : ratio > 0.33 ? '#ffd46e' : PALETTE.danger;
  bar(ctx, 30, 50, 290, 16, ratio, colour);
  if (core.shield > 0) {
    text(ctx, 'SHIELD', 30, 86, 14, '#78dcff', 'left', 800);
    for (let i = 0; i < core.shield; i += 1) {
      ctx.beginPath();
      ctx.arc(94 + i * 15, 86, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#78dcff';
      ctx.fill();
    }
  }
  text(ctx, '0 = RUN LOST', 320, 86, 16, '#ff8a9a', 'right', 900);
}

/** WAVE n / 10, its name and progress, and the goal: how many waves to hold before THE ECLIPSE. */
function drawWavePanel(ctx, world) {
  const cx = ARENA_W / 2;
  drawPanel(ctx, cx - 180, 14, 360, 90);
  const plan = WAVE_PLAN[world.wave - 1];
  text(ctx, `WAVE ${world.wave} / ${TOTAL_WAVES}`, cx, 34, 26, PALETTE.ink, 'center');
  text(ctx, plan.title.toUpperCase(), cx, 56, 14, PALETTE.dim, 'center', 700);
  bar(ctx, cx - 155, 65, 310, 6, waveProgress(world), PALETTE.gold);
  text(ctx, waveGoalText(world.wave), cx, 87, 16, PALETTE.gold, 'center', 900);
  drawWinLoseLine(ctx, cx, 126, 17, true);
  const boss = world.boss;
  if (boss && !boss.dead) {
    drawPanel(ctx, cx - 250, 150, 500, 46, 10, 'rgba(10,6,24,0.85)', `rgba(${LIGHTS[boss.colour].rgb},0.6)`);
    text(ctx, eclipseTitle(boss), cx, 164, 14, PALETTE.ink, 'center');
    for (let i = 0; i < 3; i += 1) {
      const x = cx - 234 + i * 158;
      const ratio = i < boss.phase ? 0 : i > boss.phase ? 1 : boss.hp / boss.maxHp;
      bar(ctx, x, 178, 152, 10, ratio, i === boss.phase ? LIGHTS[boss.colour].hex : 'rgba(236,233,255,0.5)');
    }
  }
}

/** Width of the WIN / LOSE line at `size` (with an optional lead-in), for layout. */
function winLoseWidth(ctx, size, prefix) {
  return textWidth(ctx, prefix, size, 900) + textWidth(ctx, 'WIN: ', size, 900) + textWidth(ctx, `${RUN_CONDITIONS.win}  ·  `, size, 700)
    + textWidth(ctx, 'LOSE: ', size, 900) + textWidth(ctx, RUN_CONDITIONS.lose, size, 700);
}

/** "WIN: break THE ECLIPSE after wave 10 · LOSE: the Core shatters", centred on (cx, y), optionally on a pill and after a gold lead-in. */
export function drawWinLoseLine(ctx, cx, y, size, onPill = false, prefix = '') {
  const width = winLoseWidth(ctx, size, prefix);
  if (onPill) drawPanel(ctx, cx - width / 2 - 18, y - size * 0.95, width + 36, size * 1.9, size, 'rgba(12,10,32,0.82)', 'rgba(255,212,110,0.5)');
  let x = cx - width / 2;
  const part = (value, colour, weight) => {
    text(ctx, value, x, y + 1, size, colour, 'left', weight);
    x += textWidth(ctx, value, size, weight);
  };
  if (prefix) part(prefix, PALETTE.gold, 900);
  part('WIN: ', '#8dffc4', 900);
  part(`${RUN_CONDITIONS.win}  ·  `, '#ffffff', 700);
  part('LOSE: ', '#ff8a9a', 900);
  part(RUN_CONDITIONS.lose, '#ffffff', 700);
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
    text(ctx, `${world.combo} COMBO`, right - 74 - (multiplier > 9 ? 18 : 0), 61, 15, '#ffe9b0', 'right', 800);
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
    drawShadeIcon(ctx, row.kind, colours[0] === 3 && colours.length > 1 ? colours[1] : colours[0], x + 24, ry, 8);
    const label = row.kind === 'eclipse' ? 'THE ECLIPSE' : SHADE_KINDS[row.kind].label;
    text(ctx, label, x + 44, ry, 16, '#ffffff', 'left', 800);
    if (row.kind !== 'eclipse') colours.forEach((colour, i) => drawLightGlyph(ctx, colour, x + 152 + i * 14, ry, 5));
    text(ctx, `x${row.count}`, x + width - 14, ry, 18, PALETTE.ink, 'right', 900);
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
    drawPanel(ctx, 16, y - 13, width, 26, 13, 'rgba(12,10,32,0.7)', 'rgba(160,150,255,0.18)');
    text(ctx, entry.text, 28, y + 1, 16, entry.colour, 'left', 800);
    ctx.restore();
  });
}

/** The one rule, by the colour bar: each beam colour harms the Shade shell of that colour and shape; white takes any. */
function drawRuleStrip(ctx) {
  const lead = 'MATCH THE BEAM TO THE SHADE';
  const pairWidth = 52;
  const tail = 'WHITE = ANY';
  const width = textWidth(ctx, lead, 15, 900) + pairWidth * 3 + textWidth(ctx, tail, 14, 800) + 70;
  const x = ARENA_W / 2 - width / 2;
  const y = ARENA_H - 92;
  drawPanel(ctx, x, y - 15, width, 30, 15, 'rgba(12,10,32,0.78)', 'rgba(255,212,110,0.4)');
  text(ctx, lead, x + 14, y + 1, 15, '#ffffff', 'left', 900);
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
    ctx.fillStyle = '#07061a';
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
    drawPanel(ctx, x, y, width, 46, 10, active ? `rgba(${light.rgb},0.28)` : 'rgba(12,10,32,0.72)', active ? light.hex : 'rgba(160,150,255,0.25)');
    if (active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = light.hex;
      ctx.stroke();
    }
    drawLightGlyph(ctx, i, x + 24, y + 23, active ? 10 + Math.sin(time * 6) : 9, active ? 1 : 0.55);
    text(ctx, light.key, x + 46, y + 23, 15, active ? '#ffffff' : PALETTE.faint, 'left', 800);
    text(ctx, light.name.toUpperCase(), x + 62, y + 23, 16, active ? '#ffffff' : PALETTE.dim, 'left', 800);
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
  text(ctx, 'BUILD', 18, bottom - (rows - 1) * (chipH + 4) - 12, 13, PALETTE.dim, 'left', 900);
  owned.forEach((upgrade, index) => {
    const x = 16 + (index % 3) * (chipW + 4);
    const y = bottom - Math.floor(index / 3) * (chipH + 4);
    drawPanel(ctx, x, y, chipW, chipH, 8);
    drawUpgradeIcon(ctx, upgrade.id, x + 16, y + chipH / 2, 22);
    text(ctx, upgradeLabel(upgrade.id, levels[upgrade.id]), x + 32, y + chipH / 2 + 1, 15, PALETTE.ink, 'left', 800);
  });
}

function drawHint(ctx, world) {
  const plan = WAVE_PLAN[world.wave - 1];
  if (!plan.hint || world.state !== 'fight') return;
  const showFor = world.wave <= 2 ? Infinity : 14;
  if (world.director.elapsed > showFor) return;
  ctx.font = `600 17px ${FONT}`;
  const width = ctx.measureText(plan.hint).width + 40;
  drawPanel(ctx, ARENA_W / 2 - width / 2, ARENA_H - 150, width, 36, 18, 'rgba(12,10,32,0.82)', 'rgba(255,212,110,0.45)');
  text(ctx, plan.hint, ARENA_W / 2, ARENA_H - 132, 17, '#fff3d0', 'center', 600);
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
  glow.addColorStop(0, 'rgba(10,8,30,0)');
  glow.addColorStop(0.5, 'rgba(10,8,30,0.75)');
  glow.addColorStop(1, 'rgba(10,8,30,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(ARENA_W / 2 - 300, y - 46, 600, 92);
  text(ctx, banner.title, ARENA_W / 2, y - 10, 46, '#ffffff', 'center', 900);
  text(ctx, banner.sub.toUpperCase(), ARENA_W / 2, y + 28, 18, PALETTE.gold, 'center', 700);
  ctx.restore();
}
