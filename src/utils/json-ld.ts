/**
 * Serialize data for a `<script type="application/ld+json">` block.
 *
 * `JSON.stringify` alone is not safe for that: React's `dangerouslySetInnerHTML`
 * writes the string into the HTML document verbatim, and JSON does not escape
 * `<`. A venue or professional whose name, address or phone contains
 * `</script>` would close the block early and let the rest of the payload be
 * read as markup — a stored XSS on a public page, executed because the CSP
 * still allows inline scripts. Escaping `<`, `>` and `&` keeps those sequences
 * inside the JSON string (they decode back to the original characters), and
 * U+2028/U+2029 are escaped for parsers that still choke on them.
 */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
