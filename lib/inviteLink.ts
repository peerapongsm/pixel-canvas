// Invite links carry the connection code in the URL fragment (#j=...).
// The fragment never leaves the browser — it is not sent in HTTP requests —
// so the "no server sees anything" story holds even for link-based invites.

export function buildInviteLink(origin: string, code: string): string {
  return `${origin}/#j=${code}`;
}

/** Extract the invite code from a location.hash value; null if absent/empty. */
export function parseInviteFragment(hash: string): string | null {
  const m = /^#j=(.+)$/.exec(hash);
  if (!m) return null;
  // codes are base64url (+ optional "P2." prefix); decodeURIComponent is a
  // no-op for those chars but guards against share targets that re-encode "."
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
