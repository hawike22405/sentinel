// Shared SQL semantics for a persistent hosted libSQL client; injectable for tests.
export function createLibsqlStore(client) {
  const storageUrl = input => new URL(input).origin + '/';
  const query = (sql, args = []) => client.execute({ sql, args });
  let ready;
  const ensureSchema = () => ready ||= client.batch([
    `CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, url TEXT NOT NULL, score INTEGER NOT NULL,
      verdict TEXT NOT NULL, created_at TEXT NOT NULL, details TEXT)`,
    `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, url TEXT NOT NULL, host TEXT NOT NULL,
      type TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL)`,
    'CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_host_type ON reports(host, type)',
  ], 'write').catch(err => { ready = undefined; throw err; });
  const pruneStatements = () => ['scans', 'reports'].flatMap(table => [
    { sql: `DELETE FROM ${table} WHERE julianday(created_at) < julianday(?)`, args: [new Date(Date.now() - 30 * 86400000).toISOString()] },
    { sql: `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 10000)`, args: [] },
  ]);
  // Serverless instances do not run dependable background timers. Prune on
  // requests/writes, and filter reads by age so expired data is never returned.
  let lastPrune = 0;
  async function pruneStore() {
    await ensureSchema();
    await client.batch(pruneStatements(), 'write');
    lastPrune = Date.now();
  }
  async function ensure() {
    await ensureSchema();
    if (Date.now() - lastPrune > 3600000) await pruneStore();
  }
  const cutoff = () => new Date(Date.now() - 30 * 86400000).toISOString();
  return {
    storageUrl, pruneStore,
    async createScan({ id, url, score, verdict, details }) {
      await ensureSchema();
      await client.batch([
        { sql: 'INSERT INTO scans (id,url,score,verdict,details,created_at) VALUES (?,?,?,?,?,?)', args: [id, storageUrl(url), score, verdict, JSON.stringify(details), new Date().toISOString()] },
        ...pruneStatements(),
      ], 'write');
      lastPrune = Date.now();
    },
    async getScanById(id) {
      await ensure();
      const { rows } = await query('SELECT * FROM scans WHERE id = ? AND julianday(created_at) >= julianday(?)', [id, cutoff()]);
      if (!rows.length) return null;
      const row = rows[0];
      const details = JSON.parse(row.details || '{}');
      return { id: row.id, url: row.url, score: row.score, verdict: row.verdict, created_at: row.created_at, ...details, details };
    },
    async createReport({ id, url, type, source }) {
      await ensureSchema();
      const results = await client.batch([
        { sql: 'DELETE FROM reports WHERE julianday(created_at) < julianday(?)', args: [cutoff()] },
        { sql: 'INSERT OR IGNORE INTO reports (id,url,host,type,source,created_at) VALUES (?,?,?,?,?,?)', args: [id, storageUrl(url), new URL(url).hostname, type, source, new Date().toISOString()] },
        ...pruneStatements(),
      ], 'write');
      lastPrune = Date.now();
      return results[1].rowsAffected > 0;
    },
    async deleteReport(id) { await ensureSchema(); return (await query('DELETE FROM reports WHERE id = ?', [id])).rowsAffected > 0; },
    async countReportsForHost(host) {
      await ensure();
      return Number((await query('SELECT COUNT(*) AS n FROM reports WHERE host = ? AND julianday(created_at) >= julianday(?)', [host, cutoff()])).rows[0].n);
    },
    async listReports(limit = 50) {
      await ensure();
      const { rows } = await query('SELECT * FROM reports WHERE julianday(created_at) >= julianday(?) ORDER BY created_at DESC LIMIT ?', [cutoff(), Math.min(50, Math.max(1, Number(limit) || 50))]);
      return rows.map(row => ({ ...row }));
    },
    closeStore() { client.close(); },
  };
}
