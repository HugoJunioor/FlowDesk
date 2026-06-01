/**
 * Helpers para construção de queries SQL parametrizadas seguras.
 *
 * Sem ORM — usamos pg puro pra performance e controle. Estes helpers
 * eliminam o boilerplate de montar INSERT/UPDATE com $1, $2... mantendo
 * a parametrização correta (anti SQL injection).
 *
 * Convencao: nomes de colunas em snake_case, conversão de input keys
 * é responsabilidade do caller (use snake_case ao chamar).
 */

export interface BuildResult {
  sql: string;
  values: unknown[];
}

/**
 * Constrói INSERT a partir de um objeto.
 * Ex: buildInsert('tb_usuario', { nome: 'Operador', email: 'h@x' })
 *   → INSERT INTO tb_usuario (nome, email) VALUES ($1, $2)
 */
export function buildInsert(table: string, data: Record<string, unknown>, returning?: string[]): BuildResult {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (keys.length === 0) throw new Error(`buildInsert: dados vazios pra ${table}`);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const cols = keys.join(', ');
  const ret = returning && returning.length > 0 ? ` RETURNING ${returning.join(', ')}` : '';
  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})${ret}`,
    values: keys.map((k) => data[k]),
  };
}

/**
 * Constrói UPDATE a partir de objeto de updates e condição WHERE.
 * Ex: buildUpdate('tb_usuario', { nome: 'Operador' }, { id: 'uuid' })
 *   → UPDATE tb_usuario SET nome = $1 WHERE id = $2
 */
export function buildUpdate(
  table: string,
  updates: Record<string, unknown>,
  where: Record<string, unknown>,
  returning?: string[],
): BuildResult {
  const updateKeys = Object.keys(updates).filter((k) => updates[k] !== undefined);
  const whereKeys = Object.keys(where).filter((k) => where[k] !== undefined);
  if (updateKeys.length === 0) throw new Error(`buildUpdate: nada pra atualizar em ${table}`);
  if (whereKeys.length === 0) throw new Error(`buildUpdate: WHERE vazio em ${table} (perigoso)`);

  const setParts = updateKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const offset = updateKeys.length;
  const whereParts = whereKeys.map((k, i) => `${k} = $${i + 1 + offset}`).join(' AND ');
  const ret = returning && returning.length > 0 ? ` RETURNING ${returning.join(', ')}` : '';

  return {
    sql: `UPDATE ${table} SET ${setParts} WHERE ${whereParts}${ret}`,
    values: [...updateKeys.map((k) => updates[k]), ...whereKeys.map((k) => where[k])],
  };
}

/**
 * Sanitiza string de busca pra uso em ILIKE — escapa caracteres
 * especiais (%, _) e adiciona % no início/fim.
 */
export function sanitizeSearch(input: string): string {
  return `%${input.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Helper pra construir cláusula de paginação consistente.
 */
export function paginate(page: number, perPage: number): { limit: number; offset: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(100, Math.max(1, Math.floor(perPage)));
  return {
    limit: safePerPage,
    offset: (safePage - 1) * safePerPage,
  };
}
