import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/adminAuth';
import { parseBulkExamText, executeBulkImport, ParsedExamPayload } from '@/lib/bulkImport';

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin login required.' }, { status: 401 });
  }

  try {
    const body = await req.json();

    let parsedPayload: ParsedExamPayload;

    if (body.raw_text) {
      parsedPayload = parseBulkExamText(body.raw_text);
    } else if (body.exam_title && body.questions) {
      parsedPayload = body as ParsedExamPayload;
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid request: please provide raw_text or structured exam payload.',
      }, { status: 400 });
    }

    if (!parsedPayload.questions || parsedPayload.questions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No questions could be parsed from the provided text. Please verify formatting.',
      }, { status: 400 });
    }

    const result = await executeBulkImport(parsedPayload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in bulk import API:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
