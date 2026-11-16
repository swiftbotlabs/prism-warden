// Draws the arena scene: hex-grid ground, mirror shards, the Core crystal, Shades and the boss, motes, additive beams, the Warden and the reticle.
import { ARENA_H, ARENA_W, CORE_RADIUS, CORE_X, CORE_Y, FONT, LIGHTS, PALETTE, TAU, WHITE } from './config.js';
import { drawLightGlyph, traceShape } from './icons.js';
import { drawFloaters, drawParticles } from './particles.js';
import { PRISMLING_PERIOD } from './shades.js';

const glowSprites = new Map();
let backdrop = null;

/** A soft round light sprite in colour `rgb`, cached per colour. */
function glowSprite(rgb) {
  let sprite = glowSprites.get(rgb);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 128;
  const g = sprite.getContext('2d');
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(0.25, `rgba(${rgb},0.45)`);
  gradient.addColorStop(0.6, `rgba(${rgb},0.12)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  glowSprites.set(rgb, sprite);
  return sprite;
}

/** Adds a glow of `radius` at (x, y); call with the 'lighter' composite for real light. */
export function drawGlow(ctx, x, y, radius, rgb, alpha = 1) {
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * alpha;
  ctx.drawImage(glowSprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = previous;
}

/** Pre-renders the ground (indigo gradient, faint hex grid, vignette) at the screen's pixel ratio. */
export function buildBackdrop(pixelRatio) {
  backdrop = document.createElement('canvas');
  backdrop.width = Math.round(ARENA_W * pixelRatio);
  backdrop.height = Math.round(ARENA_H * pixelRatio);
  const g = backdrop.getContext('2d');
  g.scale(pixelRatio, pixelRatio);
  g.fillStyle = PALETTE.ground;
  g.fillRect(0, 0, ARENA_W, ARENA_H);
  const halo = g.createRadialGradient(CORE_X, CORE_Y, 20, CORE_X, CORE_Y, 620);
  halo.addColorStop(0, 'rgba(60,52,150,0.55)');
  halo.addColorStop(0.5, 'rgba(30,24,90,0.25)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, ARENA_W, ARENA_H);

  const size = 30;
  const w = size * Math.sqrt(3);
  g.beginPath();
  for (let row = -1; row * size * 1.5 < ARENA_H + size; row += 1) {
    for (let col = -1; col * w < ARENA_W + w; col += 1) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * size * 1.5;
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 6 + (i / 6) * TAU;
        const px = cx + Math.cos(angle) * size;
        const py = cy + Math.sin(angle) * size;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
    }
  }
  g.strokeStyle = PALETTE.grid;
  g.lineWidth = 1;
  g.stroke();

  for (let i = 0; i < 140; i += 1) {
    const x = (i * 397.13) % ARENA_W;
    const y = (i * 211.7 + (i % 7) * 53) % ARENA_H;
    g.fillStyle = `rgba(200,190,255,${0.08 + (i % 5) * 0.04})`;
    g.fillRect(x, y, 1.5, 1.5);
  }
  const vignette = g.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 300, ARENA_W / 2, ARENA_H / 2, 820);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,6,0.6)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, ARENA_W, ARENA_H);
}

export function drawBackdrop(ctx) {
  if (backdrop) ctx.drawImage(backdrop, 0, 0, ARENA_W, ARENA_H);
}

/** The whole play scene for one frame. `time` animates idle motion; `showReticle` draws the aim cursor. */
export function drawWorld(ctx, world, time, showReticle = true) {
  ctx.save();
  if (world.shake > 0) {
    const s = world.shake * 0.6;
    ctx.translate(Math.sin(time * 91) * s, Math.cos(time * 77) * s);
  }
  drawBackdrop(ctx);
  for (const mirror of world.mirrors) drawMirror(ctx, mirror, time);
  if (world.state === 'won') drawVictoryRays(ctx, time, Math.min(1, world.stateTime / 1.5));
  drawCore(ctx, world.core, time, world.state === 'lost' ? world.stateTime : 0);
  drawMotes(ctx, world.motes);
  for (const shade of world.shades) {
    if (shade.dead) continue;
    if (shade.kind === 'eclipse') drawEclipse(ctx, shade, time);
    else drawShade(ctx, shade, time);
  }
  drawBeams(ctx, world.beams, time);
  if (world.state !== 'lost') drawWarden(ctx, world.warden, time);
  drawParticles(ctx);
  drawFloaters(ctx, FONT);
  ctx.restore();
  if (showReticle && (world.state === 'fight' || world.state === 'cleared')) drawReticle(ctx, world.warden, time);
  if (world.core.flash > 0) {
    const edge = ctx.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 320, ARENA_W / 2, ARENA_H / 2, 780);
    edge.addColorStop(0, 'rgba(255,40,70,0)');
    edge.addColorStop(1, `rgba(255,40,70,${(world.core.flash * 0.7).toFixed(2)})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

/** After THE ECLIPSE falls, the Core blazes: slow rotating rays in the three colours. */
function drawVictoryRays(ctx, time, strength) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i += 1) {
    const angle = time * 0.15 + (i / 18) * TAU;
    const rgb = LIGHTS[i % 3].rgb;
    const ray = ctx.createLinearGradient(CORE_X, CORE_Y, CORE_X + Math.cos(angle) * 900, CORE_Y + Math.sin(angle) * 900);
    ray.addColorStop(0, `rgba(${rgb},${(0.5 * strength).toFixed(2)})`);
    ray.addColorStop(1, `rgba(${rgb},0)`);
    ctx.beginPath();
    ctx.moveTo(CORE_X, CORE_Y);
    ctx.arc(CORE_X, CORE_Y, 900, angle - 0.05, angle + 0.05);
    ctx.closePath();
    ctx.fillStyle = ray;
    ctx.fill();
  }
  drawGlow(ctx, CORE_X, CORE_Y, 260, '255,240,200', 0.6 * strength);
  ctx.restore();
}

function drawMirror(ctx, mirror, time) {
  const grow = mirror.born;
  const ux = Math.cos(mirror.angle) * mirror.length * 0.5 * grow;
  const uy = Math.sin(mirror.angle) * mirror.length * 0.5 * grow;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.moveTo(mirror.cx - ux, mirror.cy - uy);
  ctx.lineTo(mirror.cx + ux, mirror.cy + uy);
  ctx.strokeStyle = `rgba(${PALETTE.mirror},${0.12 + mirror.glow * 0.25})`;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(30,40,80,0.95)';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = `rgba(${PALETTE.mirror},0.95)`;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  const glint = ((time * 0.35 + mirror.cx * 0.001) % 1) * 2 - 1;
  drawGlow(ctx, mirror.cx + ux * glint, mirror.cy + uy * glint, 14, '255,255,255', 0.7);
  if (mirror.glow > 0) drawGlow(ctx, mirror.cx, mirror.cy, 40, PALETTE.mirror, mirror.glow * 0.4);
  ctx.restore();
}

/** The Core: a faceted crystal whose glow, cracks, shield ring and tint show its health. */
function drawCore(ctx, core, time, shatter) {
  const ratio = core.hp / core.maxHp;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.85 + 0.15 * Math.sin(time * 2.2);
  drawGlow(ctx, CORE_X, CORE_Y, 150 * pulse, PALETTE.core, 0.35 + 0.35 * ratio);
  if (ratio < 0.34 && shatter === 0) drawGlow(ctx, CORE_X, CORE_Y, 120, '255,60,90', 0.35 + 0.3 * Math.sin(time * 8));
  if (core.healFlash > 0) drawGlow(ctx, CORE_X, CORE_Y, 110, '120,255,190', core.healFlash * 1.5);
  ctx.restore();
  if (shatter > 0) return;

  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (i / 6) * TAU;
    points.push(CORE_X + Math.cos(angle) * CORE_RADIUS * 0.92, CORE_Y + Math.sin(angle) * CORE_RADIUS * 1.18);
  }
  for (let i = 0; i < 6; i += 1) {
    const j = (i + 1) % 6;
    const shine = 0.55 + 0.45 * Math.sin(time * 1.4 + i * 1.1);
    ctx.beginPath();
    ctx.moveTo(CORE_X, CORE_Y);
    ctx.lineTo(points[i * 2], points[i * 2 + 1]);
    ctx.lineTo(points[j * 2], points[j * 2 + 1]);
    ctx.closePath();
    const light = Math.round(150 + 90 * shine * (0.4 + 0.6 * ratio));
    ctx.fillStyle = `rgb(${light - 40},${light},255)`;
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) ctx[i === 0 ? 'moveTo' : 'lineTo'](points[i * 2], points[i * 2 + 1]);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const cracks = Math.round((1 - ratio) * 9);
  ctx.strokeStyle = 'rgba(20,10,40,0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < cracks; i += 1) {
    const angle = i * 2.39996;
    ctx.beginPath();
    ctx.moveTo(CORE_X + Math.cos(angle) * 4, CORE_Y + Math.sin(angle) * 4);
    ctx.lineTo(CORE_X + Math.cos(angle + 0.3) * 16, CORE_Y + Math.sin(angle + 0.3) * 18);
    ctx.lineTo(CORE_X + Math.cos(angle - 0.1) * 30, CORE_Y + Math.sin(angle - 0.1) * 34);
    ctx.stroke();
  }
  if (core.flash > 0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) ctx[i === 0 ? 'moveTo' : 'lineTo'](points[i * 2], points[i * 2 + 1]);
    ctx.fillStyle = `rgba(255,60,90,${Math.min(0.8, core.flash * 2)})`;
    ctx.fill();
  }
  if (core.shield > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(CORE_X, CORE_Y, 56, 0, TAU);
    ctx.strokeStyle = `rgba(120,220,255,${0.35 + 0.15 * Math.sin(time * 3)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 20;
    ctx.stroke();
    ctx.restore();
  }
}

function drawMotes(ctx, motes) {
  if (motes.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const mote of motes) {
    drawGlow(ctx, mote.x, mote.y, 16, '120,255,190', 0.9);
    ctx.fillStyle = '#eafff4';
    ctx.fillRect(mote.x - 2, mote.y - 2, 4, 4);
  }
  ctx.restore();
}

/** One Shade: glow in its colour, a dark body inside a shell of its colour's shape, a slit eye watching the Core. */
function drawShade(ctx, shade, time) {
  const light = LIGHTS[shade.colour];
  const fade = Math.min(1, shade.age * 2.5);
  const { x, y, r } = shade;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, r * 3, shade.kind === 'bulwark' ? '200,190,255' : light.rgb, shade.colour === WHITE ? 0.6 : 0.5);
  ctx.globalCompositeOperation = 'source-over';

  const towardCore = Math.atan2(CORE_Y - y, CORE_X - x);
  if (shade.kind === 'darter') {
    ctx.strokeStyle = `rgba(${light.rgb},0.45)`;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(towardCore) * r + Math.sin(towardCore) * side * 5, y - Math.sin(towardCore) * r - Math.cos(towardCore) * side * 5);
      ctx.lineTo(x - Math.cos(towardCore) * r * 3.2, y - Math.sin(towardCore) * r * 3.2);
      ctx.stroke();
    }
  }

  if (shade.shell) {
    drawBulwark(ctx, shade, time);
  } else {
    const spin = shade.kind === 'drifter' || shade.kind === 'splitter' ? shade.age * 0.6 : 0;
    ctx.beginPath();
    traceShape(ctx, light.shape, x, y, r, spin);
    ctx.fillStyle = PALETTE.shadeBody;
    ctx.fill();
    ctx.lineWidth = shade.kind === 'shard' ? 2.5 : 3.5;
    ctx.strokeStyle = light.hex;
    ctx.stroke();
    if (shade.kind === 'splitter') {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.6);
      ctx.lineTo(x + r * 0.1, y);
      ctx.lineTo(x - r * 0.2, y + r * 0.6);
      ctx.strokeStyle = `rgba(${light.rgb},0.7)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (shade.kind === 'prismling') {
      const until = 1 - (shade.age % PRISMLING_PERIOD) / PRISMLING_PERIOD;
      const next = LIGHTS[(shade.colour + 1) % 3];
      ctx.beginPath();
      ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + until * TAU);
      ctx.strokeStyle = next.hex;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const angle = time * 3 + (i / 3) * TAU;
        drawLightGlyph(ctx, i, x + Math.cos(angle) * (r + 11), y + Math.sin(angle) * (r + 11), 3.2);
      }
    }
  }

  if (!shade.shell) {
    const ex = x + Math.cos(towardCore) * r * 0.25;
    const ey = y + Math.sin(towardCore) * r * 0.25;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(towardCore + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.38, r * 0.14, 0, 0, TAU);
    ctx.fillStyle = shade.colour === WHITE ? '#ffffff' : light.hex;
    ctx.fill();
    ctx.restore();
  }

  if (shade.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x, y, r * 1.6, '255,255,255', shade.flash * 8);
  }
  if (shade.hp < shade.maxHp && shade.r >= 14) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(x, y, r + (shade.shell ? 10 : 4), -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, shade.hp / shade.maxHp));
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** A Bulwark: three rotating shell arcs in the three colours around a white heart that any light harms once bared. */
function drawBulwark(ctx, shade, time) {
  const { x, y, r } = shade;
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, TAU);
  ctx.fillStyle = PALETTE.shadeBody;
  ctx.fill();
  const third = TAU / 3;
  shade.shell.forEach((segment, index) => {
    const from = shade.rot + index * third + 0.08;
    const to = shade.rot + (index + 1) * third - 0.08;
    const light = LIGHTS[segment.colour];
    ctx.beginPath();
    ctx.arc(x, y, r, from, to);
    if (segment.hp > 0) {
      ctx.strokeStyle = light.hex;
      ctx.lineWidth = 7;
      ctx.stroke();
      const mid = (from + to) / 2;
      drawLightGlyph(ctx, segment.colour, x + Math.cos(mid) * (r + 9), y + Math.sin(mid) * (r + 9), 5);
    } else {
      ctx.strokeStyle = `rgba(${light.rgb},0.18)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  const beat = 1 + 0.12 * Math.sin(time * 6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, 22 * beat, '255,255,255', 0.6);
  ctx.restore();
  ctx.beginPath();
  traceShape(ctx, 'diamond', x, y, 8 * beat);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/**
 * THE ECLIPSE: a black sun with a corona of rays in its phase colour and orbiting colour glyphs. Used in play, for the
 * "NEXT: THE ECLIPSE" preview after wave 9, and (with `fallen`) dimmed and cracked on the victory screen.
 */
export function drawEclipse(ctx, boss, time, { label = true, fallen = false } = {}) {
  const light = LIGHTS[boss.colour];
  const { x, y, r } = boss;
  const power = fallen ? 0.3 : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, r * 3.2, light.rgb, 0.75 * power);
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = boss.rot + (i / 16) * TAU;
    const length = r * (1.35 + 0.25 * Math.sin(time * 4 + i * 1.7));
    ctx.moveTo(x + Math.cos(angle) * r * 0.95, y + Math.sin(angle) * r * 0.95);
    ctx.lineTo(x + Math.cos(angle + 0.06) * length, y + Math.sin(angle + 0.06) * length);
  }
  ctx.strokeStyle = `rgba(${light.rgb},${0.8 * power})`;
  ctx.lineWidth = 4;
  ctx.stroke();
  if (boss.broken > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r + (1.2 - boss.broken) * 260, 0, TAU);
    ctx.strokeStyle = `rgba(255,255,255,${boss.broken * 0.6})`;
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 4, x, y, r);
  body.addColorStop(0, '#1a1638');
  body.addColorStop(1, '#030210');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = light.hex;
  ctx.stroke();
  for (let i = 0; i < 3; i += 1) {
    const angle = -boss.rot * 1.5 + (i / 3) * TAU;
    drawLightGlyph(ctx, boss.colour, x + Math.cos(angle) * r * 0.62, y + Math.sin(angle) * r * 0.62, 9);
  }
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.34, fallen ? r * 0.025 : r * 0.1, 0, 0, TAU);
  ctx.fillStyle = light.hex;
  ctx.fill();
  if (fallen) drawEclipseCracks(ctx, x, y, r);
  if (boss.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x, y, r * 1.5, '255,255,255', boss.flash * 5);
    ctx.restore();
  }
  if (!label) return;
  ctx.font = `800 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(236,233,255,0.85)';
  ctx.fillText('THE ECLIPSE', x, y + r + 34);
}

/** Broken THE ECLIPSE: a dark veil over the body and jagged cracks with light leaking through them. */
function drawEclipseCracks(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(4,3,12,0.45)';
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 7; i += 1) {
    const angle = i * 0.9 + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * r * 0.12, y + Math.sin(angle) * r * 0.12);
    ctx.lineTo(x + Math.cos(angle + 0.25) * r * 0.45, y + Math.sin(angle + 0.25) * r * 0.45);
    ctx.lineTo(x + Math.cos(angle - 0.1) * r * 0.75, y + Math.sin(angle - 0.1) * r * 0.75);
    ctx.lineTo(x + Math.cos(angle + 0.12) * r * 1.02, y + Math.sin(angle + 0.12) * r * 1.02);
    ctx.strokeStyle = 'rgba(255,212,110,0.35)';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,215,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** Beams as layered additive strokes: a wide halo, the coloured body and a white-hot centre, flares at bounces, a shaped tip. */
function drawBeams(ctx, beams, time) {
  if (beams.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const flicker = 1 + 0.08 * Math.sin(time * 47);
  for (const beam of beams) {
    const light = LIGHTS[beam.colour];
    const width = beam.halfWidth * flicker * (beam.power < 1 ? 0.7 : 1.15);
    ctx.beginPath();
    ctx.moveTo(beam.points[0], beam.points[1]);
    for (let i = 2; i < beam.points.length; i += 2) ctx.lineTo(beam.points[i], beam.points[i + 1]);
    const layers = [[width * 5.5, 0.1], [width * 2.6, 0.28], [width * 1.2, 0.75]];
    for (const [lineWidth, alpha] of layers) {
      ctx.strokeStyle = `rgba(${light.rgb},${(alpha * (0.5 + beam.power * 0.5)).toFixed(2)})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,255,255,${(0.85 * beam.power).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, width * 0.45);
    ctx.stroke();
    for (let i = 0; i < beam.bounces.length; i += 2) {
      drawGlow(ctx, beam.bounces[i], beam.bounces[i + 1], 26, light.rgb, 0.9);
      drawGlow(ctx, beam.bounces[i], beam.bounces[i + 1], 10, '255,255,255', 0.9);
    }
    drawGlow(ctx, beam.endX, beam.endY, beam.blocked ? 34 : 18, light.rgb, 1);
  }
  const main = beams[0];
  drawGlow(ctx, main.points[0], main.points[1], 34, LIGHTS[main.colour].rgb, 1);
  drawGlow(ctx, main.points[0], main.points[1], 12, '255,255,255', 0.9);
  ctx.globalCompositeOperation = 'source-over';
  for (const beam of beams) drawLightGlyph(ctx, beam.colour, beam.endX, beam.endY, 6, 0.95);
  ctx.restore();
}

/** The Warden: a glowing glass lens ringed in the current colour, a notch toward the aim, the colour's shape at its heart. */
function drawWarden(ctx, warden, time) {
  const light = LIGHTS[warden.colour];
  const { x, y, r } = warden;
  const aim = Math.atan2(warden.aimY - y, warden.aimX - x);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, 46 + Math.sin(time * 5) * 3, light.rgb, 0.7);
  if (warden.swapFlash > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r + (0.25 - warden.swapFlash) * 120, 0, TAU);
    ctx.strokeStyle = `rgba(${light.rgb},${warden.swapFlash * 3})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
  const glass = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, r);
  glass.addColorStop(0, '#ffffff');
  glass.addColorStop(0.5, `rgba(${light.rgb},0.6)`);
  glass.addColorStop(1, 'rgba(20,16,50,0.95)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = light.hex;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(aim) * (r + 9), y + Math.sin(aim) * (r + 9));
  ctx.lineTo(x + Math.cos(aim + 0.42) * (r + 1), y + Math.sin(aim + 0.42) * (r + 1));
  ctx.lineTo(x + Math.cos(aim - 0.42) * (r + 1), y + Math.sin(aim - 0.42) * (r + 1));
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  drawLightGlyph(ctx, warden.colour, x, y, 4.5);
}

function drawReticle(ctx, warden, time) {
  const light = LIGHTS[warden.colour];
  const x = warden.aimX;
  const y = warden.aimY;
  const spin = time * 1.5;
  ctx.save();
  ctx.strokeStyle = light.hex;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const angle = spin + (i / 4) * TAU;
    ctx.moveTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15);
    ctx.lineTo(x + Math.cos(angle) * 21, y + Math.sin(angle) * 21);
  }
  ctx.stroke();
  drawLightGlyph(ctx, warden.colour, x, y, 3.5);
  ctx.restore();
}
