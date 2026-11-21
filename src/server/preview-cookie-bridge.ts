import type { NextFunction, Request, Response } from 'express';

/**
 * Preview-only (enabled with COOKIE_BRIDGE=true).
 *
 * Firebase Hosting forwards ONLY a cookie named `__session` to Cloud Run.
 * WIJAHA uses two cookies (`wijaha_session`, `wijaha_anon`), so behind
 * Hosting they would never reach the server and login would silently fail.
 * This bridge packs every cookie the app sets into one `__session` cookie and
 * unpacks it on the way in, so application code stays untouched.
 */
const BRIDGE_COOKIE = '__session';

function readBundle(header: string | undefined): Map<string, string> {
  const bundle = new Map<string, string>();
  if (!header) return bundle;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== BRIDGE_COOKIE) continue;
    try {
      const parsed = JSON.parse(Buffer.from(part.slice(idx + 1).trim(), 'base64url').toString('utf8'));
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') bundle.set(k, v);
      }
    } catch {
      // Malformed bundle: treat as empty.
    }
  }
  return bundle;
}

export function previewCookieBridge() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const bundle = readBundle(req.headers.cookie);
    req.headers.cookie = [...bundle].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');

    const originalCookie = res.cookie.bind(res) as (name: string, value: string, options?: object) => Response;
    const originalClear = res.clearCookie.bind(res) as (name: string, options?: object) => Response;
    let longestMaxAge = 0;

    const flush = (options: Record<string, unknown>): Response => {
      if (bundle.size === 0) {
        return originalClear(BRIDGE_COOKIE, { path: '/' });
      }
      const payload = Buffer.from(JSON.stringify(Object.fromEntries(bundle)), 'utf8').toString('base64url');
      return originalCookie(BRIDGE_COOKIE, payload, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        ...(longestMaxAge > 0 ? { maxAge: longestMaxAge } : {}),
        ...options,
      });
    };

    res.cookie = ((name: string, value: unknown, options: Record<string, unknown> = {}) => {
      bundle.set(name, String(value));
      if (typeof options.maxAge === 'number') {
        longestMaxAge = Math.max(longestMaxAge, options.maxAge);
      }
      return flush({});
    }) as Response['cookie'];

    res.clearCookie = ((name: string) => {
      bundle.delete(name);
      return flush({});
    }) as Response['clearCookie'];

    next();
  };
}
