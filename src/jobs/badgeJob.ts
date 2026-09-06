import cron from 'node-cron';
import { db } from '../db';
import { reconcileBadgesSince } from '../services/badges';

export const runBadgeReconciliation = async () => {
    const client = await db.getClient();
    let acquired = false;
    try {
        const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', ['whatsapp-badge-reconciliation']);
        acquired = Boolean(lock.rows[0]?.acquired);
        if (!acquired) return { users: 0, awarded: 0 };
        const clock = await client.query('SELECT CURRENT_TIMESTAMP AS started_at');
        const startedAt = clock.rows[0].started_at;
        const checkpoint = await client.query(
            'SELECT last_completed_at FROM whatsapp_job_state WHERE job_name = $1',
            ['badge-reconciliation']
        );
        const result = await reconcileBadgesSince(checkpoint.rows[0]?.last_completed_at || null);
        await client.query(
            `INSERT INTO whatsapp_job_state (job_name, last_completed_at) VALUES ($1, $2)
             ON CONFLICT (job_name) DO UPDATE SET last_completed_at = EXCLUDED.last_completed_at`,
            ['badge-reconciliation', startedAt]
        );
        return result;
    } finally {
        try {
            if (acquired) await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['whatsapp-badge-reconciliation']);
        } finally {
            client.release();
        }
    }
};

export const setupBadgeJob = () => {
    setImmediate(() => runBadgeReconciliation()
        .then(({ users, awarded }) => console.log(`[badges] reconciled ${users} users, awarded ${awarded}`))
        .catch((error) => console.error('[badges] startup reconciliation failed', error)));
    cron.schedule('10 0 * * *', () => runBadgeReconciliation()
        .then(({ users, awarded }) => console.log(`[badges] reconciled ${users} users, awarded ${awarded}`))
        .catch((error) => console.error('[badges] reconciliation failed', error)), { timezone: 'Asia/Taipei' });
};
