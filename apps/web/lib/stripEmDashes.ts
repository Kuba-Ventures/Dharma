// Guarantees generated copy contains no em-dashes (—) or en-dashes (–), which
// the product's voice deliberately avoids. Prompt instructions alone aren't
// reliable, so we post-process model output through this too. Only true em/en
// dashes are touched — ordinary hyphen-minus ("well-known", "2-4") is left
// alone. A spaced dash becomes a comma; a leftover leading comma is dropped so
// a sign-off like "— Alex" collapses to "Alex" rather than ", Alex".
export function stripEmDashes(input: string): string {
  return input
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/ {2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/^\s*,\s*/, "")
    .replace(/\n\s*,\s*/g, "\n");
}
