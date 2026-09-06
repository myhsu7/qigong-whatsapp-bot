import { Solar } from 'lunar-javascript';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Taipei';

export const getSanFuPeriod = (year: number) => {
    if (!Number.isInteger(year)) throw new Error(`Invalid Sanfu year: ${year}`);
    const endOfScan = moment.tz(`${year}-08-31`, 'YYYY-MM-DD', true, TIMEZONE);
    let current = moment.tz(`${year}-06-20`, 'YYYY-MM-DD', true, TIMEZONE);
    let start: moment.Moment | null = null;
    let end: moment.Moment | null = null;
    while (current.isSameOrBefore(endOfScan, 'day')) {
        const fu = Solar.fromYmd(current.year(), current.month() + 1, current.date()).getLunar().getFu();
        if (fu) {
            start ||= current.clone();
            end = current.clone();
        } else if (start && end) {
            break;
        }
        current.add(1, 'day');
    }
    return start && end ? { start, end, totalDays: end.diff(start, 'days') + 1 } : null;
};
