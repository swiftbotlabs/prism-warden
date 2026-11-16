// The arena as a place: the floor of a ruined crystal observatory at night, painted once to an offscreen canvas.
import { ARENA_H, ARENA_W, CORE_X, CORE_Y, TAU } from './config.js';

const BRASS = '199,154,74';
const PILLARS = [[64, 300], [330, 222], [1214, 470], [262, 604], [1046, 646]];
const CRYSTALS = [[96, 352, 0.4], [372, 248, 2.2], [1186, 506, 3.6], [226, 640, 5.2], [1150, 230, 1.4], [884, 708, 4.4]];
let floor = null;

/** A repeatable pseudo-random number in [0, 1) for tile `i`, so the floor looks the same every run. */
function wear(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Paints the observatory floor at the screen's pixel ratio: flagstones, moonlight, constellations, brass rings, dais, ruins. */
export function paintObservatoryFloor(pixelRatio) {
  floor = document.createElement('canvas');
  floor.width = Math.round(ARENA_W * pixelRatio);
  floor.height = Math.round(ARENA_H * pixelRatio);
  const g = floor.getContext('2d');
  g.scale(pixelRatio, pixelRatio);
  paintFlagstones(g);
  pool(g, CORE_X, CORE_Y, 560, '110,90,220', 0.5);
  pool(g, 300, 240, 300, '170,195,255', 0.16);
  pool(g, 1000, 610, 270, '170,195,255', 0.13);
  paintConstellations(g);
  paintAstrolabe(g);
  for (const [x, y] of PILLARS) paintPillar(g, x, y);
  for (const [x, y, angle] of CRYSTALS) paintCrystals(g, x, y, angle);
  const vignette = g.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 320, ARENA_W / 2, ARENA_H / 2, 820);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(6,3,18,0.42)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, ARENA_W, ARENA_H);
}

export function drawFloor(ctx) {
  if (floor) ctx.drawImage(floor, 0, 0, ARENA_W, ARENA_H);
}

function pool(g, x, y, r, rgb, alpha) {
  const light = g.createRadialGradient(x, y, 0, x, y, r);
  light.addColorStop(0, `rgba(${rgb},${alpha})`);
  light.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = light;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Worn square flagstones, each a slightly different violet and size, some cracked, a few broken away. */
function paintFlagstones(g) {
  const size = 64;
  g.fillStyle = '#0c0820';
  g.fillRect(0, 0, ARENA_W, ARENA_H);
  for (let row = 0; row * size < ARENA_H; row += 1) {
    for (let col = 0; col * size < ARENA_W; col += 1) {
      const i = row * 41 + col;
      const n = wear(i);
      const inset = 2 + wear(i + 7) * 3;
      const x = col * size + inset;
      const y = row * size + inset;
      const side = size - inset - 2 - wear(i + 9) * 3;
      g.fillStyle = `hsl(${250 + n * 14}, ${22 + n * 10}%, ${n > 0.94 ? 7 : 12 + n * 6}%)`;
      g.fillRect(x, y, side, side);
      g.fillStyle = 'rgba(190,170,255,0.06)';
      g.fillRect(x, y, side, 2);
      g.fillRect(x, y, 2, side);
      if (n > 0.72 && n <= 0.94) {
        g.beginPath();
        g.moveTo(x + wear(i + 1) * size, y);
        g.lineTo(x + size * 0.5, y + size * 0.45);
        g.lineTo(x + wear(i + 2) * size, y + size - 4);
        g.strokeStyle = 'rgba(8,4,20,0.55)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
  }
}

/** Faint star charts inlaid in the floor: dots joined by pale lines, away from the centre. */
function paintConstellations(g) {
  for (let c = 0; c < 6; c += 1) {
    const angle = c * 1.05 + 0.4;
    const cx = CORE_X + Math.cos(angle) * 470;
    const cy = CORE_Y + Math.sin(angle) * 290;
    const stars = [];
    for (let s = 0; s < 5; s += 1) stars.push([cx + (wear(c * 9 + s) - 0.5) * 220, cy + (wear(c * 9 + s + 50) - 0.5) * 150]);
    g.beginPath();
    stars.forEach(([x, y], s) => (s === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.strokeStyle = 'rgba(170,200,255,0.26)';
    g.lineWidth = 1.2;
    g.stroke();
    for (const [x, y] of stars) {
      pool(g, x, y, 10, '200,220,255', 0.5);
      g.fillStyle = '#f2f0ff';
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }
}

/** Brass astrolabe rings round the Core with tick marks, a broken outer ring, and the carved dais it stands on. */
function paintAstrolabe(g) {
  const ring = (r, width, alpha, from = 0, to = TAU) => {
    g.beginPath();
    g.arc(CORE_X, CORE_Y, r, from, to);
    g.strokeStyle = `rgba(${BRASS},${alpha})`;
    g.lineWidth = width;
    g.stroke();
  };
  for (let i = 0; i < 6; i += 1) ring(300, 3, 0.4, i * TAU / 6 + 0.2, (i + 0.7) * TAU / 6 + 0.2);
  ring(182, 3, 0.55);
  ring(176, 1, 0.4);
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * TAU;
    const inner = i % 5 === 0 ? 162 : 170;
    g.beginPath();
    g.moveTo(CORE_X + Math.cos(a) * inner, CORE_Y + Math.sin(a) * inner);
    g.lineTo(CORE_X + Math.cos(a) * 176, CORE_Y + Math.sin(a) * 176);
    g.strokeStyle = `rgba(${BRASS},0.45)`;
    g.lineWidth = i % 5 === 0 ? 2 : 1;
    g.stroke();
  }
  const dais = g.createRadialGradient(CORE_X - 20, CORE_Y - 20, 10, CORE_X, CORE_Y, 86);
  dais.addColorStop(0, '#463a86');
  dais.addColorStop(1, '#221a4a');
  g.beginPath();
  g.arc(CORE_X, CORE_Y, 86, 0, TAU);
  g.fillStyle = dais;
  g.fill();
  ring(86, 4, 0.8);
  ring(60, 2, 0.35);
}

/** A broken column seen from above: its shadow, a fluted stump and a fallen drum beside it. */
function paintPillar(g, x, y) {
  g.fillStyle = 'rgba(4,2,12,0.45)';
  g.beginPath();
  g.ellipse(x + 10, y + 12, 34, 30, 0.6, 0, TAU);
  g.fill();
  const drumAngle = wear(x) * TAU;
  g.save();
  g.translate(x + Math.cos(drumAngle) * 48, y + Math.sin(drumAngle) * 48);
  g.rotate(drumAngle + Math.PI / 2);
  g.fillStyle = '#3a3068';
  g.beginPath();
  g.roundRect(-24, -12, 48, 24, 6);
  g.fill();
  g.strokeStyle = 'rgba(200,185,255,0.25)';
  g.stroke();
  g.restore();
  const stone = g.createRadialGradient(x - 8, y - 8, 4, x, y, 30);
  stone.addColorStop(0, '#5b4f96');
  stone.addColorStop(1, '#2c2356');
  g.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * TAU;
    const r = i % 2 ? 30 : 27;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = stone;
  g.fill();
  g.strokeStyle = 'rgba(210,195,255,0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.moveTo(x - 14, y - 6);
  g.lineTo(x + 2, y + 2);
  g.lineTo(x + 6, y + 16);
  g.strokeStyle = 'rgba(10,6,24,0.6)';
  g.stroke();
}

/** A cluster of glassy crystals growing out of the floor at `angle`, with a soft glow. */
function paintCrystals(g, x, y, angle) {
  pool(g, x, y, 60, '150,130,255', 0.28);
  for (let i = 0; i < 4; i += 1) {
    const a = angle + (i - 1.5) * 0.45;
    const length = 22 + wear(x + i) * 22;
    const width = 6 + wear(y + i) * 4;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -width);
    g.lineTo(length * 0.8, -width);
    g.lineTo(length, 0);
    g.lineTo(length * 0.8, width);
    g.lineTo(0, width);
    g.closePath();
    const glass = g.createLinearGradient(0, -width, 0, width);
    glass.addColorStop(0, 'rgba(225,215,255,0.95)');
    glass.addColorStop(1, 'rgba(120,150,255,0.75)');
    g.fillStyle = glass;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }
}
