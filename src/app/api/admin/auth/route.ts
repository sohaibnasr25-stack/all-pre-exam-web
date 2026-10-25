import { NextResponse } from 'next/server';
import { verifyAdminCredentials, generateSessionToken, validateSessionToken } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    const { password, username } = await req.json();
    const auth = await verifyAdminCredentials(password, username);

    if (!auth.valid) {
      return NextResponse.json({
        success: false,
        message: 'Invalid administrator credentials (اسم المستخدم أو كلمة المرور غير صحيحة)',
      }, { status: 401 });
    }

    const adminUsername = auth.admin?.username || username || 'admin';
    const token = generateSessionToken(adminUsername);
    const response = NextResponse.json({
      success: true,
      message: 'Admin authentication successful',
      token,
      admin: auth.admin,
    });

    response.cookies.set('med_admin_session', token, {
      httpOnly: true,
      secure: false, // Allows session to work reliably on local HTTP, development, and production
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
  let token: string | null = null;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers.get('x-admin-token')) {
    token = req.headers.get('x-admin-token');
  }

  // 2. Check Cookie
  if (!token) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/med_admin_session=([^;]+)/);
    token = match ? match[1] : null;
  }

  const isAuthorized = validateSessionToken(token);

  let username = 'admin';
  if (token) {
    const parts = token.split('_');
    if (parts.length === 4) {
      try {
        username = Buffer.from(parts[2], 'base64url').toString('utf8');
      } catch {}
    }
  }

  return NextResponse.json({ authenticated: isAuthorized, username: isAuthorized ? username : null });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete('med_admin_session');
  return response;
}

