/**
 * Create tables and indexes. Safe to run on every start.
 * @param {Pick<import('@libsql/client').Client, 'execute' | 'batch'>} client
 */
export async function migrate(client) {
  await client.batch(
    [
      'CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, ip_hash TEXT, created_at INTEGER)',
      `CREATE TABLE IF NOT EXISTS ratings (
        puja_id TEXT NOT NULL, subject TEXT NOT NULL, stars INTEGER NOT NULL, ip_hash TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, nickname TEXT,
        PRIMARY KEY (puja_id, subject))`,
      `CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, puja_id TEXT, level INTEGER,
        wait_min INTEGER, lat REAL, lng REAL, closure_type TEXT, note TEXT, subject TEXT NOT NULL,
        near INTEGER NOT NULL DEFAULT 0, ip_hash TEXT, created_at INTEGER NOT NULL, nickname TEXT)`,
      'CREATE INDEX IF NOT EXISTS reports_kind_time ON reports(kind, created_at)',
      `CREATE TABLE IF NOT EXISTS closure_votes (
        report_id INTEGER NOT NULL, subject TEXT NOT NULL, vote TEXT NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY (report_id, subject))`,
    ],
    'write',
  );
  // Databases created by earlier builds may lack the nickname columns.
  for (const table of ['ratings', 'reports']) {
    const columns = (await client.execute(`PRAGMA table_info(${table})`)).rows;
    if (!columns.some((column) => column.name === 'nickname')) {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN nickname TEXT`);
    }
  }
}
