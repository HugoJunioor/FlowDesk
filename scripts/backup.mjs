/**
 * scripts/backup.mjs
 *
 * Backup do FlowDesk:
 *   1. pg_dump do Postgres (lê DATABASE_URL do .env ou apps/api/.env)
 *   2. Zip de apps/web/data/ (estado local — tokens, overrides, etc.)
 *
 * Saída: backups/flowdesk-backup-YYYYMMDD-HHmmss.sql  (dump)
 *        backups/flowdesk-backup-YYYYMMDD-HHmmss.zip  (dados locais, se existir)
 *
 * Retém apenas os últimos 7 backups de cada tipo (apaga mais antigos).
 *
 * Uso: node scripts/backup.mjs
 */

import { execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  createWriteStream,
  createReadStream,
  readFileSync,
} from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

/** Lê DATABASE_URL do .env raiz ou apps/api/.env (primeiro encontrado). */
function readDatabaseUrl() {
  const candidates = [
    join(ROOT, '.env'),
    join(ROOT, 'apps', 'api', '.env'),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const content = readFileSync(f, 'utf-8');
    const match = content.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
    if (match) {
      const raw = match[1].trim().replace(/^["']|["']$/g, '');
      if (raw) {
        log(`DATABASE_URL lida de: ${f}`);
        return raw;
      }
    }
  }
  return process.env.DATABASE_URL ?? null;
}

/** Timestamp no formato YYYYMMDD-HHmmss para o nome do arquivo. */
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Mantém apenas os últimos `keep` arquivos que batem com o padrão.
 * Ordena por mtime crescente (mais antigo primeiro) e apaga o excedente.
 */
function pruneOldBackups(dir, pattern, keep = 7) {
  const files = readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);

  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const f of toDelete) {
    unlinkSync(join(dir, f.name));
    log(`Removido backup antigo: ${f.name}`);
  }
}

// ---------------------------------------------------------------------------
// Zipping: percorre um diretório e gera um .zip simples usando zlib
// (sem dependência externa — apenas deflate por arquivo com header ZIP manual)
// ---------------------------------------------------------------------------

/**
 * Cria um arquivo ZIP a partir de um diretório usando apenas APIs nativas.
 * Implementação do formato ZIP spec (PKZIP) de forma minimalista.
 */
async function zipDirectory(sourceDir, destZip) {
  // Coleta todos os arquivos recursivamente
  function collectFiles(dir, base = '') {
    const entries = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = base ? `${base}/${name}` : name;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        entries.push(...collectFiles(full, rel));
      } else {
        entries.push({ full, rel, size: stat.size });
      }
    }
    return entries;
  }

  const files = collectFiles(sourceDir);
  if (files.length === 0) {
    log('  Nenhum arquivo encontrado em apps/web/data/ — zip pulado.');
    return false;
  }

  // Escreve um ZIP usando buffers (formato PKZIP 2.0, método 8 = deflate)
  const { createDeflateRaw } = await import('node:zlib');
  const { promisify } = await import('node:util');
  const deflateRaw = promisify(createDeflateRaw().constructor
    ? (buf, cb) => {
        const chunks = [];
        const d = createDeflateRaw();
        d.on('data', (c) => chunks.push(c));
        d.on('end', () => cb(null, Buffer.concat(chunks)));
        d.on('error', cb);
        d.end(buf);
      }
    : null);

  // Helper simples: deflate síncrono via zlib
  function deflate(buf) {
    return new Promise((resolve, reject) => {
      const { createDeflateRaw: cdr } = require('node:zlib');
      const chunks = [];
      const d = cdr();
      d.on('data', (c) => chunks.push(c));
      d.on('end', () => resolve(Buffer.concat(chunks)));
      d.on('error', reject);
      d.end(buf);
    });
  }

  // Usamos import() para evitar require em ESM
  const zlibMod = await import('node:zlib');

  function deflateSync(buf) {
    return new Promise((res, rej) => {
      const chunks = [];
      const d = zlibMod.createDeflateRaw();
      d.on('data', (c) => chunks.push(c));
      d.on('end', () => res(Buffer.concat(chunks)));
      d.on('error', rej);
      d.end(buf);
    });
  }

  // CRC-32 table
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    return table;
  })();

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUInt16LE(n) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n);
    return b;
  }
  function writeUInt32LE(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n >>> 0);
    return b;
  }

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  const { readFile } = await import('node:fs/promises');
  const { createWriteStream: cws } = await import('node:fs');

  const parts = [];

  for (const file of files) {
    const nameBytes = Buffer.from(file.rel, 'utf-8');
    const fileData = await readFile(file.full);
    const crc = crc32(fileData);
    const compressed = await deflateSync(fileData);

    // Local file header
    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUInt16LE(20),                        // version needed
      writeUInt16LE(0),                         // general purpose bit flag
      writeUInt16LE(8),                         // compression method: deflate
      writeUInt16LE(0),                         // last mod time
      writeUInt16LE(0),                         // last mod date
      writeUInt32LE(crc),
      writeUInt32LE(compressed.length),
      writeUInt32LE(fileData.length),
      writeUInt16LE(nameBytes.length),
      writeUInt16LE(0),                         // extra field length
      nameBytes,
    ]);

    // Central directory header
    const centralHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUInt16LE(20),                        // version made by
      writeUInt16LE(20),                        // version needed
      writeUInt16LE(0),
      writeUInt16LE(8),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(crc),
      writeUInt32LE(compressed.length),
      writeUInt32LE(fileData.length),
      writeUInt16LE(nameBytes.length),
      writeUInt16LE(0),  // extra
      writeUInt16LE(0),  // comment
      writeUInt16LE(0),  // disk start
      writeUInt16LE(0),  // internal attr
      writeUInt32LE(0),  // external attr
      writeUInt32LE(offset),
      nameBytes,
    ]);

    parts.push(localHeader, compressed);
    centralHeaders.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirStart = offset;
  const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);

  // End of central directory record
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(files.length),
    writeUInt16LE(files.length),
    writeUInt32LE(centralDirSize),
    writeUInt32LE(centralDirStart),
    writeUInt16LE(0),
  ]);

  const all = [...parts, ...centralHeaders, eocd];
  const { writeFile } = await import('node:fs/promises');
  await writeFile(destZip, Buffer.concat(all));
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('=== FlowDesk Backup iniciado ===');

  const backupsDir = join(ROOT, 'backups');
  mkdirSync(backupsDir, { recursive: true });

  const ts = timestamp();
  const base = `flowdesk-backup-${ts}`;

  // ------------------------------------------------------------------
  // 1. pg_dump
  // ------------------------------------------------------------------
  const dbUrl = readDatabaseUrl();
  if (!dbUrl) {
    log('AVISO: DATABASE_URL não encontrada — dump do banco pulado.');
  } else {
    const sqlFile = join(backupsDir, `${base}.sql`);
    log(`Executando pg_dump...`);
    try {
      const result = spawnSync('pg_dump', ['--no-password', dbUrl, '-f', sqlFile], {
        encoding: 'utf-8',
        env: { ...process.env, PGPASSWORD: '' },
        timeout: 120_000,
      });
      if (result.status !== 0) {
        const errMsg = result.stderr || result.error?.message || 'erro desconhecido';
        log(`ERRO no pg_dump: ${errMsg}`);
      } else {
        const size = fileSize(sqlFile);
        log(`Dump criado: ${basename(sqlFile)} (${fmtBytes(size)})`);
        pruneOldBackups(backupsDir, /^flowdesk-backup-.*\.sql$/, 7);
      }
    } catch (err) {
      log(`ERRO ao executar pg_dump: ${err.message}`);
    }
  }

  // ------------------------------------------------------------------
  // 2. Zip de apps/web/data/
  // ------------------------------------------------------------------
  const webDataDir = join(ROOT, 'apps', 'web', 'data');
  if (!existsSync(webDataDir)) {
    log('apps/web/data/ não encontrado — zip pulado.');
  } else {
    const zipFile = join(backupsDir, `${base}.zip`);
    log(`Zipando apps/web/data/ ...`);
    try {
      const created = await zipDirectory(webDataDir, zipFile);
      if (created) {
        const size = fileSize(zipFile);
        log(`Zip criado: ${basename(zipFile)} (${fmtBytes(size)})`);
        pruneOldBackups(backupsDir, /^flowdesk-backup-.*\.zip$/, 7);
      }
    } catch (err) {
      log(`ERRO ao criar zip: ${err.message}`);
    }
  }

  log('=== Backup concluido ===');
}

main().catch((err) => {
  console.error('Erro fatal no backup:', err);
  process.exit(1);
});
