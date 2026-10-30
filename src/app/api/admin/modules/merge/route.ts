import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/adminAuth';
import { mergeModules } from '@/lib/db';

export async function POST(req: Request) {
  const authorized = await isAuthorizedAdmin(req);
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized. Admin session required.' }, { status: 401 });
  }

  try {
    const { source_module_id, target_module_id } = await req.json();
    if (!source_module_id || !target_module_id) {
      return NextResponse.json(
        { success: false, message: 'Source module ID and target module ID are both required.' },
        { status: 400 }
      );
    }
    if (source_module_id === target_module_id) {
      return NextResponse.json(
        { success: false, message: 'لا يمكن دمج الموديول مع نفسه.' },
        { status: 400 }
      );
    }

    const result = await mergeModules(source_module_id, target_module_id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in modules merge API:', error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || String(error) },
      { status: 500 }
    );
  }
}

