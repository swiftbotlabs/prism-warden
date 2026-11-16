// Captures the screenshots listed in shots.json from the real game in headless Chrome, as JPEGs of at most 256 KiB.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { openBrowser } from './browser.mjs';

const MAX_BYTES = 256 * 1024;
const port = 8093;
const only = process.argv.slice(2);
const shots = JSON.parse(readFileSync(new URL('../shots.json', import.meta.url), 'utf8'));
const server = spawn(process.execPath, [...process.execArgv, 'serve.ts', '--port', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
mkdirSync('screenshots', { recursive: true });
const browser = await openBrowser(1280, 800);
try {
  for (const shot of shots) {
    if (only.length && !only.includes(shot.name)) continue;
    await browser.navigate(`http://localhost:${port}/index.html${shot.query}`);
    await browser.waitFor('window.__shotReady === true', 400000);
    const scene = await browser.evaluate('JSON.stringify(window.__shotScene)');
    let quality = 90;
    let bytes;
    do {
      const { data } = await browser.send('Page.captureScreenshot', { format: 'jpeg', quality });
      bytes = Buffer.from(data, 'base64');
      quality -= 4;
    } while (bytes.length > MAX_BYTES && quality > 30);
    writeFileSync(`screenshots/${shot.name}`, bytes);
    console.log(`${shot.name}: ${(bytes.length / 1024).toFixed(0)} KiB at quality ${quality + 4} ${scene}`);
  }
  if (browser.errors.length) console.log('page errors:', browser.errors);
} finally {
  await browser.close();
  server.kill();
}
