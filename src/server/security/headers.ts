import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { ValidatedServerEnv } from '../config/env.ts';

export function buildSecurityCsp(nonce: string, appEnv: ValidatedServerEnv): string {
  const frameAncestor = appEnv.enforceFrameDeny ? ["frame-ancestors 'none'"] : [];
  const connectSources = [
    "'self'",
    'https://*.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
  ];
  if (!appEnv.isProduction) {
    connectSources.push('ws:', 'wss:');
  }

  const scriptSrc = appEnv.isProduction
    ? `script-src 'self' 'nonce-${nonce}'`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    ...frameAncestor,
  ].join('; ');
}

export function applySecurityHeadersMiddleware(appEnv: ValidatedServerEnv) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    res.setHeader('Content-Security-Policy', buildSecurityCsp(nonce, appEnv));
    if (appEnv.enforceFrameDeny) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()',
    );
    if (appEnv.isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

export function injectNonceIntoHtml(html: string, nonce: string): string {
  if (!nonce) return html;
  return html.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
}
