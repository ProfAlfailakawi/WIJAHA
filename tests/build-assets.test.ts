import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { BRAND } from '../src/config/brand.ts';

test('B8: production Vite build outputs all BRAND.assets and serves them with HTTP 200', async () => {
  const buildProc = spawnSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(
    buildProc.status,
    0,
    `npm run build failed:\n${buildProc.stdout}\n${buildProc.stderr}`,
  );

  const distPath = path.resolve(process.cwd(), 'dist');
  const app = express();
  app.use(express.static(distPath));

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    const assetEntries = Object.entries(BRAND.assets);
    assert.ok(assetEntries.length > 0, 'BRAND.assets must contain editorial assets');

    for (const [key, assetUrl] of assetEntries) {
      const res = await fetch(`http://127.0.0.1:${port}${assetUrl}`);
      assert.equal(
        res.status,
        200,
        `Production static server returned ${res.status} for BRAND.assets.${key} (${assetUrl})`,
      );
      const contentType = res.headers.get('content-type') || '';
      assert.ok(
        contentType.startsWith('image/'),
        `Expected image/* content-type for ${key}, got ${contentType}`,
      );
      const buf = await res.arrayBuffer();
      assert.ok(buf.byteLength > 1024, `Asset ${key} payload unexpectedly empty (${buf.byteLength} bytes)`);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
