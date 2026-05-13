/**
 * Config do lint-staged no monorepo.
 *
 * Cada workspace tem seu próprio eslint.config (apps/web/eslint.config.js
 * e apps/api/eslint.config.mjs). lint-staged roda do root, então
 * precisamos apontar pro config certo via --config.
 *
 * Como cada workspace tem sua propria versao do eslint instalada
 * (npm workspaces hoista no root node_modules), invocar `eslint`
 * funciona — mas sem --config ele falha porque a busca de flat config
 * começa em process.cwd() (= root, que não tem config).
 *
 * Usar function-form do lint-staged pra construir comando final com os
 * paths absolutos que vem do hook.
 */
import path from 'node:path';

const ESLINT_BASE = 'eslint --fix --max-warnings=999';

/** Pega só os arquivos que estão dentro de uma pasta */
const filesIn = (dir, files) =>
  files.filter((f) => f.replaceAll('\\', '/').includes(`/${dir}/`));

export default {
  'apps/web/**/*.{ts,tsx,js,jsx,cjs,mjs}': (files) => {
    const matching = filesIn('apps/web', files);
    if (matching.length === 0) return [];
    return [
      `${ESLINT_BASE} --config ${path.posix.join('apps', 'web', 'eslint.config.js')} ${matching
        .map((f) => `"${f}"`)
        .join(' ')}`,
    ];
  },
  'apps/api/**/*.ts': (files) => {
    const matching = filesIn('apps/api', files);
    if (matching.length === 0) return [];
    return [
      `${ESLINT_BASE} --config ${path.posix.join('apps', 'api', 'eslint.config.mjs')} ${matching
        .map((f) => `"${f}"`)
        .join(' ')}`,
    ];
  },
};
