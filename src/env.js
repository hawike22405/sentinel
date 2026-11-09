// Must be the first import in server.js: loads .env (if present) before any module reads process.env.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(file) && typeof process.loadEnvFile === 'function') process.loadEnvFile(file);
