// Hands in Prism Warden for make.fun's best-game-01: checks game/ and screenshots/ against the gate's limits, copies
// them to the output directory (/output, or MAKEFUN_OUTPUT_DIR outside the grader) and writes dossier.json with the
// vendored buildDossier. Node 22+, standard library only:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const LIMITS = {
  screenshotsMin: 3,
  screenshotsMax: 4,
  screenshotBytes: 256 * 1024,
  longSideMax: 1280,
  shortSideMin: 480,
  gameEntries: 993,
  gameBytes: 48 * 1024 * 1024,
  gamePathBytes: 1000,
  indexHtmlBytes: 1024 * 1024,
};

type ImageInfo = { format: 'png' | 'jpeg'; width: number; height: number };

/** Stops the hand-in with a message saying what is wrong and how to fix it. */
function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

/** Reads a PNG's or JPEG's pixel size from its header; null when the bytes are neither. */
function readImageInfo(bytes: Buffer): ImageInfo | null {
  const png = bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString('ascii', 12, 16) === 'IHDR';
  if (png) return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    const length = bytes.readUInt16BE(at + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { format: 'jpeg', width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    at += 2 + length;
  }
  return null;
}

/** screenshots/ must hold 3 or 4 whole PNG/JPEG images within the size limits; returns their names in cover order. */
function checkScreenshots(): string[] {
  if (!existsSync(shotsDir)) fail('screenshots/ is missing: capture 3 or 4 screenshots of the game first (node tools/capture-shots.mjs).');
  const names = readdirSync(shotsDir).filter((name) => !name.startsWith('.')).sort();
  if (names.length < LIMITS.screenshotsMin || names.length > LIMITS.screenshotsMax) {
    fail(`screenshots/ holds ${names.length} images (${names.join(', ') || 'none'}); it needs ${LIMITS.screenshotsMin} or ${LIMITS.screenshotsMax}.`);
  }
  for (const name of names) {
    const path = join(shotsDir, name);
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name)) fail(`screenshots/${name}: use only letters, digits and . _ - (not starting with - or .).`);
    if (!lstatSync(path).isFile()) fail(`screenshots/${name} is not a regular file.`);
    const bytes = readFileSync(path);
    if (bytes.length > LIMITS.screenshotBytes) fail(`screenshots/${name} is ${(bytes.length / 1024).toFixed(0)} KiB; the limit is 256 KiB (lower the JPEG quality).`);
    const info = readImageInfo(bytes);
    if (!info) fail(`screenshots/${name} is not a whole PNG or JPEG image.`);
    const long = Math.max(info.width, info.height);
    const short = Math.min(info.width, info.height);
    if (long > LIMITS.longSideMax) fail(`screenshots/${name} is ${info.width}x${info.height}; its long side must be at most ${LIMITS.longSideMax}.`);
    if (short < LIMITS.shortSideMin) fail(`screenshots/${name} is ${info.width}x${info.height}; its short side must be at least ${LIMITS.shortSideMin}.`);
  }
  return names;
}

/** game/ must be plain files and folders within the gate's counts and sizes, with game/index.html. */
function checkGame(): { entries: number; bytes: number } {
  const index = join(gameDir, 'index.html');
  if (!existsSync(index) || !lstatSync(index).isFile()) fail('game/index.html is missing.');
  if (lstatSync(index).size > LIMITS.indexHtmlBytes) fail('game/index.html is over 1 MiB.');
  let entries = 0;
  let bytes = 0;
  const walk = (dir: string, relative: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative ? `${relative}/${name}` : name;
      const stats = lstatSync(path);
      entries += 1;
      if (Buffer.byteLength(`game/${rel}`) > LIMITS.gamePathBytes) fail(`game/${rel}: the path is longer than ${LIMITS.gamePathBytes} bytes.`);
      if (stats.isSymbolicLink()) fail(`game/${rel} is a symbolic link; the gate allows plain files and directories only.`);
      if (stats.isDirectory()) walk(path, rel);
      else if (stats.isFile()) bytes += stats.size;
      else fail(`game/${rel} is neither a file nor a directory.`);
    }
  };
  walk(gameDir, '');
  if (entries > LIMITS.gameEntries) fail(`game/ holds ${entries} files and directories; the limit is ${LIMITS.gameEntries}.`);
  if (bytes > LIMITS.gameBytes) fail(`game/ holds ${(bytes / 1048576).toFixed(1)} MiB; the limit is 48 MiB.`);
  return { entries, bytes };
}

const shots = checkScreenshots();
const game = checkGame();

mkdirSync(outDir, { recursive: true });
for (const stale of ['game', 'screenshots', 'dossier.json']) rmSync(join(outDir, stale), { recursive: true, force: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
for (const name of shots) cpSync(join(shotsDir, name), join(outDir, 'screenshots', name));

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: LIMITS.screenshotsMax, max_bytes: LIMITS.screenshotBytes },
  game_max_files: LIMITS.gameEntries,
  game_max_bytes: 50331648,
  game_path_max_bytes: LIMITS.gamePathBytes,
});
if (dossier.length > 1.5 * 1024 * 1024) fail(`dossier.json would be ${(dossier.length / 1048576).toFixed(2)} MiB; the gate allows 1.5 MiB (smaller screenshots help).`);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Prism Warden handed in to ${outDir}: game/ (${game.entries} entries, ${(game.bytes / 1024).toFixed(0)} KiB), ${shots.length} screenshots (${shots.join(', ')}), dossier.json (${(dossier.length / 1024).toFixed(0)} KiB).`);
