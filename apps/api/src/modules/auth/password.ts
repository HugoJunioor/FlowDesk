/**
 * Verificação de senha com suporte aos dois formatos que existem em produção.
 *
 *   bcrypt   — "$2a$…" / "$2b$…". Formato atual, escrito pelo seed
 *              (seeds/002_master_user.ts) e por POST /api/v1/usuarios.
 *   pbkdf2   — "pbkdf2$<iters>$<saltHex>$<hashHex>". Formato do store legado
 *              fd_users_v2, gerado por apps/web/src/lib/crypto.ts.
 *
 * Por que isso importa: quando o login passou a ser resolvido pela API
 * (auth.service.ts consulta só tb_usuario), qualquer conta cujo hash veio do
 * store legado passou a falhar. bcrypt.compare() com um hash PBKDF2 devolve
 * false — nunca lança —, então o usuário recebia 401 com a senha correta e o
 * frontend mostrava "Usuário ou senha inválidos".
 *
 * A saída espelha apps/web/src/lib/crypto.ts:134 (verifyPassword): quem chama
 * recebe needsRehash e é responsável por regravar o hash no formato atual,
 * fazendo a migração acontecer de forma transparente no primeiro login.
 *
 * Os parâmetros PBKDF2 têm que bater exatamente com os do frontend:
 * 150.000 iterações, SHA-256, chave de 32 bytes, salt de 16 bytes, hex.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const BCRYPT_COST = 12;

const PBKDF2_PREFIX = 'pbkdf2$';
const PBKDF2_DIGEST = 'sha256';
const PBKDF2_KEY_LEN = 32;

export interface VerifyResult {
  valid: boolean;
  /** true quando a senha confere mas o hash está num formato antigo. */
  needsRehash: boolean;
}

function pbkdf2(password: string, salt: Buffer, iters: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iters, PBKDF2_KEY_LEN, PBKDF2_DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** Comparação em tempo constante. Tamanhos diferentes saem antes, sem vazar mais que isso. */
function constantTimeEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isHex(s: string): boolean {
  return s.length % 2 === 0 && /^[0-9a-f]*$/i.test(s);
}

/** Gera hash no formato atual (bcrypt). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Valida `password` contra `storedHash`, aceitando bcrypt e PBKDF2.
 *
 * Nunca lança por hash malformado — um registro corrompido vira
 * { valid: false }, não um 500 que o frontend mostraria como senha inválida.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<VerifyResult> {
  if (!storedHash) return { valid: false, needsRehash: false };

  if (storedHash.startsWith(PBKDF2_PREFIX)) {
    // pbkdf2$<iters>$<salt>$<hash>
    const parts = storedHash.split('$');
    const [, itersRaw, saltHex, expectedHex] = parts;
    if (parts.length !== 4 || itersRaw === undefined || saltHex === undefined || expectedHex === undefined) {
      return { valid: false, needsRehash: false };
    }

    const iters = Number.parseInt(itersRaw, 10);
    if (!Number.isInteger(iters) || iters <= 0) return { valid: false, needsRehash: false };
    if (!isHex(saltHex) || !isHex(expectedHex)) return { valid: false, needsRehash: false };

    try {
      const derived = await pbkdf2(password, Buffer.from(saltHex, 'hex'), iters);
      const valid = constantTimeEquals(derived, Buffer.from(expectedHex, 'hex'));
      // Confere, mas está no formato antigo — quem chama deve regravar.
      return { valid, needsRehash: valid };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  try {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: false };
  } catch {
    return { valid: false, needsRehash: false };
  }
}
