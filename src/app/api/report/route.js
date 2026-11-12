import { handler } from '@/lib/route';
import { str, int } from '@/lib/validate';

export const POST = handler(['student', 'faculty', 'senior'], async ({ session, body, db }) => {
  return await db(async (c) => {
    const contentType = str(body.content_type, 'Content type', { max: 40 });
    const contentId = int(body.content_id, 'Content ID');
    const reason = str(body.reason, 'Reason', { min: 5, max: 500 });

    await c.query(`
      INSERT INTO moderation_reports (reporter_id, content_type, content_id, reason, status)
      VALUES ($1, $2, $3, $4, 'pending')
    `, [session.uid, contentType, contentId, reason]);

    return { ok: true, message: 'Item flagged to administrators for moderation review.' };
  });
});

export const dynamic = 'force-dynamic';

