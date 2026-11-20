import { NextResponse } from 'next/server';
import { getBookmarks, toggleBookmark, deleteBookmark } from '@/lib/db';
import { extractStudentId, NO_STORE_PRIVATE_HEADERS } from '@/lib/studentServer';

export async function GET(req: Request) {
  try {
    const student_id = extractStudentId(req);
    if (!student_id) {
      return NextResponse.json({ success: true, data: [] }, { headers: NO_STORE_PRIVATE_HEADERS });
    }
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;

    const list = await getBookmarks(student_id, category);
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

    const { question_id, category, notes, action } = body;
    if (!question_id || !category) {
      return NextResponse.json(
        { success: false, message: 'Question ID and category are required' },
        { status: 400, headers: NO_STORE_PRIVATE_HEADERS }
      );
    }

    const result = await toggleBookmark(student_id, question_id, category, notes, action);
    return NextResponse.json(
      {
        success: true,
        bookmarked: !!result,
        data: result,
        message: result ? 'Bookmark updated/added' : 'Bookmark removed',
      },
      { headers: NO_STORE_PRIVATE_HEADERS }
    );
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Bookmark ID is required' },
        { status: 400, headers: NO_STORE_PRIVATE_HEADERS }
      );
    }

    await deleteBookmark(id, student_id);
    return NextResponse.json({ success: true, message: 'Bookmark removed' }, { headers: NO_STORE_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: NO_STORE_PRIVATE_HEADERS });
  }
}
