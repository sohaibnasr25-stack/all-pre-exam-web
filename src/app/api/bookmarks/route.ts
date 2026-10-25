import { NextResponse } from 'next/server';
import { getBookmarks, toggleBookmark, deleteBookmark } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get('student_id') || 'default_student';
    const category = searchParams.get('category') || undefined;

    const list = await getBookmarks(student_id, category);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { student_id = 'default_student', question_id, category, notes, action } = await req.json();
    if (!question_id || !category) {
      return NextResponse.json({ success: false, message: 'Question ID and category are required' }, { status: 400 });
    }

    const result = await toggleBookmark(student_id, question_id, category, notes, action);
    return NextResponse.json({
      success: true,
      bookmarked: !!result,
      data: result,
      message: result ? 'Bookmark updated/added' : 'Bookmark removed',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Bookmark ID is required' }, { status: 400 });
    }

    await deleteBookmark(id);
    return NextResponse.json({ success: true, message: 'Bookmark removed' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
