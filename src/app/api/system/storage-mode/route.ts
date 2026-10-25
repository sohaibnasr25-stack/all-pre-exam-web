import { NextResponse } from 'next/server';
import { getDatabaseStatus, getStorageMode, setStorageMode, StorageMode } from '@/lib/db';

export async function GET() {
  try {
    const status = await getDatabaseStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed to retrieve storage status', error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode as StorageMode;
    if (mode !== 'auto' && mode !== 'local_only') {
      return NextResponse.json({ success: false, message: 'Invalid storage mode. Must be "auto" or "local_only".' }, { status: 400 });
    }

    const updatedMode = setStorageMode(mode);
    const status = await getDatabaseStatus();

    return NextResponse.json({
      success: true,
      message: updatedMode === 'local_only'
        ? 'Switched to Local Database Mode (Offline Safe & Fast)'
        : 'Switched to Auto Mode (Cloud Supabase with Resilient Fallback)',
      data: status,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed to update storage mode', error: String(error) }, { status: 500 });
  }
}
