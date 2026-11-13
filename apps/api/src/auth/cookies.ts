export const SESSION_COOKIE = "releaseops_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SLIDE_WITHIN_MS = 6 * 24 * 60 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionIdFromCookie(value: string | undefined): string | null {
  if (!value || !UUID_PATTERN.test(value)) return null;
  return value;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function clearSessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}
