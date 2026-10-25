import { NextResponse } from 'next/server';
import { verifyAdminPassword, generateSessionToken, validateSessionToken } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ success: false, message: 'Invalid administrator credentials' }, { status: 401 });
    }

    const token = generateSessionToken();
    const response = NextResponse.json({ success: true, message: 'Admin authentication successful' });
    response.cookies.set('med_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Authentication error', error: String(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/med_admin_session=([^;]+)/);
  const token = match ? match[1] : null;
  const isAuthorized = validateSessionToken(token);
  return NextResponse.json({ authenticated: isAuthorized });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete('med_admin_session');
  return response;
}
