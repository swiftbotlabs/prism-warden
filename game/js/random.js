// Seeded random streams (mulberry32): `sim` drives the rules and `fx` the cosmetic particles, so a seed replays a run exactly.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let simNext = mulberry32(1);
let fxNext = mulberry32(2);

/** Restarts both streams from one seed. */
export function seedRandom(seed) {
  simNext = mulberry32(Math.imul(seed | 0, 2654435761) ^ 0x51ed27);
  fxNext = mulberry32((seed | 0) ^ 0x9e3779b9);
}

/** A number in [0, 1) from the rules stream. */
export function simRandom() {
  return simNext();
}

/** A number in [0, 1) from the cosmetic stream. */
export function fxRandom() {
  return fxNext();
}

export function simRange(min, max) {
  return min + (max - min) * simNext();
}

export function fxRange(min, max) {
  return min + (max - min) * fxNext();
}

export function simPick(list) {
  return list[Math.floor(simNext() * list.length)];
}

/** Shuffles a list in place with the rules stream. */
export function simShuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(simNext() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
