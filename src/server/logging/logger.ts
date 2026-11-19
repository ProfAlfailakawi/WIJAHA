import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'warn' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'email',
      'requesterEmail',
      'code',
      'devPreviewCode',
      'token',
      'password',
      'query',
      'rawQuery',
      'planText',
      'mfaSecret',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'wijaha-server',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export async function captureServerException(
  err: unknown,
  context: { requestId?: string; route?: string; code?: string } = {},
): Promise<void> {
  const safeMessage = err instanceof Error ? err.message : 'Unknown error';
  logger.error(
    {
      requestId: context.requestId,
      route: context.route,
      code: context.code,
      errName: err instanceof Error ? err.name : 'Error',
      errMsg: safeMessage,
    },
    'Unhandled server exception',
  );

  // Optional Sentry HTTP envelope forwarding when SENTRY_DSN is configured (PII-scrubbed)
  const dsn = process.env.SENTRY_DSN;
  if (dsn && dsn.startsWith('https://')) {
    try {
      const parsed = new URL(dsn);
      const publicKey = parsed.username;
      const projectId = parsed.pathname.replace(/\//g, '');
      if (publicKey && projectId) {
        const storeUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;
        await fetch(storeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: crypto.randomUUID().replace(/-/g, ''),
            timestamp: new Date().toISOString(),
            level: 'error',
            platform: 'node',
            tags: {
              route: context.route || 'unknown',
              code: context.code || 'INTERNAL',
            },
            extra: {
              requestId: context.requestId,
            },
            message: safeMessage.slice(0, 240),
          }),
          signal: AbortSignal.timeout(2500),
        }).catch(() => undefined);
      }
    } catch {
      // Never block request lifecycle on error telemetry
    }
  }
}
