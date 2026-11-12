import { handler } from '@/lib/route';
import { str, int } from '@/lib/validate';

export const GET = handler(['admin'], async ({ db }) => {
  return await db(async (c) => {
    // 1. Role demand list
    const roleDemandRes = await c.query(`
      SELECT rd.*, jr.title AS role_title
      FROM role_demand rd
      JOIN job_roles jr ON jr.role_id = rd.role_id
      ORDER BY rd.year DESC, rd.quarter DESC, rd.demand_score DESC
    `);

    // 2. Skill-gap report (v_skill_gap)
    const skillGapRes = await c.query('SELECT * FROM v_skill_gap ORDER BY demand_score DESC, postings_count DESC');

    // 3. Faculty relevance and future scope ratings across all courses
    const facultyRatingsRes = await c.query(`
      SELECT fr.review_id, c.code, c.title, f.name AS faculty_name,
             fr.relevance, fr.future_scope, fr.comment
      FROM faculty_reviews fr
      JOIN courses c ON c.course_id = fr.course_id
      JOIN faculty f ON f.faculty_id = fr.faculty_id
      ORDER BY c.code ASC
    `);

    // Lookups for entry forms
    const rolesRes = await c.query('SELECT role_id, title FROM job_roles ORDER BY title');
    const skillsRes = await c.query('SELECT skill_id, name, category FROM skills ORDER BY name');

    return {
      roleDemand: roleDemandRes.rows,
      skillGap: skillGapRes.rows,
      facultyRatings: facultyRatingsRes.rows,
      roles: rolesRes.rows,
      skills: skillsRes.rows
    };
  });
});

export const POST = handler(['admin'], async ({ body, db }) => {
  return await db(async (c) => {
    const { action, data } = body;

    // 1. Enter or update role demand (source name and link required!)
    if (action === 'save_role_demand') {
      const roleId = int(data.role_id, 'Role');
      const year = int(data.year, 'Year', { min: 2020, max: 2100 });
      const quarter = str(data.quarter, 'Quarter');
      const postings = int(data.postings_count, 'Postings count', { min: 0 });
      const score = parseFloat(data.demand_score);
      const salary = data.avg_salary_lpa ? parseFloat(data.avg_salary_lpa) : null;
      const trend = str(data.trend_indicator || 'rising', 'Trend indicator');
      const sourceName = str(data.source_name, 'Source name', { min: 2 });
      const sourceLink = str(data.source_link, 'Source link', { min: 4 });

      await c.query(`
        INSERT INTO role_demand (role_id, year, quarter, postings_count, demand_score, avg_salary_lpa, trend_indicator, source_name, source_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (role_id, year, quarter) DO UPDATE
        SET postings_count = EXCLUDED.postings_count,
            demand_score = EXCLUDED.demand_score,
            avg_salary_lpa = EXCLUDED.avg_salary_lpa,
            trend_indicator = EXCLUDED.trend_indicator,
            source_name = EXCLUDED.source_name,
            source_link = EXCLUDED.source_link
      `, [roleId, year, quarter, postings, score, salary, trend, sourceName, sourceLink]);
      return { ok: true, message: 'Role demand record saved.' };
    }

    // 2. Enter or update skill demand
    if (action === 'save_skill_demand') {
      const skillId = int(data.skill_id, 'Skill');
      const year = int(data.year, 'Year', { min: 2020, max: 2100 });
      const postings = int(data.postings_count, 'Postings count', { min: 0 });
      const score = parseFloat(data.demand_score);

      await c.query(`
        INSERT INTO market_demand (skill_id, year, postings_count, demand_score)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (skill_id, year) DO UPDATE
        SET postings_count = EXCLUDED.postings_count,
            demand_score = EXCLUDED.demand_score
      `, [skillId, year, postings, score]);
      return { ok: true, message: 'Skill demand record saved.' };
    }

    // 3. Bulk CSV import with validation report
    if (action === 'import_csv') {
      const { rows, type } = data; // type: 'roles' or 'skills'
      const report = { totalRows: rows.length, success: 0, errors: [] };

      if (type === 'roles') {
        const rolesMap = {};
        (await c.query('SELECT role_id, lower(title) as title FROM job_roles')).rows.forEach(r => { rolesMap[r.title] = r.role_id; });

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const lineNum = i + 1;
          const roleId = rolesMap[r.role?.toLowerCase()?.trim()] || parseInt(r.role_id, 10);
          if (!roleId) {
            report.errors.push(`Row ${lineNum}: Role "${r.role || r.role_id}" not found.`);
            continue;
          }
          if (!r.source_name || !r.source_link) {
            report.errors.push(`Row ${lineNum}: Source name and source link are strictly required.`);
            continue;
          }
          try {
            await c.query(`
              INSERT INTO role_demand (role_id, year, quarter, postings_count, demand_score, avg_salary_lpa, trend_indicator, source_name, source_link)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (role_id, year, quarter) DO UPDATE
              SET postings_count = EXCLUDED.postings_count, demand_score = EXCLUDED.demand_score, avg_salary_lpa = EXCLUDED.avg_salary_lpa
            `, [roleId, parseInt(r.year, 10), r.quarter, parseInt(r.postings_count, 10), parseFloat(r.demand_score), parseFloat(r.avg_salary_lpa) || null, r.trend_indicator || 'rising', r.source_name, r.source_link]);
            report.success++;
          } catch (err) {
            report.errors.push(`Row ${lineNum}: ${err.message}`);
          }
        }
      }
      return { ok: true, report, message: `Imported ${report.success} of ${report.totalRows} records.` };
    }

    return { error: 'Invalid market data action.' };
  });
});

export const dynamic = 'force-dynamic';

