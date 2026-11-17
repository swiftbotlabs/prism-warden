// Shared constants for Prism Warden: arena size, the three lights, the palette and the base tuning numbers.
export const ARENA_W = 1280;
export const ARENA_H = 800;
export const STEP = 1 / 60;
export const TOTAL_WAVES = 10;
export const TAU = Math.PI * 2;

export const CORE_X = 640;
export const CORE_Y = 420;
export const CORE_RADIUS = 34;
export const CORE_BASE_HP = 12;

export const EMBER = 0;
export const VERDANT = 1;
export const AZURE = 2;
/** A white Shade is harmed by light of any colour. */
export const WHITE = 3;

/** The three beam colours (and white): name, hotkey, CSS colour, "r,g,b" for rgba(), and the accessibility shape. */
export const LIGHTS = [
  { name: 'Ember', key: '1', hex: '#ff5468', rgb: '255,84,104', shape: 'triangle' },
  { name: 'Verdant', key: '2', hex: '#46f59e', rgb: '70,245,158', shape: 'square' },
  { name: 'Azure', key: '3', hex: '#55a9ff', rgb: '85,169,255', shape: 'circle' },
  { name: 'White', key: '', hex: '#f6f2ff', rgb: '246,242,255', shape: 'diamond' },
];

/** The warm style: cream paper panels with brass edges and dark ink text; `inkPanel` for dark plates with light text. */
export const PALETTE = {
  ink: '#2a1a12',
  dim: '#7a5a3a',
  faint: '#a88a66',
  gold: '#a8641a',
  danger: '#b3261e',
  win: '#1f7a46',
  panel: 'rgba(247,236,210,0.95)',
  panelEdge: '#9a6a24',
  inkPanel: 'rgba(42,26,18,0.88)',
  cream: '#fff4dc',
};

export const FONT = '"Segoe UI", "Helvetica Neue", "Liberation Sans", "DejaVu Sans", Arial, sans-serif';

export const WARDEN_TUNING = { radius: 13, speed: 300, accel: 16 };
export const BEAM_TUNING = { range: 1700, halfWidth: 5, dps: 3.4, branchPower: 0.65, branchSpread: 0.16, maxLegs: 14 };
export const COMBO_TUNING = { window: 3.4, killsPerStep: 5, maxMultiplier: 8 };
