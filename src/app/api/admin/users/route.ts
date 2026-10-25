import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/adminAuth';
import { getAdmins, createAdmin, deleteAdmin } from '@/lib/db';

export async function GET() {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admins = await getAdmins();
    return NextResponse.json({ success: true, data: admins });
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
    if (!body.username || !body.password) {
      return NextResponse.json({
        success: false,
        message: 'Username and password are required',
      }, { status: 400 });
    }

    const created = await createAdmin({
      username: body.username.trim(),
      password: body.password.trim(),
      email: body.email ? body.email.trim() : undefined,
      full_name: body.full_name ? body.full_name.trim() : 'Administrator',
      is_active: body.is_active !== false,
    });

    return NextResponse.json({ success: true, data: created });
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
      return NextResponse.json({ success: false, message: 'Admin ID required' }, { status: 400 });
    }

    const deleted = await deleteAdmin(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
