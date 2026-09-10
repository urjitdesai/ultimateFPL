import { APP_NAME } from "../brand";

const PENDING_INVITE_KEY = "ultimate-fpl:pending-league-invite";

export type LeagueInviteRequest<T> = {
  key: string;
  promise: Promise<T>;
};

function browserSessionStorage() {
  try { return window.sessionStorage; }
  catch { return null; }
}

export function normalizeLeagueInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidLeagueInviteCode(value: string) {
  return normalizeLeagueInviteCode(value).length === 8;
}

export function leagueInvitePath(inviteCode: string) {
  return `/join/${encodeURIComponent(normalizeLeagueInviteCode(inviteCode))}`;
}

export function leagueInviteUrl(inviteCode: string, origin = window.location.origin) {
  return new URL(leagueInvitePath(inviteCode), origin).toString();
}

export function leagueInviteMessage(leagueName: string, inviteCode: string, origin = window.location.origin) {
  const code = normalizeLeagueInviteCode(inviteCode);
  return [
    `You're invited to join “${leagueName.trim()}” on ${APP_NAME}!`,
    "Predict every score, climb the table, and compete with me each gameweek.",
    `Join automatically here:\n${leagueInviteUrl(code, origin)}`,
    `League code: ${code}`
  ].join("\n\n");
}

export function savePendingLeagueInvite(inviteCode: string, storage: Storage | null = browserSessionStorage()) {
  const code = normalizeLeagueInviteCode(inviteCode);
  if (!storage || !isValidLeagueInviteCode(code)) return null;
  try { storage.setItem(PENDING_INVITE_KEY, code); return code; }
  catch { return null; }
}

export function getPendingLeagueInvite(storage: Storage | null = browserSessionStorage()) {
  if (!storage) return null;
  try {
    const code = normalizeLeagueInviteCode(storage.getItem(PENDING_INVITE_KEY) ?? "");
    return isValidLeagueInviteCode(code) ? code : null;
  } catch { return null; }
}

export function clearPendingLeagueInvite(storage: Storage | null = browserSessionStorage()) {
  try { storage?.removeItem(PENDING_INVITE_KEY); }
  catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
}

export function destinationAfterAuthentication(fallback: string, storage: Storage | null = browserSessionStorage()) {
  const inviteCode = getPendingLeagueInvite(storage);
  return inviteCode ? leagueInvitePath(inviteCode) : fallback;
}

export function getOrCreateLeagueInviteRequest<T>(
  current: LeagueInviteRequest<T> | null,
  key: string,
  createRequest: () => Promise<T>,
) {
  return current?.key === key ? current : { key, promise: createRequest() };
}
