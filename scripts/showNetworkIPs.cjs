/**
 * Exibe os IPs de rede disponiveis para acesso remoto (VPN, LAN).
 * Uso: node scripts/showNetworkIPs.cjs
 *
 * Correlaciona IPs com descricoes de adaptador (ipconfig/ifconfig) para
 * detectar VPNs mesmo quando o Windows nomeia o adapter como "Ethernet 2".
 */
const os = require('os');
const { execSync } = require('child_process');

const port = 8080;

// Mapa de IPv4 -> descricao, parseado do ipconfig
function getIpDescriptions() {
  if (process.platform !== 'win32') return {};

  try {
    const output = execSync('ipconfig /all', { encoding: 'utf-8' });
    const blocks = output.split(/\r?\n\s*\r?\n/);
    const map = {};

    for (const block of blocks) {
      // Linha comecando com "Descri" (PT-BR, encoding variavel) ou "Description" (EN)
      // Exemplos que devem casar:
      //   "Descricao . . . : TAP-Windows..."
      //   "Descri��o . . . : TAP-Windows..." (encoding quebrado)
      //   "Descrição . . . : TAP-Windows..."
      //   "Description . . . : TAP-Windows..."
      const descMatch = block.match(/Descri[^:\r\n]*:\s*([^\r\n]+)/i) ||
                        block.match(/Description[^:\r\n]*:\s*([^\r\n]+)/i);
      if (!descMatch) continue;
      const description = descMatch[1].trim();

      // Procura TODOS os IPv4 nesse bloco.
      // A palavra "IPv4" sempre aparece, entao basta procura-la + ":" + IP.
      const ipMatches = block.matchAll(/IPv4[^:\r\n]*:\s*(\d+\.\d+\.\d+\.\d+)/gi);
      for (const m of ipMatches) {
        map[m[1]] = description;
      }
    }

    return map;
  } catch {
    return {};
  }
}

const ipDescriptions = getIpDescriptions();

// Padroes que indicam rede VPN (nome OU descricao)
const VPN_PATTERNS = [
  /\bvpn\b/i,
  /\btun\b/i,
  /\btap\b/i,
  /wireguard/i,
  /openvpn/i,
  /cisco\s*anyconnect/i,
  /fortinet|fortigate|forticlient/i,
  /pulse\s*secure/i,
  /zscaler/i,
  /globalprotect|global\s*protect/i,
  /\bppp\s*adapter\b/i,
];

function detectVpn(name, description) {
  const haystack = `${name} ${description || ''}`;
  return VPN_PATTERNS.some((re) => re.test(haystack));
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  FlowDesk — Enderecos de Acesso');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`  Local:    http://localhost:${port}`);
console.log('');

const interfaces = os.networkInterfaces();
const externals = [];
for (const [name, addrs] of Object.entries(interfaces)) {
  for (const addr of addrs || []) {
    if (addr.family === 'IPv4' && !addr.internal) {
      externals.push({
        name,
        address: addr.address,
        description: ipDescriptions[addr.address] || '',
      });
    }
  }
}

if (externals.length === 0) {
  console.log('  Nenhuma interface de rede externa encontrada.');
} else {
  console.log('  Acesso via rede (VPN/LAN):\n');
  for (const { name, address, description } of externals) {
    const isVpn = detectVpn(name, description);
    const label = isVpn ? ' ← VPN' : '';
    console.log(`    http://${address}:${port}   [${name}]${label}`);
    if (description) {
      console.log(`        ${description}`);
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Compartilhe o IP marcado com "← VPN" com seu amigo.');
console.log('  Firewall na porta', port, 'precisa estar liberado.');
console.log('═══════════════════════════════════════════════════════════\n');
