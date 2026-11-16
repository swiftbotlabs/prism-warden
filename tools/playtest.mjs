// Headless playtest: drives the real game with mouse and keyboard events through start, play, pause, mute, upgrade, win, lose and restart.
import { spawn } from 'node:child_process';
import { openBrowser } from './browser.mjs';

const port = 8095;
const server = spawn(process.execPath, [...process.execArgv, 'serve.ts', '--port', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await openBrowser(1280, 800);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}
const state = () => browser.evaluate(`JSON.stringify({ mode: __prismWarden.mode, wave: __prismWarden.world?.wave, state: __prismWarden.world?.state, time: __prismWarden.world?.time, x: __prismWarden.world?.warden.x, y: __prismWarden.world?.warden.y, colour: __prismWarden.world?.warden.colour, beams: __prismWarden.world?.beams.length, hp: __prismWarden.world?.core.hp, score: __prismWarden.world?.score })`).then(JSON.parse);
const mouse = (type, x, y) => browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
async function click(x = 640, y = 400) {
  await mouse('mouseMoved', x, y);
  await mouse('mousePressed', x, y);
  await sleep(50);
  await mouse('mouseReleased', x, y);
}
const KEYS = { KeyW: ['w', 87], KeyD: ['d', 68], KeyP: ['p', 80], KeyM: ['m', 77], KeyR: ['r', 82], Digit1: ['1', 49], Digit2: ['2', 50], Digit3: ['3', 51], Escape: ['Escape', 27] };
const key = (type, code) => browser.send('Input.dispatchKeyEvent', { type, code, key: KEYS[code][0], windowsVirtualKeyCode: KEYS[code][1] });
async function press(code) {
  await key('keyDown', code);
  await sleep(40);
  await key('keyUp', code);
  await sleep(60);
}

try {
  await browser.navigate(`http://localhost:${port}/index.html`);
  await browser.waitFor('window.__prismWarden?.mode === "title"');
  await sleep(500);
  check('title screen shows on load', (await state()).mode === 'title');

  await click();
  await sleep(300);
  let s = await state();
  check('a click starts a run on wave 1', s.mode === 'play' && s.wave === 1, JSON.stringify(s));

  const start = s;
  await key('keyDown', 'KeyW');
  await key('keyDown', 'KeyD');
  await mouse('mouseMoved', 900, 200);
  await mouse('mousePressed', 900, 200);
  await sleep(1200);
  s = await state();
  check('holding the mouse casts a beam', s.beams >= 1, `beams ${s.beams}`);
  await mouse('mouseReleased', 900, 200);
  await key('keyUp', 'KeyW');
  await key('keyUp', 'KeyD');
  check('WASD moves the Warden', s.x > start.x + 50 && s.y < start.y - 50, `from ${start.x.toFixed(0)},${start.y.toFixed(0)} to ${s.x.toFixed(0)},${s.y.toFixed(0)}`);
  await press('Digit3');
  check('3 selects Azure', (await state()).colour === 2);
  await press('Digit2');
  check('2 selects Verdant', (await state()).colour === 1);

  await press('KeyP');
  const paused = await state();
  await sleep(500);
  const stillPaused = await state();
  check('P pauses and the run stands still', paused.mode === 'paused' && stillPaused.time === paused.time);
  await press('KeyM');
  await press('Escape');
  check('Esc resumes', (await state()).mode === 'play');
  await press('KeyM');

  await sleep(2000);
  const before = await state();
  await press('KeyR');
  s = await state();
  check('R restarts the run', s.mode === 'play' && s.wave === 1 && s.time < before.time, `time ${before.time.toFixed(1)} -> ${s.time.toFixed(1)}`);

  // Losing for real: never cast, take cards with key 1, until the Core shatters.
  const lossStart = Date.now();
  while (Date.now() - lossStart < 150000) {
    s = await state();
    if (s.mode === 'results') break;
    if (s.mode === 'upgrade') await press('Digit1');
    await sleep(500);
  }
  check('an undefended Core shatters and the results show', s.mode === 'results' && s.state === 'lost', `wave ${s.wave} after ${((Date.now() - lossStart) / 1000).toFixed(0)}s`);
  await sleep(900);
  await click();
  await sleep(300);
  s = await state();
  check('a click on the results plays again', s.mode === 'play' && s.wave === 1);

  // The upgrade choice, live: wave 9 cleared by the autopilot (THE ECLIPSE previewed), then a card picked with the mouse.
  await browser.navigate(`http://localhost:${port}/index.html?shot=upgrade&seed=7&live=1`);
  await browser.waitFor('window.__shotReady === true', 120000);
  check('the upgrade screen deals three cards', (await state()).mode === 'upgrade');
  await mouse('mouseMoved', 640, 470);
  await sleep(500);
  await click(640, 470);
  await sleep(300);
  s = await state();
  check('clicking a card starts the boss wave', s.mode === 'play' && s.wave === 10, JSON.stringify(s));

  // Winning: the autopilot beats all ten waves and THE ECLIPSE with the real rules.
  await browser.navigate(`http://localhost:${port}/index.html?shot=results&seed=7&live=1`);
  await browser.waitFor('window.__shotReady === true', 120000);
  s = await state();
  check('beating THE ECLIPSE on wave 10 shows VICTORY', s.mode === 'results' && s.state === 'won' && s.wave === 10, `score ${s.score}`);
  await sleep(900);
  await press('KeyR');
  s = await state();
  check('R on the results plays again', s.mode === 'play' && s.wave === 1);
} finally {
  const errors = browser.errors.filter((e) => !/favicon/.test(e));
  check('no console errors or exceptions', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `${failed} check(s) failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
