import { NextResponse } from 'next/server';
import { cleanOrphanQuestions } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    const result = await cleanOrphanQuestions();
    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${result.deleted_count} orphan questions`,
      data: result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: (error as Error).message || String(error),
      error: String(error),
    }, { status: 500 });
  }
}

