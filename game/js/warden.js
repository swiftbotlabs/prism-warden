// The Warden, the player's floating lens: steering with a little inertia, collision with mirrors and the Core, aim and colour.
import { ARENA_W, CORE_Y, WARDEN_TUNING } from './config.js';
import { clampToArena, pushOutOfCore, pushOutOfMirror } from './arena.js';
import { wardenSpeed } from './upgrades.js';

export function createWarden() {
  return {
    x: ARENA_W / 2,
    y: CORE_Y + 130,
    vx: 0,
    vy: 0,
    r: WARDEN_TUNING.radius,
    colour: 0,
    aimX: ARENA_W / 2,
    aimY: CORE_Y - 200,
    casting: false,
    swapFlash: 0,
  };
}

/** Moves the Warden from `controls` ({moveX, moveY, aimX, aimY, casting, colour}) for one step. */
export function steerWarden(world, controls, dt) {
  const warden = world.warden;
  const top = wardenSpeed(world.upgrades);
  const blend = Math.min(1, WARDEN_TUNING.accel * dt);
  warden.vx += (controls.moveX * top - warden.vx) * blend;
  warden.vy += (controls.moveY * top - warden.vy) * blend;
  warden.x += warden.vx * dt;
  warden.y += warden.vy * dt;
  for (const mirror of world.mirrors) pushOutOfMirror(warden, warden.r, mirror);
  pushOutOfCore(warden, warden.r);
  clampToArena(warden, warden.r);

  warden.aimX = controls.aimX;
  warden.aimY = controls.aimY;
  warden.casting = controls.casting;
  if (controls.colour !== warden.colour) {
    warden.colour = controls.colour;
    warden.swapFlash = 0.25;
    world.events.push({ type: 'select', colour: controls.colour });
  }
  warden.swapFlash = Math.max(0, warden.swapFlash - dt);
}

/** Where the beam leaves the lens: its rim, toward the aim point. */
export function beamOrigin(warden) {
  const angle = Math.atan2(warden.aimY - warden.y, warden.aimX - warden.x);
  return { x: warden.x + Math.cos(angle) * (warden.r + 2), y: warden.y + Math.sin(angle) * (warden.r + 2) };
}
