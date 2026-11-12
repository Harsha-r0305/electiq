import { NextResponse } from 'next/server';
import { asLogin } from '@/lib/db';
export async function GET() {
  const { rows } = await asLogin((c) => c.query('SELECT dept_id, name FROM departments ORDER BY name'));
  return NextResponse.json(rows);
}

export const dynamic = 'force-dynamic';
