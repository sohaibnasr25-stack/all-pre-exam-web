import { cookies } from 'next/headers';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MedAdmin2025!';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'secret-salt-universal-med-platform';

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return password.trim() === ADMIN_PASSWORD.trim();
}

export function generateSessionToken(): string {
  const timestamp = Date.now();
  const signature = Buffer.from(`${timestamp}:${ADMIN_SESSION_SECRET}`).toString('base64');
  return `adm_${timestamp}_${signature}`;
}

export function validateSessionToken(token: string | null | undefined): boolean {
  if (!token || !token.startsWith('adm_')) return false;
  try {
    const parts = token.split('_');
    if (parts.length !== 3) return false;
    const timestamp = parseInt(parts[1], 10);
    const signature = parts[2];

    // Check token age (valid for 7 days)
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAgeMs) return false;

    const expectedSig = Buffer.from(`${timestamp}:${ADMIN_SESSION_SECRET}`).toString('base64');
    return signature === expectedSig;
  } catch {
    return false;
  }
}

export async function isAuthorizedAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('med_admin_session')?.value;
    return validateSessionToken(token);
  } catch {
    return false;
  }
}
