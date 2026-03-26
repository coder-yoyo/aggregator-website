import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availableEngines } from './services/searchEngines.js';
import { aggregateAndRank } from './utils/aggregate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = normalize(join(__dirname, '..', 'public'));
const port = Number(process.env.PORT || 3000);

const SOURCE_WEIGHTS = { bing: 1, duckduckgo: 1, wikipedia: 0.8 };

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function json(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(payload);
}

async function serveStatic(pathname, res) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(join(publicDir, filePath));

  if (!safePath.startsWith(publicDir)) {
    json(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const data = await readFile(safePath);
    const type = mimeTypes[extname(safePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    json(res, 404, { error: 'Not found' });
  }
}

async function handleSearch(urlObj, res) {
  const query = String(urlObj.searchParams.get('q') || '').trim();
  const limit = Math.max(1, Math.min(Number(urlObj.searchParams.get('limit')) || 10, 25));
  const requested = String(urlObj.searchParams.get('engines') || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  if (!query) return json(res, 400, { error: 'Query parameter q is required.' });

  const engines = requested.length
    ? requested.filter((engine) => availableEngines[engine])
    : Object.keys(availableEngines);

  if (!engines.length) return json(res, 400, { error: 'No valid engines selected.' });

  const start = Date.now();
  const tasks = engines.map(async (engine) => {
    try {
      const results = await availableEngines[engine](query, limit);
      return { engine, status: 'ok', results };
    } catch (error) {
      return {
        engine,
        status: 'error',
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  const settled = await Promise.all(tasks);
  const grouped = Object.fromEntries(settled.map((item) => [item.engine, item.results]));
  const aggregated = aggregateAndRank(grouped, SOURCE_WEIGHTS).slice(0, limit * 2);

  return json(res, 200, {
    query,
    elapsedMs: Date.now() - start,
    engines: settled.map(({ engine, status, error, results }) => ({
      engine,
      status,
      error,
      count: results.length
    })),
    aggregated,
    grouped
  });
}

const server = createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { error: 'Bad request' });
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && urlObj.pathname === '/api/engines') {
    return json(res, 200, { engines: Object.keys(availableEngines) });
  }

  if (req.method === 'GET' && urlObj.pathname === '/api/search') {
    return handleSearch(urlObj, res);
  }

  if (req.method === 'GET') {
    return serveStatic(urlObj.pathname, res);
  }

  return json(res, 405, { error: 'Method not allowed' });
});

server.listen(port, () => {
  console.log(`Aggregator server is running at http://localhost:${port}`);
});
