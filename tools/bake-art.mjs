// Bakes the game's art in headless Chrome: runs tools/art/paint-art.js and writes game/art/atlas.png and game/art/floor.jpg.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openBrowser } from './browser.mjs';

const painter = readFileSync(new URL('./art/paint-art.js', import.meta.url), 'utf8');
const browser = await openBrowser(800, 600);
try {
  await browser.evaluate(painter);
  mkdirSync('game/art', { recursive: true });
  for (const [call, file] of [['paintAtlas()', 'game/art/atlas.png'], ['paintFloor()', 'game/art/floor.jpg']]) {
    const url = await browser.evaluate(call);
    const bytes = Buffer.from(url.split(',')[1], 'base64');
    writeFileSync(file, bytes);
    console.log(`${file}: ${(bytes.length / 1024).toFixed(0)} KiB`);
  }
  if (browser.errors.length) console.log('errors:', browser.errors);
} finally {
  await browser.close();
}
