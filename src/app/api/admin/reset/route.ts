import { NextResponse } from 'next/server';
import { resetDatabaseWithSeed, wipeDatabaseCleanSlate } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    let mode = 'clean_slate';
    try {
      const body = await req.json();
      if (body?.mode) mode = body.mode;
    } catch {}

    if (mode === 'seed') {
      await resetDatabaseWithSeed();
      return NextResponse.json({ success: true, message: 'تم إعادة تعيين قاعدة البيانات إلى البيانات النموذجية الأولية بنجاح.' });
    }

    await wipeDatabaseCleanSlate();
    return NextResponse.json({ success: true, message: 'تم مسح وتفريغ قاعدة البيانات بالكامل بنجاح (Clean Slate).' });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}
