import { NextResponse } from 'next/server';
import { syncCloudToLocal, getDatabaseStatus } from '@/lib/db';

export async function GET() {
  try {
    const status = await getDatabaseStatus();
    return NextResponse.json({
      success: true,
      data: {
        last_synced_at: status.last_synced_at,
        auto_sync_enabled: status.auto_sync_enabled,
        isSupabaseReachable: status.isSupabaseReachable,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await syncCloudToLocal();
    const updatedStatus = await getDatabaseStatus();
    return NextResponse.json({
      ...result,
      status: updatedStatus,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}
