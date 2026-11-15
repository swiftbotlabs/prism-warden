// A built-in pilot that plays the real rules for the screenshot scenes and the playtest: picks the worst threat, matches its colour, aims and guards.
import { CORE_X, CORE_Y, WHITE } from './config.js';
import { partStruck } from './shades.js';

/** Card preference when the pilot chooses an upgrade. */
const PICK_ORDER = ['prism', 'focus', 'reflect', 'lens', 'chain', 'bastion', 'focus', 'lance', 'harvest', 'swift'];

/** The most urgent Shade: soonest to reach the Core, with the boss last unless it is alone. */
function mostUrgentShade(world) {
  let target = null;
  let soonest = Infinity;
  for (const shade of world.shades) {
    if (shade.dead) continue;
    if (shade.x < -10 || shade.x > 1290 || shade.y < -10 || shade.y > 810) continue;
    let eta = (Math.hypot(shade.x - CORE_X, shade.y - CORE_Y) - 40) / Math.max(20, shade.speed);
    if (shade.kind === 'eclipse') eta = shade.entering > 0 ? Infinity : 25;
    if (shade.kind === 'bulwark') eta *= 0.8;
    if (eta < soonest) {
      soonest = eta;
      target = shade;
    }
  }
  return target;
}

/** The colour to cast at a Shade from where the Warden stands. */
function colourFor(world, shade) {
  const warden = world.warden;
  if (shade.kind === 'eclipse') return shade.colour;
  if (shade.shell) {
    const angle = Math.atan2(warden.y - shade.y, warden.x - shade.x);
    const part = partStruck(shade, shade.x + Math.cos(angle) * shade.r, shade.y + Math.sin(angle) * shade.r);
    return part >= 0 ? shade.shell[part].colour : warden.colour;
  }
  return shade.colour === WHITE ? warden.colour : shade.colour;
}

/** A pilot's memory: it re-thinks its target every `reaction` seconds, as a person would (0 = instantly). */
export function createPilot(reaction = 0, aimError = 0) {
  return { reaction, aimError, timer: 0, target: null, colour: 0, clock: 0 };
}

/** Controls for one step: {moveX, moveY, aimX, aimY, casting, colour}. */
export function autopilotControls(world, pilot = createPilot(0), dt = 1 / 60) {
  const warden = world.warden;
  pilot.timer -= dt;
  pilot.clock += dt;
  if (pilot.timer <= 0 || !pilot.target || pilot.target.dead) {
    pilot.timer = pilot.reaction;
    pilot.target = mostUrgentShade(world);
    if (pilot.target) pilot.colour = colourFor(world, pilot.target);
  }
  const target = pilot.target && !pilot.target.dead ? pilot.target : null;
  if (!target) {
    const dx = CORE_X - warden.x;
    const dy = CORE_Y + 110 - warden.y;
    const d = Math.hypot(dx, dy);
    return { moveX: d > 8 ? dx / d : 0, moveY: d > 8 ? dy / d : 0, aimX: warden.aimX, aimY: warden.aimY, casting: false, colour: warden.colour };
  }
  const ox = target.x - CORE_X;
  const oy = target.y - CORE_Y;
  const reach = Math.hypot(ox, oy) || 1;
  const guard = Math.min(110, reach * 0.55);
  const gx = CORE_X + (ox / reach) * guard + (oy / reach) * 30;
  const gy = CORE_Y + (oy / reach) * guard - (ox / reach) * 30;
  const mx = gx - warden.x;
  const my = gy - warden.y;
  const md = Math.hypot(mx, my);
  const pace = Math.min(1, md / 40);
  return {
    moveX: md > 1 ? (mx / md) * pace : 0,
    moveY: md > 1 ? (my / md) * pace : 0,
    aimX: target.x + Math.sin(pilot.clock * 2.3) * pilot.aimError,
    aimY: target.y + Math.cos(pilot.clock * 1.7) * pilot.aimError,
    casting: true,
    colour: pilot.reaction > 0 ? pilot.colour : colourFor(world, target),
  };
}

/** The card the pilot takes from a hand of upgrade ids. */
export function autopilotPick(hand, levels) {
  for (const id of PICK_ORDER) {
    if (hand.includes(id) && (id !== 'focus' || levels.focus < 3)) return hand.indexOf(id);
  }
  return 0;
}
