import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export interface PoolSettings {
  connectionString?: string;
  host?: string;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  max: number;
  connectionTimeoutMillis: number;
}

/**
 * DATABASE_URL (e.g. Neon, Supabase, Cloud SQL public IP) takes precedence and uses TLS by default.
 * Otherwise the classic SQL_HOST / SQL_USER / SQL_PASSWORD / SQL_DB_NAME settings apply (Unix socket or local).
 */
export function buildPoolSettings(env: NodeJS.ProcessEnv = process.env): PoolSettings {
  const base = { max: 10, connectionTimeoutMillis: 15000 };
  if (env.DATABASE_URL) {
    return { ...base, connectionString: env.DATABASE_URL, ssl: env.DATABASE_SSL !== 'false' };
  }
  return {
    ...base,
    host: env.SQL_HOST,
    user: env.SQL_USER,
    password: env.SQL_PASSWORD,
    database: env.SQL_DB_NAME,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolSettings());

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
