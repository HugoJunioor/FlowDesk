/**
 * Compatibilidade entre os dois formatos de hash que existem em produção.
 *
 * O vetor PBKDF2 abaixo não foi gerado por este módulo — foi derivado com os
 * mesmos parâmetros que apps/web/src/lib/crypto.ts usa (150.000 iterações,
 * SHA-256, chave de 32 bytes, salt de 16 bytes, hex). Se alguém mexer nos
 * parâmetros de um lado só, este teste quebra — que é o ponto: o store legado
 * fd_users_v2 está cheio de hashes nesse formato e a API precisa continuar
 * conseguindo validá-los.
 */
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from '../password';

const SENHA = 'SenhaDeTeste@123';
const SALT_HEX = '0123456789abcdef0123456789abcdef';
const ITERS = 150_000;

function pbkdf2Legacy(password: string, saltHex: string, iters: number): string {
  const key = crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iters, 32, 'sha256');
  return `pbkdf2$${iters}$${saltHex}$${key.toString('hex')}`;
}

describe('verifyPassword', () => {
  describe('formato bcrypt (atual)', () => {
    it('aceita a senha correta e não pede re-hash', async () => {
      const hash = await hashPassword(SENHA);
      expect(hash.startsWith('$2')).toBe(true);
      await expect(verifyPassword(SENHA, hash)).resolves.toEqual({
        valid: true,
        needsRehash: false,
      });
    });

    it('rejeita senha errada', async () => {
      const hash = await hashPassword(SENHA);
      const r = await verifyPassword('outra-senha', hash);
      expect(r.valid).toBe(false);
    });
  });

  describe('formato PBKDF2 (legado, fd_users_v2)', () => {
    const legacyHash = pbkdf2Legacy(SENHA, SALT_HEX, ITERS);

    it('valida a senha correta — era isto que bcrypt.compare rejeitava', async () => {
      await expect(verifyPassword(SENHA, legacyHash)).resolves.toEqual({
        valid: true,
        needsRehash: true,
      });
    });

    it('rejeita senha errada sem pedir re-hash', async () => {
      await expect(verifyPassword('nao-e-a-senha', legacyHash)).resolves.toEqual({
        valid: false,
        needsRehash: false,
      });
    });

    it('respeita a contagem de iterações gravada no hash', async () => {
      const outrasIters = pbkdf2Legacy(SENHA, SALT_HEX, 1000);
      await expect(verifyPassword(SENHA, outrasIters)).resolves.toEqual({
        valid: true,
        needsRehash: true,
      });
    });
  });

  describe('entradas malformadas não podem virar 500', () => {
    // Um 500 aqui apareceria pro usuário como "Usuário ou senha inválidos"
    // (AuthContext colapsa tudo), então falhar limpo importa.
    it.each([
      ['string vazia', ''],
      ['null', null],
      ['undefined', undefined],
      ['pbkdf2 sem campos', 'pbkdf2$150000$abc'],
      ['pbkdf2 com iters não numérico', 'pbkdf2$abc$00ff$00ff'],
      ['pbkdf2 com iters zero', 'pbkdf2$0$00ff$00ff'],
      ['pbkdf2 com salt não-hex', 'pbkdf2$150000$zzzz$00ff'],
      ['pbkdf2 com hash de tamanho ímpar', 'pbkdf2$150000$00ff$abc'],
      ['lixo', 'nao-e-hash-nenhum'],
    ])('%s → inválido, sem lançar', async (_nome, valor) => {
      await expect(
        verifyPassword(SENHA, valor as string | null | undefined),
      ).resolves.toEqual({ valid: false, needsRehash: false });
    });

    it('hash PBKDF2 de tamanho diferente não passa pela comparação', async () => {
      // timingSafeEqual lança se os buffers tiverem tamanhos diferentes —
      // precisa ser tratado antes de chegar nele.
      const curto = `pbkdf2$${ITERS}$${SALT_HEX}$00ff`;
      await expect(verifyPassword(SENHA, curto)).resolves.toEqual({
        valid: false,
        needsRehash: false,
      });
    });
  });
});
