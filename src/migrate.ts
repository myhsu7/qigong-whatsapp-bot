import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import { env } from './config/env';

const pool = new Pool({
    connectionString: env.databaseUrl || undefined,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

const run = async () => {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    const client = await pool.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);
        for (const filename of files) {
            const exists = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
            if (exists.rowCount) continue;
            const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
                await client.query('COMMIT');
                console.log(`[migrate] applied ${filename}`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
    } finally {
        client.release();
        await pool.end();
    }
};

run().catch((error) => {
    console.error('[migrate] failed', error);
    process.exitCode = 1;
});
