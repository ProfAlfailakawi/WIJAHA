import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();
const localEnvPath = path.resolve(process.cwd(), '.env.local');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
}

export function decode32ByteKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    const b64 = Buffer.from(trimmed, 'base64');
    if (b64.length === 32) {
      return b64;
    }
  } catch {
    return null;
  }
  return null;
}

let devBootstrapLogged = false;

function ensureDevLocalSecrets(): void {
  if (process.env.NODE_ENV === 'production') return;

  const missingEntries: string[] = [];
  if (!process.env.FIELD_ENCRYPTION_KEY || !decode32ByteKey(process.env.FIELD_ENCRYPTION_KEY)) {
    const generatedKey = crypto.randomBytes(32).toString('hex');
    process.env.FIELD_ENCRYPTION_KEY = generatedKey;
    missingEntries.push(`FIELD_ENCRYPTION_KEY="${generatedKey}"`);
  }
  if (!process.env.IP_HASH_SALT || process.env.IP_HASH_SALT.length < 16) {
    const generatedSalt = crypto.randomBytes(24).toString('hex');
    process.env.IP_HASH_SALT = generatedSalt;
    missingEntries.push(`IP_HASH_SALT="${generatedSalt}"`);
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    const generatedSessionSecret = crypto.randomBytes(32).toString('hex');
    process.env.SESSION_SECRET = generatedSessionSecret;
    missingEntries.push(`SESSION_SECRET="${generatedSessionSecret}"`);
  }

  if (missingEntries.length > 0) {
    try {
      const existing = fs.existsSync(localEnvPath) ? fs.readFileSync(localEnvPath, 'utf8') : '';
      const linesToAdd = missingEntries.filter((entry) => {
        const keyName = entry.split('=')[0];
        return !existing.includes(`${keyName}=`);
      });
      if (linesToAdd.length > 0) {
        const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
        fs.appendFileSync(localEnvPath, `${prefix}${linesToAdd.join('\n')}\n`, {
          encoding: 'utf8',
          mode: 0o600,
        });
      }
    } catch {
      // Read-only container filesystem fallback keeps generated keys in process.env
    }
    if (!devBootstrapLogged) {
      devBootstrapLogged = true;
      process.stderr.write(
        JSON.stringify({
          level: 'warn',
          msg: 'Generated ephemeral development security keys in .env.local — mandatory explicit secrets required in production.',
        }) + '\n',
      );
    }
  }
}

export const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().default('http://localhost:3000'),
  ENABLE_DEMO_LOGIN: z.string().optional().default('false'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMTP_WEBHOOK_URL: z.string().optional(),
  SMTP_API_KEY: z.string().optional(),
  SMTP_FROM: z.string().default('no-reply@wijaha.org'),
  BILLING_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(['mock', 'gemini', 'claude']).optional(),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_INTENT: z.string().default('gemini-4-hydrogen'),
  AI_MODEL_GENERATE: z.string().default('gemini-4-hydrogen'),
  AI_MODEL_EMBED: z.string().default('gemini-embedding-2'),
  AI_INTENT_CONFIDENCE_MIN: z.coerce.number().min(0).max(1).default(0.65),
  AI_STAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  AI_DAILY_USER_CAP_KWD: z.coerce.number().positive().default(2.5),
  AI_DAILY_ORG_CAP_KWD: z.coerce.number().positive().default(15),
  AI_DAILY_PLATFORM_CAP_KWD: z.coerce.number().positive().default(100),
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  FIELD_ENCRYPTION_KEY_VERSION: z.string().default('v1'),
  FIELD_ENCRYPTION_KEYS_PREVIOUS: z.string().optional(),
  IP_HASH_SALT: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  ENFORCE_ADMIN_MFA: z.string().optional(),
  ENFORCE_FRAME_DENY: z.string().optional(),
  SQL_HOST: z.string().optional(),
  SQL_DB_NAME: z.string().optional(),
  SQL_USER: z.string().optional(),
  SQL_PASSWORD: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ANON_RESULT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  ACCOUNT_DELETE_GRACE_DAYS: z.coerce.number().int().positive().default(14),
});

export type ValidatedServerEnv = z.infer<typeof ServerEnvSchema> & {
  isProduction: boolean;
  demoLoginEnabled: boolean;
  enforceAdminMfa: boolean;
  enforceFrameDeny: boolean;
  fieldEncryptionKeyBytes: Buffer;
  previousEncryptionKeys: Map<string, Buffer>;
  ipHashSalt: string;
  sessionSecret: string;
};

export function loadAndValidateEnv(rawEnv: NodeJS.ProcessEnv = process.env): ValidatedServerEnv {
  if (rawEnv === process.env && rawEnv.NODE_ENV !== 'production') {
    ensureDevLocalSecrets();
  }

  const parsed = ServerEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  const effectiveAiProvider =
    env.AI_PROVIDER ??
    (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && env.GEMINI_API_KEY.length > 10
      ? 'gemini'
      : 'mock');

  if (isProduction) {
    const errors: string[] = [];
    if (env.ENABLE_DEMO_LOGIN === 'true') {
      errors.push('ENABLE_DEMO_LOGIN=true is strictly forbidden when NODE_ENV=production (A1/G1).');
    }
    if (env.EMAIL_PROVIDER === 'console') {
      errors.push('EMAIL_PROVIDER=console is strictly forbidden when NODE_ENV=production (A2/G1).');
    }
    if (env.BILLING_PROVIDER === 'mock') {
      errors.push('BILLING_PROVIDER=mock is strictly forbidden when NODE_ENV=production (A3/G1).');
    }
    if (effectiveAiProvider === 'mock') {
      errors.push('AI_PROVIDER=mock is strictly forbidden when NODE_ENV=production (D4/G1).');
    }
    if (!env.FIELD_ENCRYPTION_KEY || !decode32ByteKey(env.FIELD_ENCRYPTION_KEY)) {
      errors.push(
        'FIELD_ENCRYPTION_KEY must be set to a valid 32-byte key (64 hex chars or 32-byte base64) in production (B5/G1).',
      );
    }
    if (!env.IP_HASH_SALT || env.IP_HASH_SALT.trim().length < 16) {
      errors.push('IP_HASH_SALT must be set (>= 16 chars) in production (B5/C11/G1).');
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.trim().length < 32) {
      errors.push('SESSION_SECRET must be set (>= 32 chars) in production (B5/G1).');
    }
    if (!env.SQL_HOST || !env.SQL_DB_NAME || !env.SQL_USER || !env.SQL_PASSWORD) {
      errors.push('SQL_HOST, SQL_DB_NAME, SQL_USER, and SQL_PASSWORD are required in production (B5/G1).');
    }
    if (!env.FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID.trim().length === 0) {
      errors.push('FIREBASE_PROJECT_ID is required in production (B6/G1).');
    }
    if (!env.APP_URL.startsWith('https://')) {
      errors.push('APP_URL must start with https:// in production (G1).');
    }
    if (env.BILLING_PROVIDER === 'stripe' && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)) {
      errors.push('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required when BILLING_PROVIDER=stripe.');
    }

    if (errors.length > 0) {
      throw new Error(`WIJAHA production startup refused:\n- ${errors.join('\n- ')}`);
    }
  }

  const keyBytes =
    (env.FIELD_ENCRYPTION_KEY ? decode32ByteKey(env.FIELD_ENCRYPTION_KEY) : null) ??
    crypto.createHash('sha256').update(env.FIELD_ENCRYPTION_KEY || 'dev-fallback-unreachable').digest();

  const previousEncryptionKeys = new Map<string, Buffer>();
  if (env.FIELD_ENCRYPTION_KEYS_PREVIOUS) {
    // Format: "v0:<hexOrBase64>,v1:<hexOrBase64>"
    for (const pair of env.FIELD_ENCRYPTION_KEYS_PREVIOUS.split(',')) {
      const idx = pair.indexOf(':');
      if (idx > 0) {
        const ver = pair.slice(0, idx).trim();
        const decoded = decode32ByteKey(pair.slice(idx + 1));
        if (ver && decoded) {
          previousEncryptionKeys.set(ver, decoded);
        }
      }
    }
  }

  const demoLoginEnabled = !isProduction && env.ENABLE_DEMO_LOGIN === 'true';
  const enforceAdminMfa = isProduction ? true : env.ENFORCE_ADMIN_MFA !== 'false';
  const enforceFrameDeny =
    isProduction ||
    env.ENFORCE_FRAME_DENY === 'true' ||
    process.env.DISABLE_HMR !== 'true';

  return {
    ...env,
    AI_PROVIDER: effectiveAiProvider,
    isProduction,
    demoLoginEnabled,
    enforceAdminMfa,
    enforceFrameDeny,
    fieldEncryptionKeyBytes: keyBytes,
    previousEncryptionKeys,
    ipHashSalt: env.IP_HASH_SALT || 'dev-ephemeral-salt',
    sessionSecret: env.SESSION_SECRET || 'dev-ephemeral-session-secret-minimum-32-chars',
  };
}
