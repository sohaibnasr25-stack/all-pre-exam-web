export const STUDENT_ID_COOKIE_NAME = 'omnimed_student_id';
export const STUDENT_ID_HEADER = 'x-student-id';
export const VALID_STUDENT_ID_REGEX = /^stu_[a-zA-Z0-9_-]{12,80}$/;

export const NO_STORE_PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  Vary: 'Cookie, X-Student-Id',
};

export function isValidStudentId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.trim() !== 'default_student' &&
    VALID_STUDENT_ID_REGEX.test(id.trim())
  );
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      const rawVal = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }
  return null;
}

/**
 * Extracts and validates the requesting student's private identifier from headers, cookies,
 * query params, or JSON body. Never falls back to 'default_student'.
 */
export function extractStudentId(req: Request, bodyStudentId?: unknown): string | null {
  const url = new URL(req.url);
  const candidates: unknown[] = [
    req.headers.get(STUDENT_ID_HEADER),
    parseCookieValue(req.headers.get('cookie'), STUDENT_ID_COOKIE_NAME),
    url.searchParams.get('student_id'),
    bodyStudentId,
  ];

  for (const candidate of candidates) {
    if (isValidStudentId(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}
