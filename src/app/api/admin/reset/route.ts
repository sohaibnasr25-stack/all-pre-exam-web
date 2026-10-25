import { NextResponse } from 'next/server';
import { resetDatabaseWithSeed } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function POST() {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await resetDatabaseWithSeed();
    return NextResponse.json({ success: true, message: 'Database reset to default seed data successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
