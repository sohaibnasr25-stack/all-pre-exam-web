import { cookies } from 'next/headers';
import { verifyAdminInDatabase, AdminUser } from './db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MedAdmin2025!';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'secret-salt-universal-med-platform';

export async function verifyAdminCredentials(
  password: string,
  username?: string
): Promise<{ valid: boolean; admin?: AdminUser }> {
  if (!password) return { valid: false };

  // 1. Verify against Supabase / local database admins table
  const dbAuth = await verifyAdminInDatabase(password, username);
  if (dbAuth.valid) {
    return dbAuth;
  }

  // 2. Fallback to master environment / default password
  if (password.trim() === ADMIN_PASSWORD.trim()) {
    return {
      valid: true,
      admin: {
        id: 'master-admin',
        username: username?.trim() || 'master_admin',
        full_name: 'Primary Administrator',
        is_active: true,
      },
    };
  }

  return { valid: false };
}

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  return password.trim() === ADMIN_PASSWORD.trim();
}

export function generateSessionToken(username = 'admin'): string {
  const timestamp = Date.now();
  const safeUser = Buffer.from(username).toString('base64url');
  const signature = Buffer.from(`${timestamp}:${username}:${ADMIN_SESSION_SECRET}`).toString('base64');
  return `adm_${timestamp}_${safeUser}_${signature}`;
}

export function validateSessionToken(token: string | null | undefined): boolean {
  if (!token || !token.startsWith('adm_')) return false;
  try {
    const parts = token.split('_');
    if (parts.length === 3) {
      // Legacy token format support: adm_timestamp_signature
      const timestamp = parseInt(parts[1], 10);
      const signature = parts[2];
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp > maxAgeMs) return false;
      const expectedSig = Buffer.from(`${timestamp}:${ADMIN_SESSION_SECRET}`).toString('base64');
      return signature === expectedSig;
    }

    if (parts.length === 4) {
      // Modern token format: adm_timestamp_safeUser_signature
      const timestamp = parseInt(parts[1], 10);
      const safeUser = parts[2];
      const signature = parts[3];
      const username = Buffer.from(safeUser, 'base64url').toString('utf8');

      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp > maxAgeMs) return false;

      const expectedSig = Buffer.from(`${timestamp}:${username}:${ADMIN_SESSION_SECRET}`).toString('base64');
      return signature === expectedSig;
    }

    return false;
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

