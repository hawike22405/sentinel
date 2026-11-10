// Local development keeps SQLite; Vercel uses a persistent hosted libSQL database.
// Never silently put production records in a temporary serverless filesystem.
if (process.env.VERCEL && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  throw new Error('Vercel requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Connect a hosted Turso/libSQL database before deployment.');
}
const store = await import(process.env.TURSO_DATABASE_URL ? './store-libsql.js' : './store-sqlite.js');
export const { storageUrl, createScan, getScanById, createReport, deleteReport,
  listReports, countReportsForHost, pruneStore, closeStore } = store;
