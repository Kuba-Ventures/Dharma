// Resolve who a reply should be addressed to, so the greeting uses a real name
// instead of the model guessing (which produced hallucinated openers like
// "Hey Brady," when the saved greeting was the template "Hey {{name}},").
//
// Preference order: the name the sender signed off with in the body (what
// people actually go by), then the From display name. Returns a first name, or
// "" when nothing reliable is found (caller should then greet without a name).

const SIGN_OFF = /^(thanks|thank you|thanks so much|thanks again|best|best regards|regards|kind regards|warm regards|warmly|cheers|sincerely|talk soon|speak soon|all the best|many thanks)[,!.]*$/i;

function isNameLike(s: string): boolean {
  // A single capitalized word, 2-20 letters (allows O'Brien, Anne-Marie).
  return /^[A-Z][A-Za-z'’-]{1,19}$/.test(s);
}

function firstToken(s: string): string {
  return (s.trim().split(/[\s.]+/)[0] || "").replace(/[^A-Za-z'’-]/g, "");
}

// Name the sender signed off with, e.g. "Thanks,\nJoe" -> "Joe". Stops at a
// signature delimiter ("-- ") so a formal signature block below it is ignored.
export function signOffName(body: string): string {
  if (!body) return "";
  let text = body.replace(/\r/g, "");
  const sig = text.search(/\n--\s*\n/);
  if (sig > 0) text = text.slice(0, sig);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    if (SIGN_OFF.test(lines[i])) {
      const cand = firstToken(lines[i + 1]);
      if (isNameLike(cand)) return cand;
    }
  }
  return "";
}

// First name from a From header: display name if present, else the email's
// local part. `"Finley Underwood" <f@x.com>` -> "Finley", `joe@x.com` -> "" (a
// bare local part rarely reads as a real first name, so we don't force it).
export function fromDisplayFirstName(fromHeader: string): string {
  if (!fromHeader) return "";
  const angle = fromHeader.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>/);
  const display = angle ? angle[1].trim() : "";
  if (!display) return "";
  const first = firstToken(display);
  return isNameLike(first) ? first : "";
}

export function resolveRecipientName(fromHeader: string, body: string): string {
  return signOffName(body) || fromDisplayFirstName(fromHeader) || "";
}
