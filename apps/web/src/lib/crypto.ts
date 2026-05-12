import { sha256 } from "js-sha256";

/**
 * Modulo central de criptografia.
 *
 * Hash de senha usa PBKDF2 com 150.000 iteracoes + salt aleatorio (16 bytes).
 * Formato armazenado: "pbkdf2$<iters>$<saltHex>$<hashHex>"
 *
 * Compativel com hashes legados SHA-256 hex (formato sem prefixo). Quando
 * uma senha legada e validada com sucesso, o caller deve re-hashear com
 * hashPassword() e atualizar o registro do usuario, fazendo a migracao
 * transparente.
 */

const PBKDF2_ITERS = 150_000;
const PBKDF2_HASH_LEN = 32; // 256 bits
const SALT_LEN = 16;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function getRandomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback (apenas em SSR ou ambientes muito antigos — NUNCA usar em prod)
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: iters, hash: "SHA-256" },
        baseKey,
        PBKDF2_HASH_LEN * 8
      );
      return new Uint8Array(bits);
    } catch {
      /* fall through */
    }
  }
  // Fallback puro JS (HMAC-SHA-256 manual via js-sha256)
  return pbkdf2Fallback(password, salt, iters);
}

/** PBKDF2 fallback usando js-sha256 (lento mas correto). */
function pbkdf2Fallback(password: string, salt: Uint8Array, iters: number): Uint8Array {
  const enc = new TextEncoder();
  const pwdBytes = enc.encode(password);
  const result = new Uint8Array(PBKDF2_HASH_LEN);
  const blockSize = 32; // SHA-256 output
  const blocks = Math.ceil(PBKDF2_HASH_LEN / blockSize);
  for (let block = 1; block <= blocks; block++) {
    const blockBytes = new Uint8Array(salt.length + 4);
    blockBytes.set(salt, 0);
    blockBytes[salt.length + 0] = (block >>> 24) & 0xff;
    blockBytes[salt.length + 1] = (block >>> 16) & 0xff;
    blockBytes[salt.length + 2] = (block >>> 8) & 0xff;
    blockBytes[salt.length + 3] = block & 0xff;
    let u = hmacSha256(pwdBytes, blockBytes);
    const t = new Uint8Array(u);
    for (let i = 1; i < iters; i++) {
      u = hmacSha256(pwdBytes, u);
      for (let j = 0; j < blockSize; j++) t[j] ^= u[j];
    }
    const start = (block - 1) * blockSize;
    const len = Math.min(blockSize, PBKDF2_HASH_LEN - start);
    result.set(t.subarray(0, len), start);
  }
  return result;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k: Uint8Array;
  if (key.length > blockSize) {
    k = new Uint8Array(sha256.arrayBuffer(key));
  } else {
    k = new Uint8Array(blockSize);
    k.set(key);
  }
  const oKey = new Uint8Array(blockSize);
  const iKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = k[i] ^ 0x5c;
    iKey[i] = k[i] ^ 0x36;
  }
  const inner = new Uint8Array(iKey.length + message.length);
  inner.set(iKey);
  inner.set(message, iKey.length);
  const innerHash = new Uint8Array(sha256.arrayBuffer(inner));
  const outer = new Uint8Array(oKey.length + innerHash.length);
  outer.set(oKey);
  outer.set(innerHash, oKey.length);
  return new Uint8Array(sha256.arrayBuffer(outer));
}

/** Gera hash novo (PBKDF2). Use para criar/atualizar senhas. */
export async function hashPassword(password: string): Promise<string> {
  const salt = getRandomBytes(SALT_LEN);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

/**
 * Valida senha contra hash armazenado.
 * - Se hash comeca com "pbkdf2$", usa PBKDF2.
 * - Senao, assume legacy SHA-256 hex.
 * Retorna { valid, needsRehash } — caller deve regerar hash quando needsRehash=true.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (storedHash?.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return { valid: false, needsRehash: false };
    const iters = parseInt(parts[1], 10);
    const salt = hexToBytes(parts[2]);
    const expected = parts[3];
    const computed = bytesToHex(await pbkdf2(password, salt, iters));
    return { valid: timingSafeEqual(computed, expected), needsRehash: iters < PBKDF2_ITERS };
  }
  // Legacy SHA-256
  const sha = legacySha256Hex(password);
  if (timingSafeEqual(sha, storedHash || "")) {
    return { valid: true, needsRehash: true };
  }
  return { valid: false, needsRehash: false };
}

function legacySha256Hex(s: string): string {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    // crypto.subtle e async, nao da pra usar aqui sincrono.
    // Mantem fallback js-sha256 (mesmo output).
  }
  return sha256(s);
}

/** Comparacao constant-time pra evitar timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Gera UUID v4 (compativel com qualquer contexto). */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const bytes = getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
