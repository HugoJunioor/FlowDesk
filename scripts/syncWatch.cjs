/**
 * Watcher que executa syncSlack a cada 5 minutos.
 * Vite HMR detecta mudancas em src/data/realDemands.ts e recarrega o app.
 *
 * Uso: npm run sync:watch
 */
const { spawn } = require('child_process');
const path = require('path');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const SCRIPT = path.join(__dirname, 'syncSlack.cjs');

function fmt() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function runSync() {
  console.log(`\n[${fmt()}] Iniciando sync do Slack...`);
  const child = spawn('node', [SCRIPT], { stdio: 'inherit' });
  child.on('exit', (code) => {
    if (code === 0) {
      console.log(`[${fmt()}] Sync concluido. Proxima execucao em 5 minutos.`);
    } else {
      console.log(`[${fmt()}] Sync falhou (code ${code}). Tentando novamente em 5 minutos.`);
    }
  });
  child.on('error', (err) => {
    console.error(`[${fmt()}] Erro ao executar sync:`, err.message);
  });
}

// Executa imediatamente na inicializacao
runSync();

// Agenda execucoes subsequentes
setInterval(runSync, INTERVAL_MS);

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`  FlowDesk — Slack Sync Watcher`);
console.log(`  Intervalo: 5 minutos`);
console.log(`  Ctrl+C para interromper`);
console.log(`═══════════════════════════════════════════════════`);
