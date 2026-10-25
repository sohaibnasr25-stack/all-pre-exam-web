import { NextResponse } from 'next/server';
import { resetDatabaseWithSeed } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    await resetDatabaseWithSeed();
    return NextResponse.json({ success: true, message: 'Database reset to default seed data successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}
