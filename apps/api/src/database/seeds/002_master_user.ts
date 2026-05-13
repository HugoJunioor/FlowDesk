/**
 * Seed: cria o usuário master inicial (apenas se nenhum master existir).
 *
 * Senha: usa MASTER_BOOTSTRAP_PASSWORD se definido, senão gera 16 chars
 * aleatórios e printa no console (operador anota e troca no 1o login).
 *
 * isFirstAccess=true força troca no primeiro login.
 */
import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

function generateRandomPassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export async function seed(knex: Knex): Promise<void> {
  const existing = await knex('tb_usuario').where({ perfil: 'master' }).first();
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`  - usuário master já existe (login=${existing.login})`);
    return;
  }

  const envPwd = process.env.MASTER_BOOTSTRAP_PASSWORD;
  const password = envPwd && envPwd.length >= 8 ? envPwd : generateRandomPassword(16);
  const passwordHash = await bcrypt.hash(password, 12);

  const [row] = await knex('tb_usuario')
    .insert({
      login: 'master',
      email: 'admin@flowdesk.local',
      nome: 'Administrador',
      perfil: 'master',
      status: 'active',
      senha_hash: passwordHash,
      primeiro_acesso: true,
      criado_por: 'seed',
    })
    .returning(['id', 'login']);

  /* eslint-disable no-console */
  console.log('  +-------------------------------------------+');
  console.log(`  | MASTER USER CRIADO`);
  console.log(`  | Login: ${(row as { login: string }).login}`);
  console.log(`  | Senha: ${password}`);
  console.log('  | ANOTE — vai pedir troca no primeiro login.');
  console.log('  +-------------------------------------------+');
}
