import { handler } from '@/lib/route';

export const GET = handler(['admin'], async ({ query, db }) => {
  return await db(async (c) => {
    const role = query.role || 'senior';
    const res = await c.query(`
      SELECT config_id, role, section, field_key, label, is_visible, is_required, display_order, custom_type
      FROM dashboard_designer_config
      WHERE role = $1
      ORDER BY section, display_order ASC
    `, [role]);

    // If empty for role, initialize default designer configs
    if (res.rows.length === 0) {
      const defaults = [
        // Senior Form Fields
        { role: 'senior', section: 'feedback', field_key: 'difficulty', label: 'Difficulty (1-5)', is_visible: true, is_required: true, display_order: 1 },
        { role: 'senior', section: 'feedback', field_key: 'workload', label: 'Workload (1-5)', is_visible: true, is_required: true, display_order: 2 },
        { role: 'senior', section: 'feedback', field_key: 'usefulness', label: 'Usefulness (1-5)', is_visible: true, is_required: true, display_order: 3 },
        { role: 'senior', section: 'feedback', field_key: 'review_text', label: 'Advice / What to know', is_visible: true, is_required: false, display_order: 4 },
        { role: 'senior', section: 'placements', field_key: 'company', label: 'Company', is_visible: true, is_required: true, display_order: 1 },
        { role: 'senior', section: 'placements', field_key: 'role', label: 'Job Role', is_visible: true, is_required: true, display_order: 2 },
        { role: 'senior', section: 'placements', field_key: 'package_lpa', label: 'Package (LPA)', is_visible: true, is_required: true, display_order: 3 },
        { role: 'senior', section: 'projects', field_key: 'brief', label: 'Short Project Brief', is_visible: true, is_required: true, display_order: 1 },
        { role: 'senior', section: 'projects', field_key: 'repo_link', label: 'Repository Link', is_visible: true, is_required: false, display_order: 2 },
        { role: 'senior', section: 'projects', field_key: 'helped_in_placement', label: 'How it helped in placement', is_visible: true, is_required: false, display_order: 3 }
      ];

      for (const d of defaults) {
        await c.query(`
          INSERT INTO dashboard_designer_config (role, section, field_key, label, is_visible, is_required, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (role, section, field_key) DO NOTHING
        `, [d.role, d.section, d.field_key, d.label, d.is_visible, d.is_required, d.display_order]);
      }

      const refreshed = await c.query(`
        SELECT config_id, role, section, field_key, label, is_visible, is_required, display_order, custom_type
        FROM dashboard_designer_config
        WHERE role = $1
        ORDER BY section, display_order ASC
      `, [role]);
      return refreshed.rows;
    }

    return res.rows;
  });
});

export const POST = handler(['admin'], async ({ body, db }) => {
  return await db(async (c) => {
    const { action, config } = body;

    if (action === 'update_field') {
      await c.query(`
        UPDATE dashboard_designer_config
        SET label = COALESCE($1, label),
            is_visible = COALESCE($2, is_visible),
            is_required = COALESCE($3, is_required),
            display_order = COALESCE($4, display_order)
        WHERE config_id = $5
      `, [config.label, config.is_visible, config.is_required, config.display_order, config.config_id]);
      return { ok: true, message: 'Field configuration updated.' };
    }

    if (action === 'add_custom_question') {
      // Add custom question to senior forms (text, number, rating, yes/no)
      await c.query(`
        INSERT INTO dashboard_designer_config (role, section, field_key, label, is_visible, is_required, display_order, custom_type)
        VALUES ($1, $2, $3, $4, true, $5, $6, $7)
      `, [
        config.role || 'senior',
        config.section,
        config.field_key.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
        config.label,
        config.is_required || false,
        config.display_order || 10,
        config.custom_type || 'text'
      ]);
      return { ok: true, message: 'Custom question added.' };
    }

    return { error: 'Invalid designer action.' };
  });
});

export const dynamic = 'force-dynamic';

