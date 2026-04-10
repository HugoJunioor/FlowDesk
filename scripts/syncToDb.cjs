/**
 * Lê o realDemands.ts gerado pelo syncSlack.cjs e persiste no PostgreSQL.
 * Uso: node scripts/syncToDb.cjs
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'justflow',
  user: 'postgres',
  password: 'Maker@1',
});

// Patterns de resolucao (mesmos do statusAnalyzer.ts)
const RESOLVED_PATTERNS = [
  /ajustad[oa]/i, /corrigid[oa]/i, /resolvid[oa]/i, /conclu[ií]d[oa]/i,
  /finalizado/i, /pronto/i, /feito/i, /realizado/i,
  /liberado/i, /publicado/i, /implantado/i, /deploy/i,
  /pode testar/i, /já pode/i, /ja pode/i,
  /atualizado/i, /alterado conforme/i,
  /solicitação atendida/i, /solicitacao atendida/i,
  /problema resolvido/i, /tudo certo/i,
  /encaminhad[oa]/i, /repassad[oa]/i, /direcionad[oa]/i,
];

const GRATITUDE_PATTERNS = [
  /obrigad[oa]/i, /valeu/i, /agradec/i, /perfeito/i,
  /excelente/i, /show/i, /top/i, /massa/i,
  /muito bom/i, /deu certo/i, /funcionou/i, /consegui/i,
];

function analyzeStatus(demand) {
  const replies = [...(demand.threadReplies || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const teamReplies = replies.filter(r => r.isTeamMember);
  if (teamReplies.length === 0) return null;

  // Caso 0: Ultimo check reaction de membro da equipe
  const checks = replies.filter(r => r.hasCheckReaction && r.isTeamMember);
  if (checks.length > 0) {
    const last = checks[checks.length - 1];
    return { status: 'concluida', completedAt: last.timestamp };
  }

  // Caso 1: Ultimo reply da equipe com padrao de resolucao
  for (let i = replies.length - 1; i >= 0; i--) {
    const r = replies[i];
    if (r.isTeamMember) {
      if (RESOLVED_PATTERNS.some(p => p.test(r.text))) {
        return { status: 'concluida', completedAt: r.timestamp };
      }
      // Em andamento se nao resolveu
      return { status: 'em_andamento', completedAt: null };
    }
    // Cliente agradeceu = concluida
    if (!r.isTeamMember && GRATITUDE_PATTERNS.some(p => p.test(r.text))) {
      const teamBefore = replies.slice(0, i).reverse().find(t => t.isTeamMember);
      if (teamBefore) {
        return { status: 'concluida', completedAt: teamBefore.timestamp };
      }
    }
  }
  return null;
}

function processDemands(demands) {
  return demands.map(d => {
    const analysis = analyzeStatus(d);
    if (analysis && analysis.status !== d.status) {
      return { ...d, status: analysis.status, completedAt: analysis.completedAt || d.completedAt };
    }
    return d;
  });
}

async function loadDemands() {
  const filePath = path.join(__dirname, '..', 'src', 'data', 'realDemands.ts');
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/export const mockDemands.*?=\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error('Nao foi possivel extrair demandas do arquivo');
  const rawDemands = JSON.parse(match[1]);
  return processDemands(rawDemands);
}

async function syncToDb() {
  const startTime = Date.now();
  const demands = await loadDemands();
  const client = await pool.connect();

  let newCount = 0;
  let updatedCount = 0;
  let channelsSet = new Set();
  let channelsError = 0;

  try {
    await client.query('BEGIN');

    for (const d of demands) {
      channelsSet.add(d.slackChannel);

      // Upsert demand
      const result = await client.query(`
        INSERT INTO demands (
          id, title, description, priority, status, demand_type, workflow, product,
          requester_name, assignee_name, cc, created_at, due_date, completed_at,
          has_task, task_link, tags, slack_channel, slack_permalink, replies, last_synced_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          demand_type = EXCLUDED.demand_type,
          workflow = EXCLUDED.workflow,
          product = EXCLUDED.product,
          requester_name = EXCLUDED.requester_name,
          assignee_name = EXCLUDED.assignee_name,
          cc = EXCLUDED.cc,
          due_date = EXCLUDED.due_date,
          completed_at = EXCLUDED.completed_at,
          has_task = EXCLUDED.has_task,
          task_link = EXCLUDED.task_link,
          tags = EXCLUDED.tags,
          replies = EXCLUDED.replies,
          last_synced_at = NOW()
        RETURNING (xmax = 0) AS is_new
      `, [
        d.id,
        d.title,
        d.description?.slice(0, 5000) || '',
        d.priority,
        d.status,
        d.demandType,
        d.workflow,
        d.product || '',
        d.requester?.name || 'Desconhecido',
        d.assignee?.name || null,
        d.cc || [],
        d.createdAt,
        d.dueDate || null,
        d.completedAt || null,
        d.hasTask || false,
        d.taskLink || '',
        d.tags || [],
        d.slackChannel,
        d.slackPermalink || '',
        d.replies || 0,
      ]);

      if (result.rows[0]?.is_new) newCount++;
      else updatedCount++;

      // Sync thread replies - delete old and insert fresh
      await client.query('DELETE FROM thread_replies WHERE demand_id = $1', [d.id]);

      if (d.threadReplies && d.threadReplies.length > 0) {
        const values = [];
        const params = [];
        let idx = 1;

        for (const r of d.threadReplies) {
          values.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5})`);
          params.push(
            d.id,
            r.author || '',
            r.text?.slice(0, 5000) || '',
            r.timestamp,
            r.isTeamMember || false,
            r.hasCheckReaction || false,
          );
          idx += 6;
        }

        await client.query(`
          INSERT INTO thread_replies (demand_id, author, text, timestamp, is_team_member, has_check_reaction)
          VALUES ${values.join(',')}
        `, params);
      }
    }

    // Log sync
    const duration = Date.now() - startTime;
    await client.query(`
      INSERT INTO sync_log (total_demands, new_demands, updated_demands, channels_synced, channels_error, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [demands.length, newCount, updatedCount, channelsSet.size, channelsError, duration]);

    await client.query('COMMIT');

    console.log(`\nPostgreSQL sincronizado!`);
    console.log(`  Total: ${demands.length} | Novas: ${newCount} | Atualizadas: ${updatedCount}`);
    console.log(`  Canais: ${channelsSet.size} | Tempo: ${duration}ms`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao sincronizar com PostgreSQL:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

syncToDb().catch(console.error);
