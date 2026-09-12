import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

/** RFC 6238 TOTP helpers. Server-only: never import from client code. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(bytes = 20) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return base32Encode(raw);
}

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid setup key.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hotp(secret: Uint8Array, counter: number) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey(
    "raw",
    secret as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1]! & 0x0f;
  const code =
    ((sig[offset]! & 0x7f) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Validate a 6-digit token with ±1 step (30s) clock-skew tolerance.
 * Returns the matched time step so callers can reject replayed codes.
 */
export async function verifyTotp(
  secretBase32: string,
  token: string,
  opts: { window?: number; afterStep?: number | null } = {},
): Promise<{ valid: boolean; step: number }> {
  const digits = token.replace(/\D/g, "");
  if (digits.length !== 6) return { valid: false, step: 0 };
  const secret = base32Decode(secretBase32);
  const current = Math.floor(Date.now() / 1000 / 30);
  const window = opts.window ?? 1;
  for (let drift = -window; drift <= window; drift++) {
    const step = current + drift;
    if (opts.afterStep != null && step <= opts.afterStep) continue;
    // eslint-disable-next-line no-await-in-loop
    if ((await hotp(secret, step)) === digits) return { valid: true, step };
  }
  return { valid: false, step: 0 };
}

export function buildOtpAuthUri(params: { secret: string; account: string; issuer: string }) {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** 12-word BIP-39 recovery phrase used as the 2FA backup. */
export function generateRecoveryPhrase() {
  return generateMnemonic(wordlist, 128);
}

export function normalizeRecoveryPhrase(phrase: string) {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function hashRecoveryPhrase(userId: string, phrase: string) {
  const bytes = new TextEncoder().encode(
    `vt-recovery-phrase:${userId}:${normalizeRecoveryPhrase(phrase)}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
