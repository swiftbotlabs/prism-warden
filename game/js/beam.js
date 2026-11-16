// Casts the Warden's light: traces each beam through mirrors and walls, fans out Prism branches and records the Shades it strikes.
import { ARENA_H, ARENA_W, BEAM_TUNING, CORE_RADIUS, CORE_X, CORE_Y } from './config.js';
import { partStruck } from './shades.js';
import { beamStats } from './upgrades.js';

/**
 * Prism splitting: every beam the Warden casts this step: the main beam in the chosen colour, then one Prism branch per level,
 * each in the next colour round the spectrum, fanned out to alternate sides at reduced power.
 */
export function castPrismBeams(world, originX, originY, aimX, aimY, colour, levels) {
  const stats = beamStats(levels);
  const angle = Math.atan2(aimY - originY, aimX - originX);
  const beams = [traceReflectingBeam(world, originX, originY, angle, colour, 1, stats)];
  for (let i = 1; i <= stats.branches; i += 1) {
    const side = i % 2 === 1 ? 1 : -1;
    const branchAngle = angle + side * BEAM_TUNING.branchSpread * Math.ceil(i / 2);
    beams.push(traceReflectingBeam(world, originX, originY, branchAngle, (colour + i) % 3, BEAM_TUNING.branchPower, stats));
  }
  return beams;
}

/** Reflection: mirrors (and walls, with Reflect) bounce the beam like light, angle in equals angle out about the normal. */
export function reflectDirection(dx, dy, nx, ny) {
  const dot = dx * nx + dy * ny;
  return { dx: dx - 2 * dot * nx, dy: dy - 2 * dot * ny };
}

/**
 * Follows one ray from (x, y): it reflects off mirror shards (always) and arena walls (one bounce per Reflect level),
 * stops at the Core, and stops at the first Shade it touches unless Lance lets it pierce.
 * Returns the polyline it drew, the bounce points and every Shade hit with the part struck.
 */
export function traceReflectingBeam(world, x, y, angle, colour, power, stats) {
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let remaining = BEAM_TUNING.range;
  let wallBounces = stats.wallBounces;
  let pierceLeft = stats.pierce;
  const reach = stats.halfWidth;
  const beam = { colour, power, halfWidth: reach, points: [x, y], bounces: [], hits: [], endX: x, endY: y, blocked: false };

  for (let leg = 0; leg < BEAM_TUNING.maxLegs && remaining > 1; leg += 1) {
    let stop = remaining;
    let surface = null;
    let normalX = 0;
    let normalY = 0;

    for (const mirror of world.mirrors) {
      const t = raySegment(x, y, dx, dy, mirror);
      if (t < stop) {
        stop = t;
        surface = mirror;
        normalX = mirror.nx;
        normalY = mirror.ny;
      }
    }
    const wallT = rayWall(x, y, dx, dy);
    if (wallT.t < stop) {
      stop = wallT.t;
      surface = 'wall';
      normalX = wallT.nx;
      normalY = wallT.ny;
    }
    const coreT = rayCircle(x, y, dx, dy, CORE_X, CORE_Y, CORE_RADIUS);
    if (coreT < stop) {
      stop = coreT;
      surface = 'core';
    }

    const touched = [];
    for (const shade of world.shades) {
      if (shade.dead) continue;
      const t = rayCircle(x, y, dx, dy, shade.x, shade.y, shade.r + reach);
      if (t < stop) touched.push({ shade, t });
    }
    touched.sort((a, b) => a.t - b.t);
    for (const touch of touched) {
      if (beam.hits.some((hit) => hit.shade === touch.shade)) continue;
      const hx = x + dx * touch.t;
      const hy = y + dy * touch.t;
      beam.hits.push({ shade: touch.shade, part: partStruck(touch.shade, hx, hy), x: hx, y: hy, dx, dy });
      if (pierceLeft > 0) {
        pierceLeft -= 1;
      } else {
        stop = touch.t;
        surface = 'shade';
        break;
      }
    }

    x += dx * stop;
    y += dy * stop;
    remaining -= stop;
    beam.points.push(x, y);

    const reflects = surface !== null && typeof surface === 'object' || (surface === 'wall' && wallBounces > 0);
    if (!reflects) {
      beam.blocked = surface === 'shade' || surface === 'core';
      break;
    }
    if (surface === 'wall') wallBounces -= 1;
    else surface.glow = 1;
    ({ dx, dy } = reflectDirection(dx, dy, normalX, normalY));
    beam.bounces.push(x, y);
    x += dx * 0.5;
    y += dy * 0.5;
  }
  beam.endX = x;
  beam.endY = y;
  return beam;
}

/** Distance along a unit ray to a mirror segment, or Infinity. */
function raySegment(px, py, dx, dy, mirror) {
  const ex = mirror.x2 - mirror.x1;
  const ey = mirror.y2 - mirror.y1;
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-9) return Infinity;
  const qx = mirror.x1 - px;
  const qy = mirror.y1 - py;
  const t = (qx * ey - qy * ex) / denominator;
  const u = (qx * dy - qy * dx) / denominator;
  return t > 1e-3 && u >= 0 && u <= 1 ? t : Infinity;
}

/** Distance along a unit ray to a circle (0 if the ray starts inside), or Infinity. */
export function rayCircle(px, py, dx, dy, cx, cy, r) {
  const fx = px - cx;
  const fy = py - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  if (c < 0) return 0;
  const disc = b * b - c;
  if (disc < 0 || b > 0) return Infinity;
  return -b - Math.sqrt(disc);
}

/** Distance along a unit ray to the arena wall it leaves through, with that wall's normal. */
function rayWall(px, py, dx, dy) {
  const tx = dx > 0 ? (ARENA_W - px) / dx : dx < 0 ? -px / dx : Infinity;
  const ty = dy > 0 ? (ARENA_H - py) / dy : dy < 0 ? -py / dy : Infinity;
  if (tx < ty) return { t: Math.max(0, tx), nx: 1, ny: 0 };
  return { t: Math.max(0, ty), nx: 0, ny: 1 };
}
