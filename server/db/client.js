/**
 * Open the database: hosted Turso/libSQL in production, a local file otherwise.
 * libSQL speaks SQLite, so the SQL is plain SQLite.
 *
 * The driver is loaded with a dynamic `import()` whose path is a string literal, so Vercel's
 * file tracer bundles exactly the build that is needed. The "web" build is HTTP-only, so it runs
 * on Vercel without a native add-on; the default build opens local files.
 *
 * @param {{ databaseUrl?: string, databaseToken?: string }} config
 * @param {string} localPath File used when no hosted URL is set
 */
export function openDatabase(config, localPath) {
  const url = config.databaseUrl || `file:${localPath}`;
  const isLocal = url.startsWith('file:');
  /** @type {Promise<import('@libsql/client').Client>} */
  const driver = (isLocal ? import('@libsql/client') : import('@libsql/client/web')).then(({ createClient }) =>
    createClient({ url, authToken: config.databaseToken }),
  );
  // Never an unhandled rejection at boot; every use awaits `driver` and sees the error.
  driver.catch(() => {});

  /** Same surface as the libSQL client for the calls this app makes, but usable before the driver has loaded. */
  const client = {
    execute: async (statement) => (await driver).execute(statement),
    batch: async (statements, mode) => (await driver).batch(statements, mode),
    close: () => driver.then((c) => c.close()),
  };

  /** Prepared-statement style helper: `query(sql).get(...args)`. */
  const query = (sql) => ({
    get: async (...args) => (await client.execute({ sql, args })).rows[0],
    all: async (...args) => [...(await client.execute({ sql, args })).rows],
    run: async (...args) => {
      const result = await client.execute({ sql, args });
      return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
    },
  });

  return { client, query, isLocal, close: client.close };
}
