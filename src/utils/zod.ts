import type { ZodError } from "zod"

/** Flatten a ZodError into the first message per top-level field. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in result)) {
      result[key] = issue.message
    }
  }

  return result
}
