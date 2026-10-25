import { NextResponse } from 'next/server';
import { getQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      const question = await getQuestion(id);
      if (!question) return NextResponse.json({ success: false, message: 'Question not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: question });
    }

    const exam_id = searchParams.get('exam_id') || undefined;
    const academic_year_id = searchParams.get('academic_year_id') || undefined;
    const module_id = searchParams.get('module_id') || undefined;
    const subject_id = searchParams.get('subject_id') || undefined;
    const chapter_id = searchParams.get('chapter_id') || undefined;
    const concept_id = searchParams.get('concept_id') || undefined;
    const difficulty = searchParams.get('difficulty') || undefined;

    const questions = await getQuestions({
      exam_id,
      academic_year_id,
      module_id,
      subject_id,
      chapter_id,
      concept_id,
      difficulty,
    });

    return NextResponse.json({ success: true, data: questions });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.question || !body.question.question_text) {
      return NextResponse.json({ success: false, message: 'Question text is required' }, { status: 400 });
    }
    if (!body.answer_choices || body.answer_choices.length < 2) {
      return NextResponse.json({ success: false, message: 'At least 2 answer choices are required' }, { status: 400 });
    }

    const created = await createQuestion(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, ...payload } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
    }

    const updated = await updateQuestion(id, payload);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
    }

    await deleteQuestion(id);
    return NextResponse.json({ success: true, message: 'Question deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
