import { NextResponse } from 'next/server';
import { getPlatformStats } from '@/lib/db';
import { extractStudentId, NO_STORE_PRIVATE_HEADERS } from '@/lib/studentServer';

export async function GET(req: Request) {
  try {
    const student_id = extractStudentId(req) || '';
    const stats = await getPlatformStats(student_id);
    return NextResponse.json({ success: true, data: stats }, { headers: NO_STORE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: NO_STORE_PRIVATE_HEADERS });
  }
}
