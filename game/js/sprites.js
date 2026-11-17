// The baked art: loads art/atlas.png (creatures and characters on a 128 px grid) and art/floor.jpg, and draws from them.
import { ARENA_H, ARENA_W } from './config.js';

const CELL = 128;
const art = { atlas: null, floor: null };
/** Atlas row of each Shade kind; the column is its colour (Ember, Verdant, Azure, White). */
const KIND_ROWS = { drifter: 0, darter: 1, splitter: 2, shard: 3, prismling: 4 };

/** Loads the atlas and the floor; resolves once both are drawable (or failed: the game still runs without them). */
export function loadArt() {
  const load = (src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
  return Promise.all([load('art/atlas.png'), load('art/floor.jpg')]).then(([atlas, floor]) => {
    art.atlas = atlas;
    art.floor = floor;
  });
}

/** The Lantern Observatory floor at golden hour. */
export function drawFloor(ctx) {
  if (art.floor) ctx.drawImage(art.floor, 0, 0, ARENA_W, ARENA_H);
  else {
    ctx.fillStyle = '#c99a62';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
}

/** Draws atlas cell (col, row), `cells` wide, centred on (x, y) at `size` px, mirrored when `flip`. */
export function drawSprite(ctx, col, row, x, y, size, flip = false, cells = 1) {
  if (!art.atlas) return;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(art.atlas, col * CELL, row * CELL, CELL * cells, CELL * cells, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** A creature portrait or body: Shade kinds by colour, the Bulwark, an Umbra orb, or THE ECLIPSE's face (`mood` 0-3). */
export function drawCreature(ctx, kind, colour, x, y, size, flip = false, mood = 0) {
  if (kind === 'eclipse') drawSprite(ctx, (mood % 2) * 2, 6 + Math.floor(mood / 2) * 2, x, y, size, false, 2);
  else if (kind === 'bulwark') drawSprite(ctx, 0, 5, x, y, size, flip);
  else if (kind === 'umbra') drawSprite(ctx, 1, 5, x, y, size, flip);
  else drawSprite(ctx, colour, KIND_ROWS[kind], x, y, size, flip);
}
