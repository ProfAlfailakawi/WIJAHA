import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str: string): Buffer {
  const cleaned = str.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUri(params: {
  secret: string;
  accountEmail: string;
  issuer?: string;
}): string {
  const issuer = params.issuer || 'WIJAHA';
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.accountEmail)}`;
  return `otpauth://totp/${label}?secret=${encodeURIComponent(params.secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateTotpCode(secretBase32: string, timestampMs = Date.now(), stepOffset = 0): string {
  const key = base32Decode(secretBase32);
  const counter = BigInt(Math.floor(timestampMs / 30_000) + stepOffset);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % 1_000_000;
  return String(otp).padStart(6, '0');
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  timestampMs = Date.now(),
): boolean {
  const normalizedCode = String(code || '').trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const providedBuf = Buffer.from(normalizedCode, 'utf8');
  for (const offset of [-1, 0, 1]) {
    const candidate = generateTotpCode(secretBase32, timestampMs, offset);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      providedBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(providedBuf, candidateBuf)
    ) {
      return true;
    }
  }
  return false;
}
