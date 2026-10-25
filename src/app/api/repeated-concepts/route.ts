import { NextResponse } from 'next/server';
import { getRepeatedConcepts } from '@/lib/db';

export async function GET() {
  try {
    const list = await getRepeatedConcepts();
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
