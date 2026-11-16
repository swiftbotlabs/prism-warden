// Pooled visual effects drawn with additive light: sparks, bursts, chain arcs and floating score text (no allocation per frame).
import { TAU } from './config.js';
import { fxRandom, fxRange } from './random.js';

const MAX_PARTICLES = 1800;
const MAX_FLOATERS = 40;
const MAX_ARCS = 24;
const MAX_RINGS = 24;

const particles = Array.from({ length: MAX_PARTICLES }, () => ({ live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, rgb: '255,255,255', drag: 0.9 }));
const floaters = Array.from({ length: MAX_FLOATERS }, () => ({ live: false, x: 0, y: 0, text: '', life: 0, max: 1, colour: '#fff', size: 18 }));
const arcs = Array.from({ length: MAX_ARCS }, () => ({ live: false, points: [], life: 0, max: 0.3, rgb: '255,255,255' }));
let nextParticle = 0;
let nextFloater = 0;
const rings = Array.from({ length: MAX_RINGS }, () => ({ live: false, x: 0, y: 0, life: 0, max: 0.4, radius: 40, rgb: '255,255,255' }));
let nextArc = 0;
let nextRing = 0;

export function spawnParticle(x, y, vx, vy, life, size, rgb, drag = 0.92) {
  const p = particles[nextParticle];
  nextParticle = (nextParticle + 1) % MAX_PARTICLES;
  p.live = true;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.max = life;
  p.size = size;
  p.rgb = rgb;
  p.drag = drag;
}

/** A round burst of `count` particles. */
export function burst(x, y, rgb, count, speed, life = 0.7, size = 3) {
  for (let i = 0; i < count; i += 1) {
    const angle = fxRandom() * TAU;
    const v = speed * (0.25 + fxRandom() * 0.85);
    spawnParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, life * fxRange(0.5, 1.1), size * fxRange(0.6, 1.3), rgb);
  }
}

/** Sparks thrown in a cone around direction (dx, dy). */
export function sparks(x, y, dx, dy, rgb, count, speed = 260, spread = 0.9) {
  const base = Math.atan2(dy, dx);
  for (let i = 0; i < count; i += 1) {
    const angle = base + fxRange(-spread, spread);
    const v = speed * fxRange(0.4, 1);
    spawnParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, fxRange(0.15, 0.4), fxRange(1.5, 3), rgb, 0.88);
  }
}

/** A short-lived jagged lightning arc between two points. */
export function chainArc(x1, y1, x2, y2, rgb) {
  const arc = arcs[nextArc];
  nextArc = (nextArc + 1) % MAX_ARCS;
  arc.live = true;
  arc.life = arc.max;
  arc.rgb = rgb;
  arc.points.length = 0;
  const steps = 7;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const length = Math.hypot(nx, ny) || 1;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const jitter = i === 0 || i === steps ? 0 : fxRange(-14, 14);
    arc.points.push(x1 + (x2 - x1) * t + (nx / length) * jitter, y1 + (y2 - y1) * t + (ny / length) * jitter);
  }
}

/** A kill flash: a bright ring in the Shade's colour that swells and fades around where it died. */
export function killRing(x, y, rgb, radius = 46) {
  const ring = rings[nextRing];
  nextRing = (nextRing + 1) % MAX_RINGS;
  ring.live = true;
  ring.x = x;
  ring.y = y;
  ring.life = ring.max;
  ring.radius = radius;
  ring.rgb = rgb;
}

/** Rising score or label text; a new one stacks above any it would overlap, so popups never cover each other. */
export function floatText(x, y, text, colour, size = 18, life = 0.9) {
  const halfWidth = text.length * size * 0.3;
  for (let pass = 0; pass < 8; pass += 1) {
    const blocker = floaters.find((f) => f.live && Math.abs(f.x - x) < halfWidth + f.text.length * f.size * 0.3 && Math.abs(f.y - y) < (size + f.size) * 0.55);
    if (!blocker) break;
    y = blocker.y - (size + blocker.size) * 0.6;
  }
  const f = floaters[nextFloater];
  nextFloater = (nextFloater + 1) % MAX_FLOATERS;
  f.live = true;
  f.x = x;
  f.y = y;
  f.text = text;
  f.colour = colour;
  f.size = size;
  f.life = life;
  f.max = life;
}

export function updateEffects(dt) {
  for (const p of particles) {
    if (!p.live) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.live = false;
      continue;
    }
    const drag = p.drag ** (dt * 60);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (const f of floaters) {
    if (!f.live) continue;
    f.life -= dt;
    f.y -= 38 * dt;
    if (f.life <= 0) f.live = false;
  }
  for (const ring of rings) {
    if (!ring.live) continue;
    ring.life -= dt;
    if (ring.life <= 0) ring.live = false;
  }
  for (const arc of arcs) {
    if (!arc.live) continue;
    arc.life -= dt;
    if (arc.life <= 0) arc.live = false;
  }
}

/** The live floating texts' colours, for framing screenshots. */
export function floaterColours() {
  return new Set(floaters.filter((f) => f.live).map((f) => f.colour));
}

/** Floating texts whose centre is within `radius` of (x, y). */
export function floatersNear(x, y, radius) {
  let count = 0;
  for (const f of floaters) if (f.live && Math.hypot(f.x - x, f.y - y) < radius) count += 1;
  return count;
}

export function clearEffects() {
  for (const p of particles) p.live = false;
  for (const f of floaters) f.live = false;
  for (const arc of arcs) arc.live = false;
  for (const ring of rings) ring.live = false;
}

export function liveParticleCount() {
  let count = 0;
  for (const p of particles) if (p.live) count += 1;
  return count;
}

/** Particles and arcs, additive. */
export function drawParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    if (!p.live) continue;
    const k = p.life / p.max;
    const s = p.size * (0.4 + 0.6 * k);
    ctx.fillStyle = `rgba(${p.rgb},${(k * 0.9).toFixed(2)})`;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  for (const ring of rings) {
    if (!ring.live) continue;
    const k = ring.life / ring.max;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * (1.15 - k), 0, TAU);
    ctx.strokeStyle = `rgba(${ring.rgb},${(0.9 * k).toFixed(2)})`;
    ctx.lineWidth = 3 + 7 * k;
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${(0.35 * k * k).toFixed(2)})`;
    ctx.fill();
  }
  ctx.lineJoin = 'round';
  for (const arc of arcs) {
    if (!arc.live) continue;
    const k = arc.life / arc.max;
    ctx.beginPath();
    ctx.moveTo(arc.points[0], arc.points[1]);
    for (let i = 2; i < arc.points.length; i += 2) ctx.lineTo(arc.points[i], arc.points[i + 1]);
    ctx.strokeStyle = `rgba(${arc.rgb},${(0.35 * k).toFixed(2)})`;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(0.9 * k).toFixed(2)})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

/** Floating text, drawn over the scene. */
export function drawFloaters(ctx, font) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floaters) {
    if (!f.live) continue;
    const k = f.life / f.max;
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.font = `800 ${Math.round(f.size * (1 + (1 - k) * 0.15))}px ${font}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(5,4,16,0.85)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.colour;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
