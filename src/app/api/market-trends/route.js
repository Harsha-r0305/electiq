import { handler } from '@/lib/route';

export const GET = handler(['student', 'faculty', 'admin'], async ({ db }) => {
  return await db(async (c) => {
    // 1. Freshness label and settings
    const settingsRes = await c.query("SELECT key, value FROM system_settings WHERE key IN ('market_data_quarter', 'market_data_source')");
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.key] = r.value; });
    const freshnessLabel = `Data as of ${settings.market_data_quarter || 'Q3 2026'}, source: ${settings.market_data_source || 'LinkedIn Economic Graph & NASSCOM'}`;

    // 2. Top in-demand roles this quarter (latest quarter)
    const latestQuarter = settings.market_data_quarter || '2026-Q3';
    const rolesRes = await c.query(`
      SELECT rd.role_demand_id, rd.role_id, jr.title AS role_title, rd.year, rd.quarter,
             rd.postings_count, rd.demand_score, rd.avg_salary_lpa, rd.trend_indicator,
             rd.source_name, rd.source_link
      FROM role_demand rd
      JOIN job_roles jr ON jr.role_id = rd.role_id
      WHERE rd.quarter LIKE $1 OR rd.quarter = '2026-Q3'
      ORDER BY rd.demand_score DESC, rd.postings_count DESC
    `, [`%${latestQuarter.replace('Q', '')}%`]);

    // 3. Trend chart per role (all quarters)
    const allQuartersRes = await c.query(`
      SELECT rd.role_id, jr.title AS role_title, rd.quarter, rd.postings_count, rd.demand_score, rd.avg_salary_lpa
      FROM role_demand rd
      JOIN job_roles jr ON jr.role_id = rd.role_id
      ORDER BY rd.role_id, rd.quarter ASC
    `);

    const roleTrends = {};
    for (const row of allQuartersRes.rows) {
      if (!roleTrends[row.role_id]) {
        roleTrends[row.role_id] = { role_id: row.role_id, role_title: row.role_title, data: [] };
      }
      roleTrends[row.role_id].data.push({
        quarter: row.quarter,
        postings: row.postings_count,
        demand: Number(row.demand_score),
        salary: Number(row.avg_salary_lpa)
      });
    }

    // 4. In-demand skills and uncovered skills
    const skillsRes = await c.query(`
      SELECT skill_id, name, category, postings_count, demand_score, courses_teaching, uncovered
      FROM v_skill_gap
      ORDER BY demand_score DESC, postings_count DESC
    `);
    const allSkills = skillsRes.rows;
    const uncoveredSkills = allSkills.filter(s => s.uncovered);
    const topSkills = allSkills.slice(0, 8);

    // 5. Campus hiring vs. market demand
    // Compare full-time campus placements count vs. market job postings
    const campusHiringRes = await c.query(`
      SELECT p.role_id, jr.title AS role_title, COUNT(DISTINCT p.placement_id) AS campus_placed_count,
             ROUND(AVG(p.package_lpa), 2) AS avg_campus_pkg
      FROM placements p
      JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE p.type = 'full_time'
      GROUP BY p.role_id, jr.title
    `);
    const campusMap = {};
    campusHiringRes.rows.forEach(r => { campusMap[r.role_id] = r; });

    const campusVsMarket = (rolesRes.rows.length > 0 ? rolesRes.rows : allQuartersRes.rows.slice(0, 6)).map(r => {
      const camp = campusMap[r.role_id] || { campus_placed_count: 0, avg_campus_pkg: null };
      return {
        role_id: r.role_id,
        role_title: r.role_title,
        market_postings: r.postings_count,
        market_demand_score: Number(r.demand_score),
        market_avg_salary: Number(r.avg_salary_lpa),
        campus_placed_count: Number(camp.campus_placed_count),
        campus_avg_pkg: camp.avg_campus_pkg ? Number(camp.avg_campus_pkg) : null
      };
    });

    return {
      freshnessLabel,
      roles: rolesRes.rows,
      roleTrends: Object.values(roleTrends),
      topSkills,
      uncoveredSkills,
      campusVsMarket
    };
  });
});

export const dynamic = 'force-dynamic';

