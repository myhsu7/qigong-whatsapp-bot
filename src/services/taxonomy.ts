import { db } from '../db';

export interface PracticeMethodRow {
    id: number;
    code: string;
    nameZh: string;
    nameZhCn: string;
    nameEn: string | null;
    estimatedMinutes: number | null;
    sortOrder: number;
    parentId: number | null;
    methodType: 'group' | 'leaf';
}

export interface PracticeMethod extends Omit<PracticeMethodRow, 'sortOrder'> {
    children: PracticeMethod[];
}

export const getPracticeMethodRows = async (): Promise<PracticeMethodRow[]> => {
    const { rows } = await db.query(
        `SELECT id, code, name_zh, name_zh_cn, name_en, estimated_minutes, sort_order, parent_id, method_type
         FROM practice_methods WHERE is_active = TRUE ORDER BY sort_order, id`
    );
    return rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameZh: row.name_zh,
        nameZhCn: row.name_zh_cn,
        nameEn: row.name_en,
        estimatedMinutes: row.estimated_minutes,
        sortOrder: row.sort_order,
        parentId: row.parent_id,
        methodType: row.method_type
    }));
};

export const buildPracticeMethodTree = (rows: PracticeMethodRow[]): PracticeMethod[] => {
    const methods = new Map<number, PracticeMethod>();
    for (const row of rows) {
        methods.set(row.id, { ...row, children: [] });
    }
    const roots: PracticeMethod[] = [];
    for (const row of rows) {
        const method = methods.get(row.id)!;
        const parent = row.parentId ? methods.get(row.parentId) : undefined;
        if (parent) parent.children.push(method);
        else roots.push(method);
    }
    return roots;
};

export const getPracticeMethods = async () => buildPracticeMethodTree(await getPracticeMethodRows());
