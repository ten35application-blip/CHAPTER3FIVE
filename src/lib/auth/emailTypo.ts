/**
 * Catch the email typos that quietly create a dead account (Wilson
 * 2026-09-09: "I accidentally spelled .com wrong and it still made it
 * and didn't say hey this seems wrong"). Pure function, no network:
 * returns a suggested address when the one typed looks like a slip,
 * or null when it looks fine. Never blocks — the caller asks "did you
 * mean…?" and the person decides. Mirrored in the phone app
 * (lib/emailTypo.ts); keep the two identical.
 */

const TLD_FIXES: Record<string, string> = {
  con: "com", cmo: "com", ocm: "com", om: "com", comm: "com", coom: "com", cm: "com", vom: "com", xom: "com", "com.": "com",
  nte: "net", ent: "net", "net.": "net",
  ogr: "org", rog: "org", "org.": "org",
  eud: "edu", "edu.": "edu",
  gvo: "gov", "gov.": "gov",
};

const DOMAIN_FIXES: Record<string, string> = {
  "gmail.co": "gmail.com", "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.cm": "gmail.com", "gmali.com": "gmail.com", "gmaill.com": "gmail.com", "gmail.comm": "gmail.com", "googlemail.co": "googlemail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com", "yahoo.co": "yahoo.com", "ymail.co": "ymail.com",
  "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotamil.com": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.co": "outlook.com", "oulook.com": "outlook.com",
  "iclod.com": "icloud.com", "icloud.co": "icloud.com", "icoud.com": "icloud.com", "icloud.cm": "icloud.com", "iclould.com": "icloud.com", "me.co": "me.com",
  "aol.co": "aol.com", "comcast.ne": "comcast.net", "verizon.ne": "verizon.net", "att.ne": "att.net", "sbcglobal.ne": "sbcglobal.net",
};

/** Suggest a corrected address for an obvious slip, else null. */
export function suggestEmailFix(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain.includes("@") || /\s/.test(domain)) return null;
  const known = DOMAIN_FIXES[domain];
  if (known) return `${local}@${known}`;
  const dot = domain.lastIndexOf(".");
  if (dot < 1) return null; // no dot at all — the browser/email field already refuses that
  const base = domain.slice(0, dot);
  const tld = domain.slice(dot + 1);
  const fixedTld = TLD_FIXES[tld];
  if (fixedTld && fixedTld !== tld) {
    domain = `${base}.${fixedTld}`;
    return `${local}@${domain}`;
  }
  // a doubled dot or a trailing dot is never right
  if (domain.includes("..") || domain.endsWith(".")) return `${local}@${domain.replace(/\.+/g, ".").replace(/\.$/, "")}`;
  return null;
}
