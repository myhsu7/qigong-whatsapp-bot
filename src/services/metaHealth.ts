import { env, missingMetaConfiguration } from '../config/env';

export interface MetaCredentialsHealth {
    ok: boolean;
    checkedAt: string;
    reason?: 'missing_configuration' | 'credentials_rejected' | 'resource_unavailable' | 'request_failed';
    errorCode?: number;
}

let cached: { expiresAt: number; result: MetaCredentialsHealth } | undefined;

export const checkMetaCredentials = async (force = false): Promise<MetaCredentialsHealth> => {
    if (!force && cached && cached.expiresAt > Date.now()) return cached.result;

    const checkedAt = new Date().toISOString();
    if (missingMetaConfiguration().length) {
        return { ok: false, checkedAt, reason: 'missing_configuration' };
    }

    let result: MetaCredentialsHealth;
    try {
        const response = await fetch(
            `https://graph.facebook.com/${env.metaGraphVersion}/${encodeURIComponent(env.metaPhoneNumberId)}?fields=id`,
            { headers: { Authorization: `Bearer ${env.metaAccessToken}` }, signal: AbortSignal.timeout(5000) }
        );
        const body = await response.json() as { id?: string; error?: { code?: number } };
        const errorCode = body.error?.code;
        if (response.ok && body.id === env.metaPhoneNumberId) {
            result = { ok: true, checkedAt };
        } else {
            result = {
                ok: false,
                checkedAt,
                reason: errorCode === 190 ? 'credentials_rejected' : 'resource_unavailable',
                ...(errorCode ? { errorCode } : {})
            };
        }
    } catch {
        result = { ok: false, checkedAt, reason: 'request_failed' };
    }

    cached = { result, expiresAt: Date.now() + (result.ok ? 5 * 60_000 : 60_000) };
    return result;
};
