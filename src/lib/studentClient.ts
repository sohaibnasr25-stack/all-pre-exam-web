export const STUDENT_ID_STORAGE_KEY = 'omnimed_student_id';
export const STUDENT_ID_COOKIE_NAME = 'omnimed_student_id';
export const STUDENT_ID_HEADER = 'x-student-id';

const VALID_STUDENT_ID_REGEX = /^stu_[a-zA-Z0-9_-]{12,80}$/;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function persistStudentId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, id);
  } catch {}
  try {
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STUDENT_ID_COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=315360000; SameSite=Lax${secureFlag}`;
  } catch {}
}

function generateStudentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `stu_${crypto.randomUUID()}`;
  }
  return `stu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Retrieves the current device/browser's private student ID or generates one if absent.
 * Explicitly rejects any legacy shared 'default_student' identifier.
 */
export function getOrCreateStudentId(): string {
  if (typeof window === 'undefined') return '';

  try {
    const stored = localStorage.getItem(STUDENT_ID_STORAGE_KEY);
    if (stored && stored !== 'default_student' && VALID_STUDENT_ID_REGEX.test(stored)) {
      persistStudentId(stored);
      return stored;
    }
  } catch {}

  const fromCookie = readCookie(STUDENT_ID_COOKIE_NAME);
  if (fromCookie && fromCookie !== 'default_student' && VALID_STUDENT_ID_REGEX.test(fromCookie)) {
    persistStudentId(fromCookie);
    return fromCookie;
  }

  const freshId = generateStudentId();
  persistStudentId(freshId);
  return freshId;
}

/**
 * Wrapper around fetch() that automatically attaches the per-student private ID header
 * and bypasses HTTP caches so personal stats and attempts never leak across users.
 */
export function studentFetch(input: string, init?: RequestInit): Promise<Response> {
  const studentId = getOrCreateStudentId();
  const headers = new Headers(init?.headers || {});
  if (studentId) {
    headers.set(STUDENT_ID_HEADER, studentId);
  }
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
