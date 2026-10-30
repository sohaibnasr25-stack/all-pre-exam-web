import { NextResponse } from 'next/server';
import { getExams, getExam, createExam, updateExam, deleteExam } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      const exam = await getExam(id);
      if (!exam) return NextResponse.json({ success: false, message: 'Exam not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: exam }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      });
    }

    const academicYearId = searchParams.get('academic_year_id') || undefined;
    const moduleId = searchParams.get('module_id') || undefined;
    const exams = await getExams({ academic_year_id: academicYearId, module_id: moduleId });
    return NextResponse.json({ success: true, data: exams }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.title || !body.academic_year_id || !body.module_id) {
      return NextResponse.json({ success: false, message: 'Title, Academic Year ID, and Module ID are required' }, { status: 400 });
    }
    const created = await createExam(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    const { id, ...updates } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
    }
    const updated = await updateExam(id, updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const deleteQuestions = searchParams.get('delete_questions') !== 'false';
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
    }
    await deleteExam(id, deleteQuestions);
    return NextResponse.json({ success: true, message: 'Exam and its questions deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}
