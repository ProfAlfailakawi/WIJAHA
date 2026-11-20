import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPoolSettings } from './index.ts';

test('pool settings: DATABASE_URL wins and uses TLS by default', () => {
  const s = buildPoolSettings({ DATABASE_URL: 'postgres://u:p@h/db', SQL_HOST: 'ignored' } as NodeJS.ProcessEnv);
  assert.equal(s.connectionString, 'postgres://u:p@h/db');
  assert.equal(s.ssl, true);
  assert.equal(s.host, undefined);
});

test('pool settings: TLS can be disabled explicitly', () => {
  const s = buildPoolSettings({ DATABASE_URL: 'postgres://u:p@h/db', DATABASE_SSL: 'false' } as NodeJS.ProcessEnv);
  assert.equal(s.ssl, false);
});

test('pool settings: classic SQL_* variables still work', () => {
  const s = buildPoolSettings({ SQL_HOST: '127.0.0.1', SQL_USER: 'a', SQL_PASSWORD: 'b', SQL_DB_NAME: 'c' } as NodeJS.ProcessEnv);
  assert.deepEqual([s.host, s.user, s.password, s.database, s.connectionString], ['127.0.0.1', 'a', 'b', 'c', undefined]);
});
