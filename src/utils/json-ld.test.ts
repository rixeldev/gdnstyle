import { describe, expect, it } from "vitest"

import { jsonLdHtml } from "@/utils/json-ld"

describe("jsonLdHtml", () => {
  it("round-trips the payload exactly, escapes and all", () => {
    const value = {
      "@type": "BeautySalon",
      name: "Studio <B> & " + '"Sons"',
      address: { streetAddress: "1 </script><script>alert(1)</script> Main St" },
    }

    expect(JSON.parse(jsonLdHtml(value))).toEqual(value)
  })

  it("never emits a tag-opening character, so no script block can be closed", () => {
    const html = jsonLdHtml({
      name: "</ScRiPt ><img src=x onerror=alert(1)>",
      note: "a & b",
    })

    expect(html).not.toMatch(/</)
    expect(html).not.toMatch(/>/)
    expect(html).not.toMatch(/&/)
    expect(html.toLowerCase()).not.toContain("</script")
  })

  it("escapes the Unicode line and paragraph separators", () => {
    const html = jsonLdHtml({ note: "line\u2028break\u2029end" })

    expect(html).toContain("\\u2028")
    expect(html).toContain("\\u2029")
    expect(JSON.parse(html)).toEqual({ note: "line\u2028break\u2029end" })
  })
})
