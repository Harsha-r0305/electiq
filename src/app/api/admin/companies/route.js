import { handler } from '@/lib/route';
import { str, int } from '@/lib/validate';

export const GET = handler(['admin'], async ({ db }) => {
  return await db(async (c) => {
    const { rows } = await c.query(`
      SELECT c.company_id, c.name, c.sector, c.tier,
             COUNT(p.placement_id) AS placement_count,
             ROUND(AVG(p.package_lpa), 2) AS avg_package
      FROM companies c
      LEFT JOIN placements p ON p.company_id = c.company_id
      GROUP BY c.company_id
      ORDER BY c.name ASC
    `);
    return rows;
  });
});

export const POST = handler(['admin'], async ({ body, db }) => {
  return await db(async (c) => {
    const { action = 'create', data } = body;

    // 1. Create company
    if (action === 'create') {
      const name = str(data.name, 'Company name');
      const sector = str(data.sector || 'Technology', 'Sector');
      const tier = int(data.tier || 2, 'Tier', { min: 1, max: 3 });

      const res = await c.query(`
        INSERT INTO companies (name, sector, tier)
        VALUES ($1, $2, $3)
        RETURNING company_id
      `, [name, sector, tier]);
      return { ok: true, company_id: res.rows[0].company_id, message: 'Company created.' };
    }

    // 2. Update company (including tier 1 / 2 / 3)
    if (action === 'update') {
      const companyId = int(data.company_id, 'Company ID');
      const name = str(data.name, 'Company name');
      const sector = str(data.sector, 'Sector');
      const tier = int(data.tier, 'Tier', { min: 1, max: 3 });

      await c.query(`
        UPDATE companies
        SET name = $1, sector = $2, tier = $3
        WHERE company_id = $4
      `, [name, sector, tier, companyId]);
      return { ok: true, message: 'Company updated.' };
    }

    // 3. Merge duplicates (e.g. "TCS" and "Tata Consultancy")
    if (action === 'merge') {
      const keepId = int(data.keep_company_id, 'Target company to keep');
      const duplicateId = int(data.duplicate_company_id, 'Duplicate company to merge');

      if (keepId === duplicateId) {
        return { error: 'Target company and duplicate company cannot be the same.' };
      }

      // Re-link all placements to keepId
      await c.query(`
        UPDATE placements
        SET company_id = $1
        WHERE company_id = $2
      `, [keepId, duplicateId]);

      // Delete the duplicate company
      await c.query('DELETE FROM companies WHERE company_id = $1', [duplicateId]);

      return { ok: true, message: 'Companies merged successfully. All associated placements updated.' };
    }

    // 4. Delete company
    if (action === 'delete') {
      const companyId = int(data.company_id, 'Company ID');
      await c.query('DELETE FROM companies WHERE company_id = $1', [companyId]);
      return { ok: true, message: 'Company deleted.' };
    }

    return { error: 'Invalid company action' };
  });
});

export const dynamic = 'force-dynamic';

