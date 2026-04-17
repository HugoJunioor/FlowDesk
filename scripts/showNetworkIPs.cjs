/**
 * Exibe os IPs de rede disponiveis para acesso remoto (VPN, LAN).
 * Uso: node scripts/showNetworkIPs.cjs
 */
const os = require('os');

const interfaces = os.networkInterfaces();
const port = 8080;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FlowDesk — Enderecos de Acesso');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`  Local:    http://localhost:${port}`);
console.log('');

const externals = [];
for (const [name, addrs] of Object.entries(interfaces)) {
  for (const addr of addrs || []) {
    if (addr.family === 'IPv4' && !addr.internal) {
      externals.push({ name, address: addr.address });
    }
  }
}

if (externals.length === 0) {
  console.log('  Nenhuma interface de rede externa encontrada.');
} else {
  console.log('  Acesso via rede (VPN/LAN):\n');
  for (const { name, address } of externals) {
    const label = /vpn|tun|wg|tap/i.test(name) ? ' ← VPN' : '';
    console.log(`    http://${address}:${port}   [${name}]${label}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Compartilhe o IP da VPN com seu amigo conectado na rede.');
console.log('  Certifique-se que o firewall permite conexoes na porta', port);
console.log('═══════════════════════════════════════════════════════════\n');
