import moment from 'moment-timezone';
import { db } from '../db';
import { Locale } from '../i18n';
import { UserInputError } from '../errors';

const DEFAULT_TIMEZONE = 'Asia/Taipei';

export const getMonthRange = (month: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new UserInputError('invalid_month');
    if (Number(month.slice(0, 4)) === 0) throw new UserInputError('invalid_month');
    const start = moment.utc(`${month}-01`, 'YYYY-MM-DD', true);
    if (!start.isValid()) throw new UserInputError('invalid_month');
    return {
        month,
        start: start.format('YYYY-MM-DD'),
        endExclusive: start.clone().add(1, 'month').format('YYYY-MM-DD'),
        daysInMonth: start.daysInMonth(),
        firstWeekday: start.day()
    };
};

export const getCalendar = async (waId: string, requestedMonth: string | undefined, locale: Locale) => {
    const user = await db.query('SELECT reminder_timezone FROM whatsapp_users WHERE wa_id = $1', [waId]);
    const timezone = user.rows[0]?.reminder_timezone || DEFAULT_TIMEZONE;
    const month = requestedMonth || moment().tz(timezone).format('YYYY-MM');
    const range = getMonthRange(month);
    const nameColumn = locale === 'en' ? 'COALESCE(m.name_en, m.name_zh)' : locale === 'zh_CN' ? 'm.name_zh_cn' : 'm.name_zh';
    const { rows } = await db.query(
        `SELECT l.id, l.checkin_date::text, l.practice_note,
                COALESCE(ARRAY_AGG(${nameColumn} ORDER BY m.sort_order) FILTER (WHERE m.id IS NOT NULL), '{}') AS methods
         FROM whatsapp_checkin_logs l
         LEFT JOIN whatsapp_checkin_method_selections s ON s.checkin_log_id = l.id
         LEFT JOIN practice_methods m ON m.id = s.practice_method_id
         WHERE l.wa_id = $1 AND l.checkin_date >= $2 AND l.checkin_date < $3
         GROUP BY l.id ORDER BY l.checkin_date`,
        [waId, range.start, range.endExclusive]
    );
    const entries = rows.map((row) => ({
        id: Number(row.id),
        date: row.checkin_date,
        methods: row.methods || [],
        practiceNote: row.practice_note || '',
        reflectionNote: row.practice_note || '',
        bodyFeelingNote: ''
    }));
    return { ...range, checkedInDates: entries.map((entry) => entry.date), entries };
};
