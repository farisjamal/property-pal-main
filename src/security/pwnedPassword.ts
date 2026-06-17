const PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HASH_PREFIX_LENGTH = 5;

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Checks a password against the HaveIBeenPwned Pwned Passwords API using
 * k-anonymity: only the first 5 chars of the SHA-1 hash are sent. Returns the
 * number of breaches the password appears in (0 = safe). Fails open on error.
 */
export async function checkPwnedPassword(password: string): Promise<number> {
  if (!password) return 0;
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, HASH_PREFIX_LENGTH);
    const suffix = hash.slice(HASH_PREFIX_LENGTH);

    const response = await fetch(`${PWNED_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) return 0;

    const body = await response.text();
    for (const line of body.split("\n")) {
      const [lineSuffix, countText] = line.trim().split(":");
      if (lineSuffix === suffix) {
        const count = Number.parseInt(countText, 10);
        return Number.isFinite(count) ? count : 0;
      }
    }
    return 0;
  } catch (error) {
    // Fail open: a third-party outage must never block account flows.
    console.warn("Pwned-password check failed; treating as not breached.", error);
    return 0;
  }
}
