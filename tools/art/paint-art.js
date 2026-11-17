// Paints Prism Warden's baked art in a browser canvas: the creature/character sprite atlas and the Lantern Observatory floor.
// Run by tools/bake-art.mjs in headless Chrome; the results are written to game/art/ (atlas.png, floor.jpg).
// Atlas grid (128 px cells): rows 0-4 drifter, darter, splitter, shard, prismling in columns Ember, Verdant, Azure, White;
// row 5: bulwark body, umbra orb, Warden (facing right), lantern crystal; rows 6-9: ECLIPSE faces (256 px): calm, angry, screaming, fallen.
(() => {
  const CELL = 128;
  const TINTS = [['#ff5468', '#b3122e'], ['#46f59e', '#0f8a52'], ['#55a9ff', '#1557b8'], ['#fbf6ea', '#b9ad95']];
  const SHAPES = ['triangle', 'square', 'circle', 'diamond'];
  const INK = '#22141f';
  const EYE = '#fff1b8';

  function glyph(g, shape, x, y, r, fill = '#fff8e6') {
    g.beginPath();
    if (shape === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
    else {
      const n = shape === 'triangle' ? 3 : 4;
      const start = shape === 'triangle' ? -Math.PI / 2 : shape === 'square' ? Math.PI / 4 : 0;
      const k = shape === 'triangle' ? 1.2 : shape === 'square' ? 1.15 : 1.25;
      for (let i = 0; i < n; i += 1) {
        const a = start + (i / n) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
      }
      g.closePath();
    }
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
  }

  function eyes(g, x, y, gap, r, look = 0, angry = false) {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + side * gap, y, r, r * 1.15, 0, 0, Math.PI * 2);
      g.fillStyle = EYE;
      g.shadowColor = EYE;
      g.shadowBlur = 8;
      g.fill();
      g.shadowBlur = 0;
      g.beginPath();
      g.arc(x + side * gap + look, y + 1, r * 0.45, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
      if (angry) {
        g.beginPath();
        g.moveTo(x + side * gap - side * r * 1.4, y - r * 1.6);
        g.lineTo(x + side * gap + side * r * 0.9, y - r * 0.7);
        g.lineWidth = 3;
        g.strokeStyle = INK;
        g.stroke();
      }
    }
  }

  function grin(g, x, y, w, teeth = 3) {
    g.beginPath();
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x, y + w * 0.7, x + w, y);
    g.quadraticCurveTo(x, y + w * 0.35, x - w, y);
    g.fillStyle = '#5b1424';
    g.fill();
    g.fillStyle = EYE;
    for (let i = 0; i < teeth; i += 1) {
      const tx = x - w * 0.6 + (i / Math.max(1, teeth - 1)) * w * 1.2;
      g.beginPath();
      g.moveTo(tx - 3, y + 1);
      g.lineTo(tx + 3, y + 1);
      g.lineTo(tx, y + 6);
      g.fill();
    }
  }

  function shadow(g, w, y) {
    g.beginPath();
    g.ellipse(0, y, w, w * 0.3, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(50,25,10,0.28)';
    g.fill();
  }

  function cloakGradient(g, c, top, bottom) {
    const grad = g.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, TINTS[c][0]);
    grad.addColorStop(1, TINTS[c][1]);
    return grad;
  }

  /** Hooded shadow-imp: a glowing cloak in its colour, a dark hood with two eyes and a grin, its colour rune on the clasp. */
  function drifter(g, c) {
    shadow(g, 34, 44);
    g.shadowColor = TINTS[c][0];
    g.shadowBlur = 18;
    g.beginPath();
    g.moveTo(0, -46);
    g.bezierCurveTo(30, -46, 34, -10, 40, 40);
    for (let i = 0; i <= 6; i += 1) g.lineTo(40 - i * 13.3, 40 + (i % 2 ? -8 : 0));
    g.bezierCurveTo(-34, -10, -30, -46, 0, -46);
    g.fillStyle = cloakGradient(g, c, -46, 44);
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.ellipse(0, -12, 23, 21, 0, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    eyes(g, 0, -15, 9, 5, 2);
    grin(g, 0, -3, 9, 3);
    glyph(g, SHAPES[c], 0, 22, 7);
  }

  /** Soot-moth: a fuzzy dark body, wide wings tinted with its colour, big eyes and curled antennae. */
  function darter(g, c) {
    shadow(g, 30, 40);
    g.shadowColor = TINTS[c][0];
    g.shadowBlur = 16;
    for (const side of [-1, 1]) {
      for (const [dy, rx, ry, rot] of [[-8, 30, 20, -0.5], [16, 22, 15, 0.5]]) {
        g.beginPath();
        g.ellipse(side * 26, dy, rx, ry, side * rot, 0, Math.PI * 2);
        g.fillStyle = cloakGradient(g, c, dy - ry, dy + ry);
        g.fill();
        g.lineWidth = 2.5;
        g.strokeStyle = INK;
        g.stroke();
      }
    }
    g.shadowBlur = 0;
    g.beginPath();
    g.ellipse(0, 4, 14, 28, 0, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    g.beginPath();
    for (const side of [-1, 1]) {
      g.moveTo(side * 5, -20);
      g.quadraticCurveTo(side * 14, -44, side * 22, -38);
    }
    g.lineWidth = 2.5;
    g.strokeStyle = INK;
    g.stroke();
    eyes(g, 0, -12, 7, 5.5, 1);
    glyph(g, SHAPES[c], 0, 14, 6);
  }

  /** Splitter: a plump ink-toad already cracking in two, a glowing seam of its colour, two pairs of eyes and a toothy mouth. */
  function splitter(g, c) {
    shadow(g, 42, 44);
    g.beginPath();
    g.ellipse(0, 4, 46, 40, 0, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.shadowColor = TINTS[c][0];
    g.shadowBlur = 20;
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.ellipse(0, 16, 32, 20, 0, 0, Math.PI * 2);
    g.fillStyle = cloakGradient(g, c, -4, 36);
    g.fill();
    g.beginPath();
    g.moveTo(0, -36);
    g.lineTo(-5, -20);
    g.lineTo(4, -8);
    g.lineTo(-3, 6);
    g.lineTo(3, 20);
    g.lineWidth = 4;
    g.strokeStyle = TINTS[c][0];
    g.stroke();
    eyes(g, -20, -12, 6, 4.5, 1);
    eyes(g, 20, -12, 6, 4.5, 1);
    grin(g, 0, 8, 16, 5);
    glyph(g, SHAPES[c], 0, 30, 6);
  }

  /** Ink-wisp: a small flame of its colour with a dark heart and two eyes. */
  function shard(g, c) {
    shadow(g, 22, 40);
    g.shadowColor = TINTS[c][0];
    g.shadowBlur = 16;
    g.beginPath();
    g.moveTo(0, -44);
    g.bezierCurveTo(14, -24, 30, -6, 26, 14);
    g.bezierCurveTo(22, 34, -22, 34, -26, 14);
    g.bezierCurveTo(-30, -6, -14, -24, 0, -44);
    g.fillStyle = cloakGradient(g, c, -44, 34);
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 2.5;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.ellipse(0, 10, 15, 16, 0, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    eyes(g, 0, 8, 6, 4, 1);
    glyph(g, SHAPES[c], 0, 24, 4);
  }

  /** Prismling: a round ink-wisp crowned with cut-crystal horns of its colour, ringed by a faint rainbow. */
  function prismling(g, c) {
    shadow(g, 30, 42);
    g.beginPath();
    g.arc(0, 0, 44, 0, Math.PI * 2);
    const rainbow = g.createConicGradient(0, 0, 0);
    ['#ff5468', '#ffd46e', '#46f59e', '#55a9ff', '#c58bff', '#ff5468'].forEach((col, i) => rainbow.addColorStop(i / 5, col));
    g.lineWidth = 5;
    g.strokeStyle = rainbow;
    g.globalAlpha = 0.7;
    g.stroke();
    g.globalAlpha = 1;
    for (const [x, h] of [[-18, 26], [0, 34], [18, 26]]) {
      g.beginPath();
      g.moveTo(x - 8, -18);
      g.lineTo(x, -18 - h);
      g.lineTo(x + 8, -18);
      g.closePath();
      g.fillStyle = cloakGradient(g, c, -18 - h, -18);
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 4, 30, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.shadowColor = TINTS[c][0];
    g.shadowBlur = 16;
    g.fill();
    g.shadowBlur = 0;
    eyes(g, 0, 0, 10, 5.5, 2);
    grin(g, 0, 12, 9, 3);
    glyph(g, SHAPES[c], 0, 26, 5);
  }

  /** Bulwark: a squat armoured imp; its three colour shell plates are drawn by the game around it, its white heart shows. */
  function bulwark(g) {
    shadow(g, 46, 46);
    g.beginPath();
    g.arc(0, 0, 46, 0, Math.PI * 2);
    const body = g.createRadialGradient(-12, -14, 6, 0, 0, 46);
    body.addColorStop(0, '#4a3446');
    body.addColorStop(1, INK);
    g.fillStyle = body;
    g.fill();
    eyes(g, 0, -16, 13, 6, 0, true);
    g.beginPath();
    g.moveTo(-14, 30);
    g.quadraticCurveTo(0, 22, 14, 30);
    g.lineWidth = 3;
    g.strokeStyle = EYE;
    g.stroke();
    glyph(g, 'diamond', 0, 8, 9, '#ffffff');
  }

  /** Umbra orb: a drop of living ink with a violet sheen and a scowl. */
  function umbra(g) {
    g.beginPath();
    g.moveTo(0, -46);
    g.bezierCurveTo(26, -14, 40, 6, 36, 22);
    g.bezierCurveTo(30, 46, -30, 46, -36, 22);
    g.bezierCurveTo(-40, 6, -26, -14, 0, -46);
    const ink = g.createRadialGradient(-10, -4, 4, 0, 10, 46);
    ink.addColorStop(0, '#7b4fc9');
    ink.addColorStop(0.5, '#2b1240');
    ink.addColorStop(1, '#0d0514');
    g.fillStyle = ink;
    g.shadowColor = '#a070ff';
    g.shadowBlur = 18;
    g.fill();
    g.shadowBlur = 0;
    eyes(g, 0, 12, 10, 5, 0, true);
  }

  /** The Warden: a small robed keeper in midnight blue with brass trim, hood down, facing right. */
  function warden(g) {
    shadow(g, 30, 46);
    g.beginPath();
    g.moveTo(-6, -20);
    g.bezierCurveTo(22, -22, 32, 10, 34, 44);
    g.lineTo(-30, 44);
    g.bezierCurveTo(-30, 10, -26, -18, -6, -20);
    const robe = g.createLinearGradient(0, -20, 0, 44);
    robe.addColorStop(0, '#3d4f8f');
    robe.addColorStop(1, '#1f2850');
    g.fillStyle = robe;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.moveTo(-30, 40);
    g.lineTo(34, 40);
    g.lineWidth = 5;
    g.strokeStyle = '#d6a64a';
    g.stroke();
    g.beginPath();
    g.moveTo(2, -16);
    g.lineTo(6, 40);
    g.lineWidth = 3;
    g.stroke();
    g.beginPath();
    g.arc(-24, -14, 13, 0, Math.PI * 2);
    g.fillStyle = '#2b376b';
    g.fill();
    g.beginPath();
    g.arc(2, -32, 19, 0, Math.PI * 2);
    g.fillStyle = '#f2cfa2';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.stroke();
    g.beginPath();
    g.arc(2, -40, 19, Math.PI * 1.05, Math.PI * 1.95);
    g.fillStyle = '#6b4a2b';
    g.fill();
    g.fillStyle = INK;
    for (const x of [6, 15]) {
      g.beginPath();
      g.arc(x, -32, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(10, -24, 4, 0.2, Math.PI - 0.2);
    g.lineWidth = 2;
    g.stroke();
  }

  /** The lantern head: a cut crystal held in a brass cage, lit from within. */
  function lantern(g) {
    g.beginPath();
    g.moveTo(0, 40);
    g.lineTo(0, 18);
    g.lineWidth = 6;
    g.strokeStyle = '#b8862e';
    g.stroke();
    const facets = [[0, -34], [20, -10], [14, 16], [-14, 16], [-20, -10]];
    g.beginPath();
    facets.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const glass = g.createLinearGradient(-20, -34, 20, 16);
    glass.addColorStop(0, '#ffffff');
    glass.addColorStop(0.5, '#cfe8ff');
    glass.addColorStop(1, '#9fb7ff');
    g.fillStyle = glass;
    g.shadowColor = '#fff6d0';
    g.shadowBlur = 20;
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 3;
    g.strokeStyle = '#b8862e';
    g.stroke();
    g.beginPath();
    for (const [x, y] of facets) {
      g.moveTo(0, -4);
      g.lineTo(x, y);
    }
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(120,140,200,0.8)';
    g.stroke();
  }

  /** A moon face for THE ECLIPSE: pale cratered disc, mood 0 calm, 1 angry, 2 screaming, 3 fallen (grey, cracked). */
  function moon(g, mood) {
    const R = 112;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    const disc = g.createRadialGradient(-30, -36, 10, 0, 0, R);
    disc.addColorStop(0, mood === 3 ? '#b9b2a6' : '#fff4d6');
    disc.addColorStop(1, mood === 3 ? '#6e665c' : '#d2b47c');
    g.fillStyle = disc;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.stroke();
    for (const [x, y, r] of [[-56, -54, 14], [62, -30, 10], [48, 58, 16], [-70, 40, 9], [10, -82, 8]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(120,80,40,0.22)';
      g.fill();
    }
    g.strokeStyle = INK;
    g.fillStyle = INK;
    g.lineCap = 'round';
    g.lineWidth = 7;
    if (mood === 0) {
      for (const side of [-1, 1]) {
        g.beginPath();
        g.arc(side * 40, -18, 18, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      }
      g.beginPath();
      g.arc(0, 30, 26, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    } else if (mood === 1) {
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(side * 70, -50);
        g.lineTo(side * 18, -28);
        g.stroke();
        g.beginPath();
        g.arc(side * 40, -16, 12, 0, Math.PI);
        g.fill();
      }
      g.beginPath();
      g.moveTo(-40, 50);
      g.quadraticCurveTo(0, 22, 40, 50);
      g.stroke();
    } else {
      for (const side of [-1, 1]) {
        g.beginPath();
        g.arc(side * 40, -24, 20, 0, Math.PI * 2);
        g.fillStyle = mood === 3 ? '#4a443c' : '#fff8e0';
        g.fill();
        g.stroke();
        g.beginPath();
        g.arc(side * 40, -22, mood === 3 ? 3 : 7, 0, Math.PI * 2);
        g.fillStyle = INK;
        g.fill();
        g.beginPath();
        g.moveTo(side * 66, -62);
        g.lineTo(side * 22, -52);
        g.stroke();
      }
      g.beginPath();
      g.ellipse(0, 42, 30, mood === 3 ? 10 : 36, 0, 0, Math.PI * 2);
      g.fillStyle = '#3a0c18';
      g.fill();
      g.stroke();
    }
    if (mood === 3) {
      g.lineWidth = 4;
      g.strokeStyle = '#ffd46e';
      g.shadowColor = '#ffd46e';
      g.shadowBlur = 12;
      for (let i = 0; i < 6; i += 1) {
        const a = i * 1.05 + 0.3;
        g.beginPath();
        g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
        g.lineTo(Math.cos(a + 0.3) * 60, Math.sin(a + 0.3) * 60);
        g.lineTo(Math.cos(a - 0.1) * R, Math.sin(a - 0.1) * R);
        g.stroke();
      }
      g.shadowBlur = 0;
    }
  }

  function cell(g, col, row, size, draw) {
    g.save();
    g.translate(col * CELL + size / 2, row * CELL + size / 2);
    draw(g);
    g.restore();
  }

  window.paintAtlas = function paintAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = CELL * 4;
    canvas.height = CELL * 10;
    const g = canvas.getContext('2d');
    [drifter, darter, splitter, shard, prismling].forEach((draw, row) => {
      for (let c = 0; c < 4; c += 1) cell(g, c, row, CELL, (ctx) => draw(ctx, c));
    });
    cell(g, 0, 5, CELL, bulwark);
    cell(g, 1, 5, CELL, umbra);
    cell(g, 2, 5, CELL, warden);
    cell(g, 3, 5, CELL, lantern);
    for (let mood = 0; mood < 4; mood += 1) cell(g, (mood % 2) * 2, 6 + Math.floor(mood / 2) * 2, CELL * 2, (ctx) => moon(ctx, mood));
    return canvas.toDataURL('image/png');
  };

  // ----- The Lantern Observatory floor (1280x800 logical, painted at 2x) -----

  const W = 1280;
  const H = 800;
  const CX = 640;
  const CY = 420;
  function wear(i) {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function marble(g) {
    const size = 80;
    g.fillStyle = '#7a4a26';
    g.fillRect(0, 0, W, H);
    for (let row = 0; row * size < H; row += 1) {
      for (let col = 0; col * size < W; col += 1) {
        const i = row * 31 + col;
        const n = wear(i);
        const x = col * size + 2;
        const y = row * size + 2;
        const terracotta = row === 0 || col === 0 || row >= 9 || col >= 15;
        const tile = g.createLinearGradient(x, y, x + size, y + size);
        tile.addColorStop(0, terracotta ? `hsl(${20 + n * 6}, 50%, ${46 + n * 5}%)` : `hsl(${36 + n * 4}, 50%, ${64 + n * 4}%)`);
        tile.addColorStop(1, terracotta ? `hsl(${16 + n * 6}, 48%, ${40 + n * 5}%)` : `hsl(${33 + n * 4}, 46%, ${58 + n * 4}%)`);
        g.fillStyle = tile;
        g.beginPath();
        g.roundRect(x, y, size - 4, size - 4, 6 + n * 6);
        g.fill();
        if (!terracotta) {
          g.beginPath();
          g.moveTo(x + wear(i + 1) * size, y);
          g.bezierCurveTo(x + size * 0.3, y + size * 0.4, x + size * 0.7, y + size * 0.5, x + wear(i + 2) * size, y + size - 4);
          g.strokeStyle = 'rgba(150,100,60,0.25)';
          g.lineWidth = 1.5;
          g.stroke();
        }
        g.fillStyle = 'rgba(255,240,210,0.18)';
        g.fillRect(x + 4, y + 2, size - 14, 2);
        if (n > 0.86) {
          g.beginPath();
          g.arc(x + (n > 0.93 ? 0 : size - 4), y + size - 4, 9, 0, Math.PI * 2);
          g.fillStyle = '#7a4a26';
          g.fill();
        }
      }
    }
  }

  function sunShafts(g) {
    for (let i = 0; i < 4; i += 1) {
      const x = 80 + i * 330;
      g.save();
      g.translate(x, -40);
      g.rotate(-0.55);
      const shaft = g.createLinearGradient(0, 0, 0, 1100);
      shaft.addColorStop(0, 'rgba(255,236,180,0.32)');
      shaft.addColorStop(1, 'rgba(255,236,180,0)');
      g.fillStyle = shaft;
      g.fillRect(0, 0, 90 + wear(i) * 80, 1100);
      g.restore();
    }
  }

  function brassStarMap(g) {
    const brass = (alpha) => `rgba(170,118,36,${alpha})`;
    const ring = (r, width, alpha, from = 0, to = Math.PI * 2) => {
      g.beginPath();
      g.arc(CX, CY, r, from, to);
      g.strokeStyle = brass(alpha);
      g.lineWidth = width;
      g.stroke();
      g.strokeStyle = 'rgba(255,230,160,0.5)';
      g.lineWidth = 1;
      g.stroke();
    };
    for (let i = 0; i < 6; i += 1) ring(300, 6, 0.85, (i / 6) * Math.PI * 2 + 0.2, ((i + 0.7) / 6) * Math.PI * 2 + 0.2);
    ring(184, 7, 0.9);
    for (let i = 0; i < 60; i += 1) {
      const a = (i / 60) * Math.PI * 2;
      const inner = i % 5 === 0 ? 162 : 172;
      g.beginPath();
      g.moveTo(CX + Math.cos(a) * inner, CY + Math.sin(a) * inner);
      g.lineTo(CX + Math.cos(a) * 180, CY + Math.sin(a) * 180);
      g.strokeStyle = brass(0.8);
      g.lineWidth = i % 5 === 0 ? 3 : 1.5;
      g.stroke();
    }
    for (let c = 0; c < 6; c += 1) {
      const angle = c * 1.05 + 0.4;
      const cx = CX + Math.cos(angle) * 470;
      const cy = CY + Math.sin(angle) * 290;
      const stars = [];
      for (let s = 0; s < 5; s += 1) stars.push([cx + (wear(c * 9 + s) - 0.5) * 220, cy + (wear(c * 9 + s + 50) - 0.5) * 150]);
      g.beginPath();
      stars.forEach(([x, y], s) => (s ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = brass(0.75);
      g.lineWidth = 3;
      g.stroke();
      for (const [x, y] of stars) {
        g.beginPath();
        for (let k = 0; k < 8; k += 1) {
          const r = k % 2 ? 3 : 8;
          g.lineTo(x + Math.cos((k / 8) * Math.PI * 2) * r, y + Math.sin((k / 8) * Math.PI * 2) * r);
        }
        g.closePath();
        g.fillStyle = '#e8b85a';
        g.fill();
        g.strokeStyle = '#7a4f14';
        g.lineWidth = 1;
        g.stroke();
      }
    }
    const dais = g.createRadialGradient(CX - 20, CY - 20, 10, CX, CY, 88);
    dais.addColorStop(0, '#c9a06a');
    dais.addColorStop(1, '#8f6136');
    g.beginPath();
    g.arc(CX, CY, 88, 0, Math.PI * 2);
    g.fillStyle = dais;
    g.fill();
    ring(88, 6, 0.95);
    ring(62, 2, 0.6);
  }

  function rug(g, x, y, w, h) {
    g.fillStyle = '#7d2f2a';
    g.beginPath();
    g.roundRect(x, y, w, h, 8);
    g.fill();
    g.strokeStyle = '#d9a64a';
    g.lineWidth = 4;
    g.strokeRect(x + 10, y + 10, w - 20, h - 20);
  }

  function bookshelf(g, x, y, w, h, vertical) {
    g.fillStyle = 'rgba(40,20,8,0.35)';
    g.fillRect(x + 8, y + 8, w, h);
    g.fillStyle = '#6b3f1f';
    g.fillRect(x, y, w, h);
    const books = ['#a3362e', '#2f5d8a', '#3f7a3a', '#c79a3a', '#6b3a7a', '#d8c7a0'];
    const length = vertical ? h : w;
    for (let p = 6, i = 0; p < length - 8; i += 1) {
      const t = 8 + wear(x + y + i) * 10;
      g.fillStyle = books[i % books.length];
      if (vertical) g.fillRect(x + 6, y + p, w - 12, t - 2);
      else g.fillRect(x + p, y + 6, t - 2, h - 12);
      p += t;
    }
    g.strokeStyle = '#3b210f';
    g.lineWidth = 4;
    g.strokeRect(x, y, w, h);
  }

  function plant(g, x, y, r) {
    g.fillStyle = 'rgba(40,20,8,0.35)';
    g.beginPath();
    g.ellipse(x + 8, y + 10, r + 6, r, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(x, y, r * 0.75, 0, Math.PI * 2);
    g.fillStyle = '#b5552e';
    g.fill();
    g.strokeStyle = '#6e2f16';
    g.lineWidth = 3;
    g.stroke();
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2 + wear(x) * 2;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.ellipse(r * 0.6, 0, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
      g.fillStyle = i % 2 ? '#3f7a3a' : '#5c9a45';
      g.fill();
      g.strokeStyle = '#24461f';
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    }
  }

  function telescope(g, x, y, angle) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = '#5a3a18';
    g.lineWidth = 4;
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
      g.stroke();
    }
    g.rotate(angle);
    const tube = g.createLinearGradient(0, -12, 0, 12);
    tube.addColorStop(0, '#f0c66a');
    tube.addColorStop(1, '#9a6a1e');
    g.fillStyle = tube;
    g.beginPath();
    g.roundRect(-30, -10, 96, 20, 6);
    g.fill();
    g.strokeStyle = '#5a3a10';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#2b1d14';
    g.fillRect(60, -12, 10, 24);
    g.restore();
  }

  /** A warm pool of lamplight on the floor. */
  function lamplight(g, x, y, r) {
    const pool = g.createRadialGradient(x, y, 0, x, y, r);
    pool.addColorStop(0, 'rgba(255,214,140,0.42)');
    pool.addColorStop(0.5, 'rgba(255,190,110,0.16)');
    pool.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = pool;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  window.paintFloor = function paintFloor() {
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const g = canvas.getContext('2d');
    g.scale(2, 2);
    marble(g);
    rug(g, 520, 640, 240, 70);
    brassStarMap(g);
    bookshelf(g, 0, 300, 44, 220, true);
    bookshelf(g, W - 44, 330, 44, 200, true);
    bookshelf(g, 420, H - 40, 200, 40, false);
    plant(g, 70, 600, 30);
    plant(g, 1210, 610, 32);
    plant(g, 300, 210, 24);
    plant(g, 980, 230, 26);
    telescope(g, 1140, 470, -2.4);
    telescope(g, 150, 260, -0.6);
    sunShafts(g);
    for (const [x, y, r] of [[70, 600, 190], [1210, 610, 190], [150, 260, 170], [1140, 470, 170], [640, 420, 260], [520, 760, 180]]) lamplight(g, x, y, r);
    const vignette = g.createRadialGradient(CX, CY, 300, CX, CY, 820);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(70,30,10,0.45)');
    g.fillStyle = vignette;
    g.fillRect(0, 0, W, H);
    return canvas.toDataURL('image/jpeg', 0.86);
  };
})();
