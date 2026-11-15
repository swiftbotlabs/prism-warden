// Drives headless Chrome over the DevTools protocol for the screenshot capture and the playtest (Node 22, no dependencies).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/opt/google/chrome/chrome';

/** Starts Chrome on a blank tab and returns {send, on, errors, close}. */
export async function openBrowser(width = 1280, height = 800) {
  const profile = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'shot-profile-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', `--window-size=${width},${height}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i += 1) await new Promise((r) => setTimeout(r, 100));
  const port = readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const errors = [];
  socket.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    } else if (data.method) {
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
      if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') errors.push(data.params.args.map((a) => a.value ?? a.description).join(' '));
      if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text + ' ' + (data.params.entry.url ?? ''));
      for (const listener of listeners) listener(data);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  return {
    send,
    errors,
    on: (listener) => listeners.push(listener),
    /** Evaluates an expression in the page and returns its value. */
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed');
      return result.result.value;
    },
    async navigate(url) {
      await send('Page.navigate', { url });
    },
    /** Polls `expression` until it is truthy. */
    async waitFor(expression, timeoutMs = 60000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (await this.evaluate(expression).catch(() => false)) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for ${expression}`);
    },
    async close() {
      socket.close();
      chrome.kill();
      await new Promise((r) => setTimeout(r, 300));
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
