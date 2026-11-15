// The in-play HUD: Core health and shields, wave and its progress, score, best and combo, the colour selector, owned upgrades, hints and banners.
import { ARENA_H, ARENA_W, COMBO_TUNING, FONT, LIGHTS, PALETTE, TOTAL_WAVES } from './config.js';
import { drawLightGlyph, drawUpgradeIcon, traceShape } from './icons.js';
import { UPGRADES } from './upgrades.js';
import { waveProgress, WAVE_PLAN } from './waves.js';
import { comboMultiplier } from './world.js';
import { eclipseTitle } from './boss.js';

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

/** Everything drawn over the arena during a wave. */
export function drawHud(ctx, world, best, time, muted) {
  drawCorePanel(ctx, world, time);
  drawWavePanel(ctx, world);
  drawScorePanel(ctx, world, best);
  drawColourSelector(ctx, world.warden.colour, time);
  drawUpgradeTray(ctx, world.upgrades);
  drawHint(ctx, world);
  text(ctx, `P pause · M ${muted ? 'sound off' : 'mute'} · R restart`, ARENA_W - 20, ARENA_H - 22, 15, PALETTE.dim, 'right', 600);
  if (world.banner) drawWaveBanner(ctx, world.banner);
}

function drawCorePanel(ctx, world, time) {
  const core = world.core;
  const ratio = core.hp / core.maxHp;
  drawPanel(ctx, 16, 14, 310, 70);
  ctx.save();
  ctx.beginPath();
  traceShape(ctx, 'diamond', 44, 49, 13);
  ctx.fillStyle = ratio < 0.34 && Math.sin(time * 8) > 0 ? PALETTE.danger : '#d2f0ff';
  ctx.fill();
  ctx.restore();
  text(ctx, 'CORE', 68, 35, 17, PALETTE.dim);
  text(ctx, `${Math.ceil(core.hp)} / ${core.maxHp}`, 312, 35, 20, PALETTE.ink, 'right');
  const colour = ratio > 0.6 ? '#7fe7ff' : ratio > 0.33 ? '#ffd46e' : PALETTE.danger;
  bar(ctx, 68, 54, 244, 16, ratio, colour);
  for (let i = 0; i < core.shield; i += 1) {
    ctx.beginPath();
    ctx.arc(142 + i * 16, 35, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#78dcff';
    ctx.fill();
  }
}

function drawWavePanel(ctx, world) {
  const cx = ARENA_W / 2;
  drawPanel(ctx, cx - 160, 14, 320, 70);
  const plan = WAVE_PLAN[world.wave - 1];
  text(ctx, `WAVE ${world.wave} / ${TOTAL_WAVES}`, cx, 37, 26, PALETTE.ink, 'center');
  text(ctx, plan.title.toUpperCase(), cx, 62, 13, PALETTE.dim, 'center', 700);
  bar(ctx, cx - 140, 72, 280, 6, waveProgress(world), PALETTE.gold);
  const boss = world.boss;
  if (boss && !boss.dead) {
    drawPanel(ctx, cx - 250, 92, 500, 46, 10, 'rgba(10,6,24,0.85)', `rgba(${LIGHTS[boss.colour].rgb},0.6)`);
    text(ctx, eclipseTitle(boss), cx, 106, 14, PALETTE.ink, 'center');
    const segments = 3;
    for (let i = 0; i < segments; i += 1) {
      const x = cx - 234 + i * 158;
      const ratio = i < boss.phase ? 0 : i > boss.phase ? 1 : boss.hp / boss.maxHp;
      bar(ctx, x, 120, 152, 10, ratio, i === boss.phase ? LIGHTS[boss.colour].hex : 'rgba(236,233,255,0.5)');
    }
  }
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

function drawUpgradeTray(ctx, levels) {
  const owned = UPGRADES.filter((upgrade) => levels[upgrade.id] > 0);
  if (owned.length === 0) return;
  const size = 40;
  const y = ARENA_H - 58;
  drawPanel(ctx, 16, y - 6, 12 + owned.length * (size + 4), size + 12, 10);
  owned.forEach((upgrade, index) => {
    const x = 22 + index * (size + 4);
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    drawUpgradeIcon(ctx, upgrade.id, x + size / 2, y + size / 2 - 3, 30);
    for (let i = 0; i < levels[upgrade.id]; i += 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x + 5 + i * 8, y + size - 7, 6, 3);
    }
  });
}

function drawHint(ctx, world) {
  const plan = WAVE_PLAN[world.wave - 1];
  if (!plan.hint || world.state !== 'fight') return;
  const showFor = world.wave <= 2 ? Infinity : 14;
  if (world.director.elapsed > showFor) return;
  ctx.font = `600 17px ${FONT}`;
  const width = ctx.measureText(plan.hint).width + 40;
  drawPanel(ctx, ARENA_W / 2 - width / 2, ARENA_H - 112, width, 36, 18, 'rgba(12,10,32,0.82)', 'rgba(255,212,110,0.45)');
  text(ctx, plan.hint, ARENA_W / 2, ARENA_H - 94, 17, '#fff3d0', 'center', 600);
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
