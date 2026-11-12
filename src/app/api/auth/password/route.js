import bcrypt from 'bcryptjs';
import { handler } from '@/lib/route';
import { asLogin } from '@/lib/db';
import { str, password } from '@/lib/validate';
import { httpError } from '@/lib/errors';

export const POST = handler(null, async ({ session, body, db }) => {
  const oldPassword = str(body.old_password, 'Current password');
  const newPassword = password(body.new_password);

  // Verify current password
  const { rows } = await asLogin((c) => c.query('SELECT password_hash FROM users WHERE user_id = $1', [session.uid]));
  const user = rows[0];
  if (!user) throw httpError(404, 'User not found.');

  const match = await bcrypt.compare(oldPassword, user.password_hash);
  if (!match) throw httpError(400, 'Current password is incorrect.');

  const newHash = await bcrypt.hash(newPassword, 12);
  await db((c) => c.query('CALL sp_change_password($1)', [newHash]));

  return { ok: true, message: 'Password updated successfully.' };
});

export const dynamic = 'force-dynamic';
