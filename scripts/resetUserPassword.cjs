/**
 * Reseta a senha de um usuario, gerando nova temporaria.
 *
 * Uso: node scripts/resetUserPassword.cjs <login>
 * Exemplo: node scripts/resetUserPassword.cjs brunaqueiroz
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = path.join(__dirname, '..', 'data', 'shared-state.json');

function hashPassword(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const nums = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + nums + special;
  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    nums[Math.floor(Math.random() * nums.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 4; i < 10; i++) chars.push(all[Math.floor(Math.random() * all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function main() {
  const login = process.argv[2];
  if (!login) {
    console.error('Uso: node scripts/resetUserPassword.cjs <login>');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  const users = state.fd_users_v2 || [];
  const idx = users.findIndex((u) => u.login.toLowerCase() === login.toLowerCase());

  if (idx === -1) {
    console.error(`Usuario "${login}" nao encontrado.`);
    console.error('Logins disponiveis:', users.map((u) => u.login).join(', '));
    process.exit(1);
  }

  const tempPassword = generateTempPassword();
  users[idx].passwordHash = hashPassword(tempPassword);
  users[idx].isFirstAccess = true;
  users[idx].passwordResetRequested = false;
  users[idx].updatedAt = new Date().toISOString();

  state.fd_users_v2 = users;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Senha resetada com sucesso');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Usuario: ${users[idx].name}`);
  console.log(`  Login:   ${users[idx].login}`);
  console.log(`  Senha:   ${tempPassword}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('  No primeiro login, o sistema vai pedir para');
  console.log('  criar uma nova senha.');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

main();
