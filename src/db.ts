import { Pool } from 'pg';
import { env } from './config/env';

export const pool = new Pool({
    connectionString: env.databaseUrl || undefined,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 10000,
    statement_timeout: 10000
});

export const db = {
    query: (text: string, params?: unknown[]) => pool.query(text, params),
    getClient: () => pool.connect()
};
