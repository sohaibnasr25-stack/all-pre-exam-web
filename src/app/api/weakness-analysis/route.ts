import { NextResponse } from 'next/server';
import { getWeaknessMetrics } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get('student_id') || 'default_student';
    const metrics = await getWeaknessMetrics(student_id);
    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
