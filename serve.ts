// Serves game/ on http://localhost:8080 (or --port N) so Prism Warden can be played locally; Node 22, standard library only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const portFlag = process.argv.indexOf('--port');
const port = portFlag > 0 ? Number(process.argv[portFlag + 1]) : 8080;

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/** Maps a URL path to a file inside game/, or null if it would leave game/. */
function fileFor(urlPath: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(urlPath, 'http://local').pathname);
  } catch {
    return null;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(gameRoot, path));
  return file.startsWith(gameRoot + sep) ? file : null;
}

createServer(async (request, response) => {
  const file = fileFor(request.url ?? '/');
  if (!file) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Prism Warden is on http://localhost:${port}`);
});
