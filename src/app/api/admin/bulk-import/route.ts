import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/adminAuth';
import { parseBulkExamText, executeBulkImport, ParsedExamPayload } from '@/lib/bulkImport';

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin login required.' }, { status: 401 });
  }

  try {
    const body = await req.json();

    let parsedPayload: ParsedExamPayload;

    if (body.raw_text) {
      parsedPayload = parseBulkExamText(body.raw_text);
    } else if (body.questions && Array.isArray(body.questions)) {
      parsedPayload = {
        exam_title: body.exam_title || 'Imported Examination',
        academic_year_name: body.academic_year_name || '',
        module_name: body.module_name || '',
        default_subject_name: body.default_subject_name || body.subject_name || '',
        default_chapter_name: body.default_chapter_name || body.chapter_name || '',
        default_concept_name: body.default_concept_name || body.concept_name || '',
        exam_type: body.exam_type === 'end_module' ? 'end_module' : 'final',
        duration_minutes: body.duration_minutes || 60,
        passing_score: body.passing_score || 70,
        instructions: body.instructions || '',
        questions: body.questions,
        all_exams: body.all_exams,
      };
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid request: please provide raw_text or questions array.',
      }, { status: 400 });
    }

    if (!parsedPayload.questions || parsedPayload.questions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No questions could be parsed from the provided payload.',
      }, { status: 400 });
    }

    const result = await executeBulkImport(parsedPayload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in bulk import API:', error);
    return NextResponse.json({ success: false, message: (error as Error).message || String(error), error: String(error) }, { status: 500 });
  }
}

