import moment from 'moment-timezone';
import { db } from '../db';
import { getPracticeMethodRows } from './taxonomy';

const TIMEZONE = 'Asia/Taipei';
const MAX_NOTE_LENGTH = 1000;

const getUserTimezone = async (waId: string) => {
    const { rows } = await db.query('SELECT reminder_timezone FROM whatsapp_users WHERE wa_id = $1', [waId]);
    return rows[0]?.reminder_timezone || TIMEZONE;
};

export const getToday = (timezone = TIMEZONE) => moment().tz(timezone).format('YYYY-MM-DD');

export const upsertWhatsAppUser = async (waId: string, profileName?: string) => {
    await db.query(
        `INSERT INTO whatsapp_users (wa_id, profile_name, last_inbound_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (wa_id) DO UPDATE SET
             profile_name = COALESCE(EXCLUDED.profile_name, whatsapp_users.profile_name),
             last_inbound_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP`,
        [waId, profileName || null]
    );
};

export const getTodayCheckin = async (waId: string) => {
    const date = getToday(await getUserTimezone(waId));
    const { rows } = await db.query(
        `SELECT id, reflection_note, body_feeling_note
         FROM whatsapp_checkin_logs WHERE wa_id = $1 AND checkin_date = $2`,
        [waId, date]
    );
    if (!rows.length) {
        return { date, alreadyCheckedIn: false, checkinLogId: null, selectedMethodIds: [], reflectionNote: '', bodyFeelingNote: '' };
    }
    const selected = await db.query(
        `SELECT practice_method_id FROM whatsapp_checkin_method_selections
         WHERE checkin_log_id = $1 ORDER BY practice_method_id`,
        [rows[0].id]
    );
    return {
        date,
        alreadyCheckedIn: true,
        checkinLogId: Number(rows[0].id),
        selectedMethodIds: selected.rows.map((row) => row.practice_method_id),
        reflectionNote: rows[0].reflection_note || '',
        bodyFeelingNote: rows[0].body_feeling_note || ''
    };
};

export const saveTodayCheckin = async (waId: string, methodIds: number[], reflectionNote: string, bodyFeelingNote: string) => {
    const uniqueMethodIds = [...new Set(methodIds)];
    if (!uniqueMethodIds.length) throw new Error('請至少選擇一個功法');
    if (reflectionNote.length > MAX_NOTE_LENGTH || bodyFeelingNote.length > MAX_NOTE_LENGTH) {
        throw new Error(`文字欄位不可超過 ${MAX_NOTE_LENGTH} 字`);
    }

    const date = getToday(await getUserTimezone(waId));
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${waId}:${date}`]);
        const methods = await client.query(
            `SELECT id, code, name_zh FROM practice_methods
             WHERE id = ANY($1::int[]) AND is_active = TRUE AND method_type = 'leaf'
             ORDER BY sort_order, id`,
            [uniqueMethodIds]
        );
        if (methods.rowCount !== uniqueMethodIds.length) throw new Error('包含無效或不可選擇的功法');

        const existing = await client.query(
            'SELECT id FROM whatsapp_checkin_logs WHERE wa_id = $1 AND checkin_date = $2 FOR UPDATE',
            [waId, date]
        );
        const alreadyCheckedIn = Boolean(existing.rowCount);
        const names = methods.rows.map((row) => row.name_zh as string);
        const note = [
            `功法：${names.join('、')}`,
            reflectionNote.trim() ? `心得：${reflectionNote.trim()}` : '',
            bodyFeelingNote.trim() ? `身體感受：${bodyFeelingNote.trim()}` : ''
        ].filter(Boolean).join('；');

        let checkinLogId: string;
        if (alreadyCheckedIn) {
            checkinLogId = existing.rows[0].id;
            await client.query(
                `UPDATE whatsapp_checkin_logs SET reflection_note = $1, body_feeling_note = $2,
                 note = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
                [reflectionNote.trim() || null, bodyFeelingNote.trim() || null, note, checkinLogId]
            );
            await client.query('DELETE FROM whatsapp_checkin_method_selections WHERE checkin_log_id = $1', [checkinLogId]);
        } else {
            const inserted = await client.query(
                `INSERT INTO whatsapp_checkin_logs (wa_id, checkin_date, reflection_note, body_feeling_note, note)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [waId, date, reflectionNote.trim() || null, bodyFeelingNote.trim() || null, note]
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

export const listRecentCheckins = async (waId: string, limit = 30) => {
    const { rows } = await db.query(
        `SELECT l.checkin_date::text, l.reflection_note, l.body_feeling_note,
                COALESCE(string_agg(m.name_zh, '、' ORDER BY m.sort_order), '') AS methods
         FROM whatsapp_checkin_logs l
         LEFT JOIN whatsapp_checkin_method_selections s ON s.checkin_log_id = l.id
         LEFT JOIN practice_methods m ON m.id = s.practice_method_id
         WHERE l.wa_id = $1
         GROUP BY l.id ORDER BY l.checkin_date DESC LIMIT $2`,
        [waId, limit]
    );
    return rows.map((row) => ({
        date: row.checkin_date,
        methods: row.methods,
        reflectionNote: row.reflection_note || '',
        bodyFeelingNote: row.body_feeling_note || ''
    }));
};
