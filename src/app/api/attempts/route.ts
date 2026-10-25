import { NextResponse } from 'next/server';
import { getStudentAttempts, getAttempt, recordAttempt, resetStudentProgress } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      const attempt = await getAttempt(id);
      if (!attempt) return NextResponse.json({ success: false, message: 'Attempt not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: attempt });
    }

    const student_id = searchParams.get('student_id') || 'default_student';
    const entity_id = searchParams.get('entity_id') || searchParams.get('exam_id') || undefined;
    const include_answers = searchParams.get('include_answers') === 'true';

    const list = await getStudentAttempts(student_id, entity_id, include_answers);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.mode || !body.entity_id || !body.answers) {
      return NextResponse.json({ success: false, message: 'Invalid attempt payload' }, { status: 400 });
    }

    const created = await recordAttempt(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get('student_id') || 'default_student';

    const result = await resetStudentProgress(student_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

