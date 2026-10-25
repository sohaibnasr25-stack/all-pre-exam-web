import { NextResponse } from 'next/server';
import { getConcepts, createConcept, updateConcept, deleteConcept } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get('chapter_id') || undefined;
    const concepts = await getConcepts(chapterId);
    return NextResponse.json({ success: true, data: concepts });
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
    if (!body.name || !body.chapter_id) {
      return NextResponse.json({ success: false, message: 'Name and Chapter ID are required' }, { status: 400 });
    }
    const created = await createConcept(body);
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
    const updated = await updateConcept(id, updates);
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
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
    }
    await deleteConcept(id);
    return NextResponse.json({ success: true, message: 'Concept deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}
