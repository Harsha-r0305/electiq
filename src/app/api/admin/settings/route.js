import { handler } from '@/lib/route';
import { str } from '@/lib/validate';

export const GET = handler(['admin'], async ({ query, db }) => {
  return await db(async (c) => {
    // 1. Settings key-values
    const setRes = await c.query('SELECT key, value, updated_at FROM system_settings');
    const settings = {};
    setRes.rows.forEach(r => { settings[r.key] = r.value; });

    // 2. Package tiers
    const tiersRes = await c.query('SELECT * FROM package_tiers ORDER BY display_order ASC');

    // 3. Database health notes: slow queries, index use
    const indexUsageRes = await c.query(`
      SELECT relname AS table_name,
             seq_scan, idx_scan,
             ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS idx_pct
      FROM pg_stat_user_tables
      ORDER BY (seq_scan + idx_scan) DESC
      LIMIT 10
    `);

    // 4. Data export (CSV) generator if requested
    if (query.export_table) {
      const allowed = ['courses', 'placements', 'feedback', 'skills', 'role_demand', 'v_department_dashboard', 'audit_log'];
      if (!allowed.includes(query.export_table)) {
        return { error: 'Export for this table is not supported.' };
      }
      const dataRes = await c.query(`SELECT * FROM ${query.export_table} LIMIT 500`);
      return { exportData: dataRes.rows };
    }

    return {
      settings,
      packageTiers: tiersRes.rows,
      dbHealth: {
        indexUsage: indexUsageRes.rows
      }
    };
  });
});

export const POST = handler(['admin'], async ({ body, db }) => {
  return await db(async (c) => {
    const { key, value } = body;
    const k = str(key, 'Setting key');
    const v = str(value, 'Setting value');

    await c.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `, [k, v]);

    return { ok: true, message: `Setting "${k}" updated.` };
  });
});

export const dynamic = 'force-dynamic';

