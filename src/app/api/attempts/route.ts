import { NextResponse } from 'next/server';
import { getStudentAttempts, getAttempt, recordAttempt, resetStudentProgress } from '@/lib/db';
import { extractStudentId, NO_STORE_PRIVATE_HEADERS } from '@/lib/studentServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const student_id = extractStudentId(req);

    if (!student_id) {
      return NextResponse.json(
        { success: true, data: id ? null : [] },
        { headers: NO_STORE_PRIVATE_HEADERS }
      );
    }

    if (id) {
      const attempt = await getAttempt(id, student_id);
      if (!attempt) {
        return NextResponse.json(
          { success: false, message: 'Attempt not found' },
          { status: 404, headers: NO_STORE_PRIVATE_HEADERS }
        );
      }
      return NextResponse.json({ success: true, data: attempt }, { headers: NO_STORE_PRIVATE_HEADERS });
    }

    const entity_id = searchParams.get('entity_id') || searchParams.get('exam_id') || undefined;
    const include_answers = searchParams.get('include_answers') === 'true';

    const list = await getStudentAttempts(student_id, entity_id, include_answers);
    return NextResponse.json({ success: true, data: list }, { headers: NO_STORE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: NO_STORE_PRIVATE_HEADERS });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const student_id = extractStudentId(req, body?.student_id);
    if (!student_id) {
      return NextResponse.json(
        { success: false, message: 'Valid student session ID is required' },
        { status: 400, headers: NO_STORE_PRIVATE_HEADERS }
      );
    }
    if (!body.mode || !body.entity_id || !body.answers) {
      return NextResponse.json(
        { success: false, message: 'Invalid attempt payload' },
        { status: 400, headers: NO_STORE_PRIVATE_HEADERS }
      );
    }

    const created = await recordAttempt({ ...body, student_id });
    return NextResponse.json({ success: true, data: created }, { status: 201, headers: NO_STORE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: NO_STORE_PRIVATE_HEADERS });
  }
}

export async function DELETE(req: Request) {
  try {
    const student_id = extractStudentId(req);
    if (!student_id) {
      return NextResponse.json(
        { success: false, message: 'Valid student session ID is required' },
        { status: 400, headers: NO_STORE_PRIVATE_HEADERS }
      );
    }

    const result = await resetStudentProgress(student_id);
    return NextResponse.json(result, { headers: NO_STORE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: NO_STORE_PRIVATE_HEADERS });
  }
}

