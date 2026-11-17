// Vector icons drawn in code: the colour shapes (Ember triangle, Verdant square, Azure circle, White diamond) and the upgrade card icons.
import { LIGHTS, TAU } from './config.js';

/** Adds the outline of `shape` (radius r, rotated by rot) to the current path. */
export function traceShape(ctx, shape, x, y, r, rot = 0) {
  if (shape === 'circle') {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
    return;
  }
  const corners = shape === 'triangle' ? 3 : 4;
  const start = shape === 'triangle' ? -Math.PI / 2 : shape === 'square' ? Math.PI / 4 : 0;
  const scale = shape === 'triangle' ? 1.18 : shape === 'square' ? 1.12 : 1.2;
  for (let i = 0; i < corners; i += 1) {
    const angle = rot + start + (i / corners) * TAU;
    const px = x + Math.cos(angle) * r * scale;
    const py = y + Math.sin(angle) * r * scale * (shape === 'diamond' ? 1.15 : 1);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** A filled colour glyph: the shape of light `colour` in its colour, with a dark outline so it reads on any ground. */
export function drawLightGlyph(ctx, colour, x, y, r, alpha = 1) {
  const light = LIGHTS[colour];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  traceShape(ctx, light.shape, x, y, r);
  ctx.fillStyle = light.hex;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.strokeStyle = 'rgba(8,6,24,0.85)';
  ctx.stroke();
  ctx.restore();
}


/** Line art for an upgrade card, centred on (x, y) inside a box of `size`. */
export function drawUpgradeIcon(ctx, id, x, y, size) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  const ink = '#f4f0ff';
  const gold = '#ffd46e';
  const [ember, verdant, azure] = LIGHTS.map((light) => light.hex);
  const line = (colour, points, width = 6) => {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  switch (id) {
    case 'prism':
      line(ink, [-46, 6, -12, 6], 5);
      line(ember, [8, 2, 46, -22]);
      line(verdant, [8, 6, 48, 6]);
      line(azure, [8, 10, 46, 34]);
      ctx.beginPath();
      traceShape(ctx, 'triangle', 0, 8, 26);
      ctx.fillStyle = 'rgba(200,220,255,0.18)';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.stroke();
      break;
    case 'reflect':
      line('rgba(200,225,255,0.7)', [38, -44, 38, 44], 8);
      line(azure, [-44, -36, 34, 0, -44, 36]);
      line(ink, [-44, -36, 34, 0, -44, 36], 2);
      break;
    case 'focus':
      for (const r of [40, 26, 12]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.strokeStyle = r === 12 ? gold : ink;
        ctx.lineWidth = r === 12 ? 8 : 4;
        ctx.stroke();
      }
      line(ember, [-48, 0, -30, 0]);
      line(ember, [48, 0, 30, 0]);
      break;
    case 'lens':
      ctx.beginPath();
      ctx.ellipse(-10, 0, 14, 40, 0, 0, TAU);
      ctx.fillStyle = 'rgba(160,210,255,0.22)';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(85,169,255,0.55)';
      ctx.fillRect(4, -18, 44, 36);
      line(ink, [-48, 0, -24, 0], 4);
      line(ink, [6, 0, 48, 0], 3);
      break;
    case 'chain':
      for (const [cx, cy] of [[-34, 26], [34, -26]]) {
        ctx.beginPath();
        traceShape(ctx, 'square', cx, cy, 12);
        ctx.fillStyle = verdant;
        ctx.fill();
      }
      line(gold, [-24, 18, -6, -2, 4, 10, 24, -18], 6);
      break;
    case 'lance':
      for (const cx of [-12, 22]) {
        ctx.beginPath();
        ctx.arc(cx, 0, 14, 0, TAU);
        ctx.strokeStyle = ember;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      line(ink, [-48, 0, 44, 0], 5);
      line(ink, [30, -12, 46, 0, 30, 12], 5);
      break;
    case 'bastion':
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * TAU - Math.PI / 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(angle) * 22, Math.sin(angle) * 26);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(210,240,255,0.85)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 40, -Math.PI * 0.95, -Math.PI * 0.05);
      ctx.strokeStyle = '#78dcff';
      ctx.lineWidth = 7;
      ctx.stroke();
      line(gold, [0, 34, 0, 46], 5);
      break;
    case 'swift':
      line(ink, [-40, -28, -12, 0, -40, 28], 8);
      line(gold, [-6, -28, 22, 0, -6, 28], 8);
      line('rgba(244,240,255,0.5)', [-50, 0, -30, 0], 4);
      break;
    case 'harvest':
      ctx.beginPath();
      traceShape(ctx, 'diamond', 18, 4, 22);
      ctx.fillStyle = 'rgba(210,240,255,0.9)';
      ctx.fill();
      for (const [mx, my, r] of [[-38, -24, 6], [-24, 22, 7], [-44, 8, 5]]) {
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, TAU);
        ctx.fillStyle = '#9fffcf';
        ctx.fill();
      }
      break;
    case 'pact':
      ctx.beginPath();
      ctx.arc(-4, -6, 34, 0.6, Math.PI * 1.9);
      ctx.arc(10, -14, 26, Math.PI * 1.75, 0.75, true);
      ctx.closePath();
      ctx.fillStyle = ember;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(20, 18);
      ctx.quadraticCurveTo(32, 34, 20, 44);
      ctx.quadraticCurveTo(8, 34, 20, 18);
      ctx.fillStyle = '#ff9aa8';
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}
