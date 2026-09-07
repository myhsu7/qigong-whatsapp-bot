import moment from 'moment-timezone';
import { db } from '../db';
import { getPracticeMethodRows } from './taxonomy';
import { Locale } from '../i18n';
import { UserInputError } from '../errors';

const TIMEZONE = 'Asia/Taipei';
export const MAX_NOTE_LENGTH = 1000;

const getUserTimezone = async (waId: string) => {
    const { rows } = await db.query('SELECT reminder_timezone FROM whatsapp_users WHERE wa_id = $1', [waId]);
    return rows[0]?.reminder_timezone || TIMEZONE;
};

export const getToday = (timezone = TIMEZONE) => moment().tz(timezone).format('YYYY-MM-DD');

export const upsertWhatsAppUser = async (waId: string, profileName?: string, inboundTimestamp?: number) => {
    await db.query(
        `INSERT INTO whatsapp_users (wa_id, profile_name, last_inbound_at)
         VALUES ($1, $2, CASE WHEN $3::double precision IS NULL THEN NULL ELSE LEAST(to_timestamp($3), CURRENT_TIMESTAMP) END)
         ON CONFLICT (wa_id) DO UPDATE SET
              profile_name = COALESCE(EXCLUDED.profile_name, whatsapp_users.profile_name),
              last_inbound_at = CASE WHEN EXCLUDED.last_inbound_at IS NULL THEN whatsapp_users.last_inbound_at
                  ELSE GREATEST(COALESCE(whatsapp_users.last_inbound_at, EXCLUDED.last_inbound_at), EXCLUDED.last_inbound_at) END,
              updated_at = CURRENT_TIMESTAMP`,
        [waId, profileName || null, inboundTimestamp || null]
    );
};

export const getTodayCheckin = async (waId: string) => {
    const timezone = await getUserTimezone(waId);
    const date = getToday(timezone);
    const { rows } = await db.query(
        `SELECT id, practice_note, reflection_note, body_feeling_note
         FROM whatsapp_checkin_logs WHERE wa_id = $1 AND checkin_date = $2`,
        [waId, date]
    );
    if (!rows.length) {
        return { date, alreadyCheckedIn: false, checkinLogId: null, selectedMethodIds: [], practiceNote: '', reflectionNote: '', bodyFeelingNote: '' };
    }
    const selected = await db.query(
        `SELECT practice_method_id FROM whatsapp_checkin_method_selections
         WHERE checkin_log_id = $1 ORDER BY practice_method_id`,
        [rows[0].id]
    );
    const practiceNote = rows[0].practice_note || mergeLegacyPracticeNotes(rows[0].reflection_note, rows[0].body_feeling_note);
    return {
        date,
        alreadyCheckedIn: true,
        checkinLogId: Number(rows[0].id),
        selectedMethodIds: selected.rows.map((row) => row.practice_method_id),
        practiceNote,
        reflectionNote: rows[0].reflection_note || '',
        bodyFeelingNote: rows[0].body_feeling_note || ''
    };
};

const localizeMethodName = (row: { name_zh: string; name_zh_cn: string; name_en: string | null }, locale: Locale) => {
    if (locale === 'en') return row.name_en || row.name_zh;
    if (locale === 'zh_CN') return row.name_zh_cn;
    return row.name_zh;
};

const noteLabels = {
    zh_TW: { methods: '功法', practiceNote: '心得與感受', separator: '、' },
    zh_CN: { methods: '功法', practiceNote: '心得与感受', separator: '、' },
    en: { methods: 'Methods', practiceNote: 'Reflection and body sensations', separator: ', ' }
} as const;

export const mergeLegacyPracticeNotes = (reflectionNote = '', bodyFeelingNote = '') => {
    const reflection = reflectionNote.trim();
    const bodyFeeling = bodyFeelingNote.trim();
    if (reflection && bodyFeeling) return `${reflection}\n${bodyFeeling}`;
    return reflection || bodyFeeling;
};

export const splitLegacyPracticeNote = (practiceNote = ''): [string, string] => {
    if (practiceNote.length <= 1000) return [practiceNote, ''];
    const separator = practiceNote.indexOf('\n');
    if (separator <= 1000 && practiceNote.length - separator - 1 <= 1000) {
        return [practiceNote.slice(0, separator), practiceNote.slice(separator + 1)];
    }
    return [practiceNote.slice(0, 1000), practiceNote.slice(1000, 2000)];
};

export const isAllowedPracticeNote = (practiceNote: string) => {
    if (practiceNote.length <= MAX_NOTE_LENGTH) return true;
    const [reflectionNote, bodyFeelingNote] = splitLegacyPracticeNote(practiceNote);
    return mergeLegacyPracticeNotes(reflectionNote, bodyFeelingNote) === practiceNote;
};

export const saveTodayCheckin = async (
    waId: string,
    methodIds: number[],
    practiceNote: string,
    locale: Locale = 'zh_TW'
) => {
    const uniqueMethodIds = [...new Set(methodIds)];
    if (!uniqueMethodIds.length) throw new UserInputError('select_method');
    const normalizedPracticeNote = practiceNote.trim();
    const [legacyReflectionNote, legacyBodyFeelingNote] = splitLegacyPracticeNote(normalizedPracticeNote);
    if (!isAllowedPracticeNote(normalizedPracticeNote)) {
        throw new UserInputError('max_length');
    }

    const timezone = await getUserTimezone(waId);
    const date = getToday(timezone);
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${waId}:${date}`]);
        const methods = await client.query(
            `SELECT id, code, name_zh, name_zh_cn, name_en FROM practice_methods
             WHERE id = ANY($1::int[]) AND is_active = TRUE AND method_type = 'leaf'
             ORDER BY sort_order, id`,
            [uniqueMethodIds]
        );
        if (methods.rowCount !== uniqueMethodIds.length) throw new UserInputError('invalid_method');

        const existing = await client.query(
            'SELECT id FROM whatsapp_checkin_logs WHERE wa_id = $1 AND checkin_date = $2 FOR UPDATE',
            [waId, date]
        );
        const alreadyCheckedIn = Boolean(existing.rowCount);
        const names = methods.rows.map((row) => localizeMethodName(row, locale));
        const labels = noteLabels[locale];
        const note = [
            `${labels.methods}: ${names.join(labels.separator)}`,
            normalizedPracticeNote ? `${labels.practiceNote}: ${normalizedPracticeNote}` : ''
        ].filter(Boolean).join('；');

        let checkinLogId: string;
        if (alreadyCheckedIn) {
            checkinLogId = existing.rows[0].id;
            await client.query(
                `UPDATE whatsapp_checkin_logs SET practice_note = $1, reflection_note = $2, body_feeling_note = $3,
                 note = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
                [normalizedPracticeNote || null, legacyReflectionNote || null, legacyBodyFeelingNote || null, note, checkinLogId]
            );
            await client.query('DELETE FROM whatsapp_checkin_method_selections WHERE checkin_log_id = $1', [checkinLogId]);
        } else {
            const inserted = await client.query(
                `INSERT INTO whatsapp_checkin_logs (wa_id, checkin_date, practice_note, reflection_note, body_feeling_note, note, checkin_timezone, checkin_timezone_inferred)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE) RETURNING id`,
                [waId, date, normalizedPracticeNote || null, legacyReflectionNote || null, legacyBodyFeelingNote || null, note, timezone]
            );
            checkinLogId = inserted.rows[0].id;
        }
        for (const methodId of uniqueMethodIds) {
            await client.query(
                'INSERT INTO whatsapp_checkin_method_selections (checkin_log_id, practice_method_id) VALUES ($1, $2)',
                [checkinLogId, methodId]
            );
        }
        await client.query('COMMIT');
        return { date, checkinLogId: Number(checkinLogId), alreadyCheckedIn, selectedMethods: names };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const listRecentCheckins = async (waId: string, locale: Locale = 'zh_TW', limit = 30) => {
    const methodNameColumn = locale === 'en' ? 'COALESCE(m.name_en, m.name_zh)' : locale === 'zh_CN' ? 'm.name_zh_cn' : 'm.name_zh';
    const { rows } = await db.query(
        `SELECT l.checkin_date::text, l.practice_note,
                COALESCE(string_agg(${methodNameColumn}, $3 ORDER BY m.sort_order), '') AS methods
         FROM whatsapp_checkin_logs l
         LEFT JOIN whatsapp_checkin_method_selections s ON s.checkin_log_id = l.id
         LEFT JOIN practice_methods m ON m.id = s.practice_method_id
         WHERE l.wa_id = $1
         GROUP BY l.id ORDER BY l.checkin_date DESC LIMIT $2`,
        [waId, limit, locale === 'en' ? ', ' : '、']
    );
    return rows.map((row) => ({
        date: row.checkin_date,
        methods: row.methods,
        practiceNote: row.practice_note || '',
        reflectionNote: row.practice_note || '',
        bodyFeelingNote: ''
    }));
};
