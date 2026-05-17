/**
 * Script CLI: gera openapi.json no disco.
 *
 * Uso:
 *   npm run openapi:gen -w @flowdesk/api
 *
 * Util pra CI fazer diff de contrato: se openapi.json mudou sem PR
 * explicando a razão, é sinal de breaking change.
 */
import 'dotenv/config';

// tsconfig-paths resolve os aliases @modules, @shared etc.
// Registrado via tsx que já lê tsconfig.json.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { generateOpenApiDocument } from '../src/shared/openapi/generate';

const outputPath = resolve(__dirname, '../openapi.json');

// Garante que o diretório existe (normalmente é a raiz, mas por segurança)
mkdirSync(dirname(outputPath), { recursive: true });

const doc = generateOpenApiDocument();
writeFileSync(outputPath, JSON.stringify(doc, null, 2), 'utf-8');

console.log(`openapi.json gerado em: ${outputPath}`);
