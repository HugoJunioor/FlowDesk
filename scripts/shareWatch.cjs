/**
 * Watcher para modo "share" (producao + acesso remoto):
 *  - Executa syncSlack a cada 5 minutos
 *  - Quando src/data/realDemands.ts muda, dispara "npm run build"
 *  - O preview server (rodando em paralelo) serve os arquivos novos no refresh
 *
 * Uso: via npm run share
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const SYNC_SCRIPT = path.join(__dirname, 'syncSlack.cjs');
const DATA_FILE = path.join(__dirname, '..', 'src', 'data', 'realDemands.ts');
const ROOT = path.join(__dirname, '..');

function fmt() {
  return new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function fileHash(filepath) {
  try {
    const stat = fs.statSync(filepath);
    return `${stat.size}-${stat.mtimeMs}`;
  } catch {
    return null;
  }
}

let lastDataHash = fileHash(DATA_FILE);
let building = false;

function runBuild() {
  if (building) {
    console.log(`[${fmt()}] [build] Ja esta buildando, aguardando...`);
    return;
  }
  building = true;
  console.log(`[${fmt()}] [build] Reconstruindo bundle de producao...`);
  const child = spawn('npm', ['run', 'build'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: true,
  });
  child.on('exit', (code) => {
    building = false;
    if (code === 0) {
      console.log(`[${fmt()}] [build] Bundle atualizado. Peca pro usuario dar F5 no navegador.`);
    } else {
      console.log(`[${fmt()}] [build] Falha no build (code ${code}).`);
    }
  });
}

function runSync() {
  console.log(`\n[${fmt()}] [sync] Buscando demandas do Slack...`);
  const child = spawn('node', [SYNC_SCRIPT], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[${fmt()}] [sync] Falhou (code ${code}).`);
      return;
    }
    const newHash = fileHash(DATA_FILE);
    if (newHash && newHash !== lastDataHash) {
      console.log(`[${fmt()}] [sync] Demandas atualizadas. Re-buildando...`);
      lastDataHash = newHash;
      runBuild();
    } else {
      console.log(`[${fmt()}] [sync] Nenhuma mudanca detectada.`);
    }
  });
}

// Primeira execucao
runSync();

// Loop
setInterval(runSync, INTERVAL_MS);

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`  FlowDesk — Share Watcher`);
console.log(`  Sync do Slack + rebuild automatico a cada 5 minutos`);
console.log(`  Ctrl+C para interromper`);
console.log(`═══════════════════════════════════════════════════\n`);
