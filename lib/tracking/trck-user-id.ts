export const TRCK_UID_COOKIE = "trck_uid";

export function generateTrckUserId(): string {
  return crypto.randomUUID();
}
