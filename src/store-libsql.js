import { createClient } from '@libsql/client/web';
import { createLibsqlStore } from './libsql-store.js';
const url = process.env.TURSO_DATABASE_URL;
if (!process.env.TURSO_AUTH_TOKEN || !/^(libsql|https):\/\//.test(url || '')) {
  throw new Error('Hosted storage requires a TLS-protected TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
export const { storageUrl, createScan, getScanById, createReport, deleteReport,
  listReports, countReportsForHost, pruneStore, closeStore } = createLibsqlStore(client);
