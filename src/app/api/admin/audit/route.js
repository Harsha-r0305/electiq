import { handler } from '@/lib/route';
export const GET = handler(['admin'], async ({ query, db }) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const params = [];
  let where = '';
  if (query.table) { params.push(query.table); where = 'WHERE table_name = $1'; }
  return db(async (c) => {
    const total = parseInt((await c.query(`SELECT count(*)::int AS count FROM audit_log ${where}`, params)).rows[0].count, 10);
    const rows = (await c.query(
      `SELECT log_id, user_id, action, table_name, row_pk, new_value, old_value, logged_at
         FROM audit_log ${where} ORDER BY log_id DESC LIMIT ${limit} OFFSET ${offset}`, params)).rows;
    return { rows, total, page, limit, pages: Math.ceil(total / limit) };
  });
});

export const dynamic = 'force-dynamic';
