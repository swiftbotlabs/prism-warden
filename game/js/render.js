// Draws the arena scene: the observatory floor, brass mirrors, the orrery Core, creature Shades and THE ECLIPSE, beams, the Warden.
import { ARENA_H, ARENA_W, CORE_RADIUS, CORE_X, CORE_Y, FONT, LIGHTS, TAU } from './config.js';
import { drawLightGlyph } from './icons.js';
import { drawFloaters, drawParticles, drawScorches } from './particles.js';
import { lightHarmsShade, PRISMLING_PERIOD } from './shades.js';
import { drawCreature, drawFloor, drawSprite } from './sprites.js';
import { CHARGE_TIME } from './boss.js';

const INK = '#22141f';
const BRASS = '#c9973a';
const glowSprites = new Map();

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

function line(ctx, x1, y1, x2, y2, colour, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The whole play scene for one frame. `time` animates idle motion; `showReticle` draws the aim cursor. */
export function drawWorld(ctx, world, time, showReticle = true) {
  ctx.save();
  if (world.shake > 0) {
    const s = world.shake * 0.6;
    ctx.translate(Math.sin(time * 91) * s, Math.cos(time * 77) * s);
  }
  drawFloor(ctx);
  drawScorches(ctx);
  for (const mirror of world.mirrors) drawMirror(ctx, mirror, time);
  if (world.state === 'won') drawVictoryRays(ctx, time, Math.min(1, world.stateTime / 1.5));
  drawCore(ctx, world.core, time, world.state === 'lost' ? world.stateTime : 0, world.wave ?? 10);
  drawMotes(ctx, world.motes);
  for (const shade of world.shades) {
    if (shade.dead) continue;
    if (shade.kind === 'eclipse') drawEclipse(ctx, shade, time);
    else drawShade(ctx, shade, time);
  }
  drawBeams(ctx, world.beams, time);
  if (world.state !== 'lost') drawWarden(ctx, world.warden, time);
  drawParticles(ctx);
  if (world.boss && !world.boss.dead && world.boss.entering <= 0) drawEclipseLabel(ctx, world.boss);
  drawFloaters(ctx, FONT);
  ctx.restore();
  if (showReticle && (world.state === 'fight' || world.state === 'cleared')) drawReticle(ctx, world.warden, time);
  if (world.core.flash > 0) {
    const edge = ctx.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 320, ARENA_W / 2, ARENA_H / 2, 780);
    edge.addColorStop(0, 'rgba(200,30,40,0)');
    edge.addColorStop(1, `rgba(200,30,40,${(world.core.flash * 0.6).toFixed(2)})`);
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
    ray.addColorStop(0, `rgba(${rgb},${(0.4 * strength).toFixed(2)})`);
    ray.addColorStop(1, `rgba(${rgb},0)`);
    ctx.beginPath();
    ctx.moveTo(CORE_X, CORE_Y);
    ctx.arc(CORE_X, CORE_Y, 900, angle - 0.05, angle + 0.05);
    ctx.closePath();
    ctx.fillStyle = ray;
    ctx.fill();
  }
  ctx.restore();
}

/** A brass-framed standing mirror seen from above: its shadow, the frame, the glass edge, a glint, feet at both ends. */
function drawMirror(ctx, mirror, time) {
  const ux = Math.cos(mirror.angle) * mirror.length * 0.5 * mirror.born;
  const uy = Math.sin(mirror.angle) * mirror.length * 0.5 * mirror.born;
  const [x1, y1, x2, y2] = [mirror.cx - ux, mirror.cy - uy, mirror.cx + ux, mirror.cy + uy];
  ctx.save();
  ctx.lineCap = 'round';
  line(ctx, x1 + 7, y1 + 9, x2 + 7, y2 + 9, 'rgba(70,35,10,0.3)', 16);
  line(ctx, x1, y1, x2, y2, '#6b4214', 15);
  line(ctx, x1, y1, x2, y2, BRASS, 11);
  line(ctx, x1, y1, x2, y2, '#d8f0ff', 5);
  line(ctx, x1, y1, x2, y2, '#ffffff', 1.5);
  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, TAU);
    ctx.fillStyle = BRASS;
    ctx.fill();
    ctx.strokeStyle = '#5a3a10';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  const glint = ((time * 0.35 + mirror.cx * 0.001) % 1) * 2 - 1;
  drawGlow(ctx, mirror.cx + ux * glint, mirror.cy + uy * glint, 12, '255,255,255', 0.6);
  if (mirror.glow > 0) drawGlow(ctx, mirror.cx, mirror.cy, 44, '255,240,200', mirror.glow * 0.5);
  ctx.restore();
}

/** The dais runes: one lights for each wave reached, so the floor itself counts down to THE ECLIPSE. */
function drawDaisRunes(ctx, wave, time) {
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const x = CORE_X + Math.cos(a) * 75;
    const y = CORE_Y + Math.sin(a) * 75;
    const lit = i < wave;
    if (lit) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, x, y, 14, '255,200,90', 0.5 + 0.15 * Math.sin(time * 3 + i));
      ctx.restore();
    }
    const bits = (i * 7 + 3) % 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    if (bits & 1) { ctx.moveTo(0, -6); ctx.lineTo(4, -2); }
    if (bits & 2) { ctx.moveTo(0, 0); ctx.lineTo(-4, 3); }
    if (bits & 4) { ctx.moveTo(-3, 6); ctx.lineTo(3, 6); }
    ctx.strokeStyle = lit ? '#fff1c0' : 'rgba(70,40,20,0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

/** The Core: a crystal held in a brass orrery whose rings turn round it; its glow, cracks and shield show its health. */
function drawCore(ctx, core, time, shatter, wave) {
  drawDaisRunes(ctx, wave, time);
  const ratio = core.hp / core.maxHp;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, CORE_X, CORE_Y, 110 * (0.9 + 0.1 * Math.sin(time * 2.2)), '255,235,190', 0.25 + 0.3 * ratio);
  if (ratio < 0.34 && shatter === 0) drawGlow(ctx, CORE_X, CORE_Y, 110, '255,60,60', 0.35 + 0.25 * Math.sin(time * 8));
  if (core.healFlash > 0) drawGlow(ctx, CORE_X, CORE_Y, 100, '120,255,170', core.healFlash * 1.5);
  ctx.restore();
  if (shatter > 0) return;
  for (let i = 0; i < 2; i += 1) {
    ctx.save();
    ctx.translate(CORE_X, CORE_Y);
    ctx.rotate(time * (i ? -0.35 : 0.25) + i);
    const rx = 52 + i * 9;
    const ry = 18 + i * 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = '#6b4214';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    const a = time * (1.1 + i * 0.4);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rx, Math.sin(a) * ry, 6, 0, TAU);
    ctx.fillStyle = i ? '#7fb6ff' : '#ff9d5c';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + (i / 6) * TAU;
    points.push(CORE_X + Math.cos(angle) * CORE_RADIUS * 0.85, CORE_Y + Math.sin(angle) * CORE_RADIUS * 1.12);
  }
  for (let i = 0; i < 6; i += 1) {
    const j = (i + 1) % 6;
    const shine = 0.55 + 0.45 * Math.sin(time * 1.4 + i * 1.1);
    ctx.beginPath();
    ctx.moveTo(CORE_X, CORE_Y);
    ctx.lineTo(points[i * 2], points[i * 2 + 1]);
    ctx.lineTo(points[j * 2], points[j * 2 + 1]);
    ctx.closePath();
    const light = Math.round(160 + 90 * shine * (0.4 + 0.6 * ratio));
    ctx.fillStyle = `rgb(${light - 30},${light},255)`;
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) ctx[i === 0 ? 'moveTo' : 'lineTo'](points[i * 2], points[i * 2 + 1]);
  ctx.closePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,10,20,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < Math.round((1 - ratio) * 9); i += 1) {
    const angle = i * 2.39996;
    ctx.beginPath();
    ctx.moveTo(CORE_X + Math.cos(angle) * 4, CORE_Y + Math.sin(angle) * 4);
    ctx.lineTo(CORE_X + Math.cos(angle + 0.3) * 14, CORE_Y + Math.sin(angle + 0.3) * 16);
    ctx.lineTo(CORE_X + Math.cos(angle - 0.1) * 28, CORE_Y + Math.sin(angle - 0.1) * 32);
    ctx.stroke();
  }
  if (core.flash > 0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) ctx[i === 0 ? 'moveTo' : 'lineTo'](points[i * 2], points[i * 2 + 1]);
    ctx.fillStyle = `rgba(255,60,60,${Math.min(0.8, core.flash * 2)})`;
    ctx.fill();
  }
  if (core.shield > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CORE_X, CORE_Y, 68, 0, TAU);
    ctx.strokeStyle = `rgba(60,150,230,${0.6 + 0.2 * Math.sin(time * 3)})`;
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
  for (const mote of motes) drawGlow(ctx, mote.x, mote.y, 16, '120,255,170', 0.9);
  ctx.restore();
}

/** One Shade: its creature sprite (squashing as it spawns, flinching when hit, facing the Core), plus its live rules overlays. */
function drawShade(ctx, shade, time) {
  const { x, y, r } = shade;
  const born = Math.min(1, shade.age * 3);
  const squash = born < 1 ? 0.3 * (1 - born) * Math.cos(born * 9) : 0;
  ctx.save();
  ctx.globalAlpha = Math.min(1, shade.age * 4);
  ctx.translate(x + (shade.flash > 0 ? Math.sin(time * 90) * 3 : 0), y);
  ctx.scale(1 + squash, 1 - squash);
  const size = r * (shade.kind === 'bulwark' ? 3.5 : shade.kind === 'umbra' ? 4.5 : 5.25);
  const reach = r * 1.25;
  drawCreature(ctx, shade.kind, shade.colour, 0, 0, size, CORE_X < x);
  if (shade.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, 0, 0, r * 1.5, '255,255,255', shade.flash * 7);
  }
  ctx.restore();
  ctx.save();
  if (shade.shell) {
    const third = TAU / 3;
    shade.shell.forEach((segment, index) => {
      const from = shade.rot + index * third + 0.1;
      const to = shade.rot + (index + 1) * third - 0.1;
      ctx.beginPath();
      ctx.arc(x, y, reach + 3, from, to);
      if (segment.hp > 0) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 11;
        ctx.stroke();
        ctx.strokeStyle = LIGHTS[segment.colour].hex;
        ctx.lineWidth = 7;
        ctx.stroke();
        const mid = (from + to) / 2;
        drawLightGlyph(ctx, segment.colour, x + Math.cos(mid) * (reach + 13), y + Math.sin(mid) * (reach + 13), 5);
      } else {
        ctx.strokeStyle = 'rgba(40,20,20,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
  if (shade.kind === 'prismling') {
    ctx.beginPath();
    ctx.arc(x, y, reach + 8, -Math.PI / 2, -Math.PI / 2 + (1 - (shade.age % PRISMLING_PERIOD) / PRISMLING_PERIOD) * TAU);
    ctx.strokeStyle = LIGHTS[(shade.colour + 1) % 3].hex;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (shade.hp < shade.maxHp && shade.r >= 14) {
    ctx.beginPath();
    ctx.arc(x, y, reach + (shade.shell ? 18 : 10), -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, shade.hp / shade.maxHp));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/** THE ECLIPSE: a moon-faced creature under a corona crown in its phase colour; its face changes per phase (`fallen`: grey, cracked). */
export function drawEclipse(ctx, boss, time, { fallen = false } = {}) {
  const light = LIGHTS[boss.colour];
  const { x, y, r } = boss;
  if (boss.charging > 0) drawShadowInk(ctx, boss, time);
  ctx.save();
  if (!fallen) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x, y, r * 2.6, light.rgb, 0.85);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.beginPath();
  for (let i = 0; i < 28; i += 1) {
    const angle = boss.rot * 0.5 + (i / 28) * TAU;
    const reach = i % 2 ? r * 1.02 : r * (1.45 + 0.1 * Math.sin(time * 4 + i));
    ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.closePath();
  ctx.fillStyle = fallen ? '#8a8174' : light.hex;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  if (boss.broken > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r + (1.2 - boss.broken) * 260, 0, TAU);
    ctx.strokeStyle = `rgba(255,255,255,${boss.broken * 0.7})`;
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  ctx.restore();
  drawCreature(ctx, 'eclipse', 0, x, y, r * 2.3, false, fallen ? 3 : boss.phase);
  if (!fallen) drawLightGlyph(ctx, boss.colour, x, y - r * 1.25, r * 0.16);
  if (boss.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x, y, r * 1.4, '255,255,255', boss.flash * 4);
    ctx.restore();
  }
}

/** THE ECLIPSE's name on its own ink plate above the crown, drawn after the beams so nothing crosses it. */
function drawEclipseLabel(ctx, boss) {
  const y = boss.y - boss.r * 1.75;
  ctx.font = `900 17px ${FONT}`;
  const width = ctx.measureText('THE ECLIPSE').width + 24;
  ctx.beginPath();
  ctx.roundRect(boss.x - width / 2, y - 13, width, 26, 13);
  ctx.fillStyle = 'rgba(34,20,31,0.9)';
  ctx.fill();
  ctx.strokeStyle = LIGHTS[boss.colour].hex;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff4dc';
  ctx.fillText('THE ECLIPSE', boss.x, y + 1);
}

/** The Shadow Ring telegraph: a ring of ink on the marble, tendrils reaching inward, its dashed edge tightening onto THE ECLIPSE. */
function drawShadowInk(ctx, boss, time) {
  const k = 1 - boss.charging / CHARGE_TIME;
  const outer = boss.r * (3.4 - 1.3 * k);
  const inner = outer - boss.r * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, outer, 0, TAU);
  ctx.arc(boss.x, boss.y, inner, 0, TAU, true);
  ctx.fillStyle = `rgba(34,14,40,${(0.55 + 0.3 * k).toFixed(2)})`;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * TAU + time * 0.4;
    const reach = inner - boss.r * (0.25 + 0.2 * (0.5 + 0.5 * Math.sin(time * 3 + i * 1.9)));
    ctx.moveTo(boss.x + Math.cos(a - 0.09) * inner, boss.y + Math.sin(a - 0.09) * inner);
    ctx.lineTo(boss.x + Math.cos(a) * reach, boss.y + Math.sin(a) * reach);
    ctx.lineTo(boss.x + Math.cos(a + 0.09) * inner, boss.y + Math.sin(a + 0.09) * inner);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, outer + 4, 0, TAU);
  ctx.strokeStyle = `rgba(150,90,220,${(0.6 + 0.4 * k).toFixed(2)})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = -time * 50;
  ctx.stroke();
  ctx.restore();
}

/** Beams on the warm floor: an ink outline, the saturated colour, a soft glow and a white-hot core, flares at bounces, a shaped tip. */
function drawBeams(ctx, beams, time) {
  if (beams.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const flicker = 1 + 0.08 * Math.sin(time * 47);
  for (const beam of beams) {
    const light = LIGHTS[beam.colour];
    const width = beam.halfWidth * flicker * (beam.power < 1 ? 0.75 : 1.15);
    ctx.beginPath();
    ctx.moveTo(beam.points[0], beam.points[1]);
    for (let i = 2; i < beam.points.length; i += 2) ctx.lineTo(beam.points[i], beam.points[i + 1]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(45,18,10,0.6)';
    ctx.lineWidth = width * 2.8;
    ctx.stroke();
    ctx.strokeStyle = light.hex;
    ctx.lineWidth = width * 1.8;
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${light.rgb},0.35)`;
    ctx.lineWidth = width * 4.5;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#fffdf2';
    ctx.lineWidth = Math.max(1.5, width * 0.6);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < beam.bounces.length; i += 2) {
      drawGlow(ctx, beam.bounces[i], beam.bounces[i + 1], 26, light.rgb, 0.9);
      drawGlow(ctx, beam.bounces[i], beam.bounces[i + 1], 10, '255,255,255', 0.9);
    }
    drawGlow(ctx, beam.endX, beam.endY, beam.blocked ? 34 : 18, light.rgb, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const beam of beams) drawLightGlyph(ctx, beam.colour, beam.endX, beam.endY, 6, 0.95);
  for (const beam of beams) {
    const hit = beam.hits.find((h) => !h.shade.dead && !lightHarmsShade(h.shade, h.part, beam.colour));
    if (hit) drawWrongColourTag(ctx, hit.shade.x, hit.shade.y - hit.shade.r * 1.6 - 14, LIGHTS[beam.colour].hex);
  }
  ctx.restore();
}

/** Where a beam glances off a Shade of another colour: a small ink tag, so the rule shows itself. */
function drawWrongColourTag(ctx, x, y, colour) {
  ctx.font = `900 12px ${FONT}`;
  const w = ctx.measureText('× WRONG COLOUR').width + 14;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 10, w, 20, 10);
  ctx.fillStyle = 'rgba(42,26,18,0.9)';
  ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff4dc';
  ctx.fillText('× WRONG COLOUR', x, y + 1);
}

/** The Warden: a robed keeper facing where it casts, its lantern staff tipped with cut crystal glowing in the chosen colour. */
function drawWarden(ctx, warden, time) {
  const light = LIGHTS[warden.colour];
  const { x, y } = warden;
  const aim = Math.atan2(warden.aimY - y, warden.aimX - x);
  const facing = Math.cos(aim) < 0 ? -1 : 1;
  const tipX = x + Math.cos(aim) * 40;
  const tipY = y - 14 + Math.sin(aim) * 40;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, tipX, tipY, 40 + Math.sin(time * 5) * 3, light.rgb, 0.8);
  ctx.globalCompositeOperation = 'source-over';
  if (warden.swapFlash > 0) {
    ctx.beginPath();
    ctx.arc(x, y, 14 + (0.25 - warden.swapFlash) * 120, 0, TAU);
    ctx.strokeStyle = light.hex;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  drawSprite(ctx, 2, 5, x, y - 16, 80, facing < 0);
  line(ctx, x + facing * 8, y + 2, tipX, tipY, '#4a2a10', 6);
  line(ctx, x + facing * 8, y + 2, tipX, tipY, BRASS, 3);
  drawSprite(ctx, 3, 5, tipX, tipY - 4, 40);
  drawLightGlyph(ctx, warden.colour, tipX, tipY - 6, 4);
  ctx.restore();
}

function drawReticle(ctx, warden, time) {
  const light = LIGHTS[warden.colour];
  const x = warden.aimX;
  const y = warden.aimY;
  ctx.save();
  for (const [colour, width] of [[INK, 5], [light.hex, 2.5]]) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    for (let i = 0; i < 4; i += 1) {
      const angle = time * 1.5 + (i / 4) * TAU;
      ctx.moveTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15);
      ctx.lineTo(x + Math.cos(angle) * 21, y + Math.sin(angle) * 21);
    }
    ctx.stroke();
  }
  drawLightGlyph(ctx, warden.colour, x, y, 3.5);
  ctx.restore();
}
