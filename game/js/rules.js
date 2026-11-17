// PRISM WARDEN: a top-down light-bending defence game. You are the Warden; a Prism splits your beam into three colours, mirrors bend it.
// A run: ten waves of colour-coded Shades march on the Core, only light of their own colour burns them; wave 10 is THE ECLIPSE.
// The rules as data: how a run is won and lost, the ten waves, the boss, the Shades, synergies, difficulties, feats.
import { AZURE, EMBER, TOTAL_WAVES, VERDANT } from './config.js';

/** Win: break THE ECLIPSE on the last wave. */
export const WIN_RULE = `break THE ECLIPSE after wave ${TOTAL_WAVES}`;
/** Lose: the Core reaches 0. */
export const LOSE_RULE = 'the Core shatters';

const ALL = [EMBER, VERDANT, AZURE];

/** Ten waves: who comes, which colours, the gap between spawns, the chance of a white Shade, and the first-time hint. */
export const WAVE_TABLE = [
  { title: 'First Light', mix: { drifter: 8 }, colours: [EMBER], gap: 1.5, white: 0,
    hint: 'Hold the left mouse button to cast light. Ember (1) burns red Shades.' },
  { title: 'Two Hues', mix: { drifter: 14 }, colours: [EMBER, VERDANT], gap: 1.15, white: 0,
    hint: 'Press 2 (or scroll) for Verdant. Only light of a Shade\'s own colour harms it.' },
  { title: 'Darters', mix: { drifter: 10, darter: 9 }, colours: ALL, gap: 0.95, white: 0,
    hint: 'Azure is 3. Darters zig-zag fast. Bounce light off mirror shards to reach them.' },
  { title: 'Splitters', mix: { drifter: 9, darter: 8, splitter: 5 }, colours: ALL, gap: 0.95, white: 0,
    hint: 'Splitters burst into two small Shades of the other colours.' },
  { title: 'Prismlings', mix: { drifter: 9, darter: 9, splitter: 4, prismling: 6 }, colours: ALL, gap: 0.86, white: 0.08,
    hint: 'Prismlings change colour every 2 s. White Shades fall to any light.' },
  { title: 'Bulwarks', mix: { drifter: 10, darter: 10, splitter: 5, prismling: 6, bulwark: 3 }, colours: ALL, gap: 0.8, white: 0.08,
    hint: 'Break one Bulwark shell segment with its colour, then hit its heart through the gap.' },
  { title: 'Converging Dark', mix: { drifter: 13, darter: 13, splitter: 7, prismling: 7, bulwark: 4 }, colours: ALL, gap: 0.72, white: 0.1 },
  { title: 'Storm of Hues', mix: { drifter: 14, darter: 15, splitter: 8, prismling: 9, bulwark: 4 }, colours: ALL, gap: 0.66, white: 0.1 },
  { title: 'The Last Dusk', mix: { drifter: 15, darter: 17, splitter: 9, prismling: 10, bulwark: 5 }, colours: ALL, gap: 0.62, white: 0.1 },
  { title: 'THE ECLIPSE', mix: { drifter: 10, darter: 8, prismling: 4 }, colours: ALL, gap: 2.4, white: 0.15, boss: true,
    hint: 'Match the Eclipse\'s colour to break its phases. Survive all three.' },
];

/** Boss phases: shell colour (-1 = cycles), health, orbit, the legion it calls from the edges and how often, its Shadow Ring. */
export const BOSS_PHASES = [
  { name: 'UMBRA', colour: EMBER, hp: 30, orbitSpeed: 0.2, radius: 300, legion: ['drifter', 'drifter', 'darter'], every: 5, ring: 8, blurb: 'Ember shell · Drifter legions' },
  { name: 'PENUMBRA', colour: AZURE, hp: 36, orbitSpeed: 0.32, radius: 285, legion: ['darter', 'drifter', 'darter', 'prismling'], every: 5.5, ring: 10, blurb: 'Azure shell · Darter legions' },
  { name: 'TOTALITY', colour: -1, hp: 44, orbitSpeed: 0.4, radius: 250, legion: ['splitter', 'darter', 'prismling', 'drifter', 'darter'], every: 6, ring: 12, blurb: 'colour shifts · rings of shadow' },
];

/** The Shades: each kind's behaviour line (shown on the title roster) and base stats; speed in px/s before the wave's speed-up. */
export const SHADE_KINDS = {
  drifter: { label: 'Drifter', line: 'drifts straight at the Core', radius: 17, hp: 2.0, speed: 44, value: 10, coreDamage: 1 },
  darter: { label: 'Darter', line: 'zig-zags in fast', radius: 12, hp: 1.1, speed: 92, value: 15, coreDamage: 1 },
  splitter: { label: 'Splitter', line: 'bursts into two of the other colours', radius: 21, hp: 3.0, speed: 38, value: 20, coreDamage: 2 },
  shard: { label: 'Shard', line: 'a Splitter\'s fast leftover', radius: 10, hp: 0.7, speed: 74, value: 5, coreDamage: 1 },
  prismling: { label: 'Prismling', line: 'changes colour every 2 s', radius: 16, hp: 2.4, speed: 50, value: 25, coreDamage: 1 },
  bulwark: { label: 'Bulwark', line: 'three-colour shell, then a white heart', radius: 29, hp: 2.6, speed: 25, value: 60, coreDamage: 3, shellHp: 2.2 },
  umbra: { label: 'Umbra', line: 'Shadow Ring ink; any light cuts it', radius: 11, hp: 0.5, speed: 85, value: 5, coreDamage: 1 },
  eclipse: { label: 'The Eclipse', line: 'three-phase boss: match its colour', radius: 90, hp: 1, speed: 0, value: 0, coreDamage: 0 },
};

/** Named upgrade pairs: owning both turns their real interplay into a named build. */
export const SYNERGIES = [
  { name: 'KALEIDOSCOPE', pair: ['prism', 'reflect'], line: 'split beams bounce off the walls' },
  { name: 'STARFALL', pair: ['prism', 'chain'], line: 'every branch kill arcs on' },
  { name: 'SUNLANCE', pair: ['lens', 'lance'], line: 'a wide beam pierces whole lines' },
  { name: 'BURNING GLASS', pair: ['focus', 'lens'], line: 'the damage bonuses stack' },
  { name: 'HEARTHSTONE', pair: ['bastion', 'harvest'], line: 'motes refill a bigger Core' },
  { name: 'QUICKSILVER', pair: ['swift', 'reflect'], line: 'reposition for bank shots' },
  { name: 'BLOOD MOON', pair: ['pact', 'focus'], line: 'the bonuses compound, the Core pays' },
];

/** Difficulties: Shade counts, speed and score multipliers (STANDARD is the tuned game). */
export const DIFFICULTIES = [
  { id: 'gentle', name: 'GENTLE', count: 0.75, speed: 0.9, score: 0.75 },
  { id: 'standard', name: 'STANDARD', count: 1, speed: 1, score: 1 },
  { id: 'eclipse', name: 'ECLIPSE+', count: 1.3, speed: 1.12, score: 1.5 },
];

/** Feats: achievements checked when a run ends, kept across runs. */
export const FEATS = [
  { name: 'Eclipse Breaker', earned: (w) => w.state === 'won' },
  { name: 'Unbroken Core', earned: (w) => w.state === 'won' && w.stats.coreHits === 0 },
  { name: 'Five in a Breath', earned: (w) => w.stats.burst >= 5 },
  { name: 'Half-Hundred Combo', earned: (w) => w.stats.bestCombo >= 50 },
  { name: 'True Colours', earned: (w) => w.stats.wavesCleared >= 5 && w.stats.onTarget >= 9 * w.stats.offTarget },
  { name: 'Named Build', earned: (w) => SYNERGIES.some((s) => s.pair.every((id) => w.upgrades[id] > 0)) },
  { name: 'Pact Keeper', earned: (w) => w.state === 'won' && w.upgrades.pact > 0 },
  { name: 'Storm Rider', earned: (w) => w.difficulty === 'eclipse' && w.stats.wavesCleared >= 5 },
];
