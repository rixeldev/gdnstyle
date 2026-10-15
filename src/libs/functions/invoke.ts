import { getSharedI18n } from "@/libs/i18n/client"
import { getSupabaseBrowserClient } from "@/libs/supabase/client"

/** Envelope used by the Edge Functions when something fails. */
interface FunctionErrorBody {
  error?: string
  message?: string
  msg?: string
  code?: string
  success?: boolean
}

/** Why the call failed: `not-deployed` and `unreachable` are infra issues. */
export type FunctionErrorCode = "not-deployed" | "unreachable" | "failed"

/** Error thrown by `invokeFunction`; `message` is already localized. */
export class FunctionError extends Error {
  readonly code: FunctionErrorCode
  readonly fn: string
  /**
   * Machine-readable cause sent by the function (`SLOT_TAKEN`, `DUPLICATE`…),
   * so callers can react to a business rule instead of parsing the message.
   */
  readonly serverCode: string | null

  constructor(
    message: string,
    code: FunctionErrorCode = "failed",
    fn = "",
    serverCode: string | null = null,
  ) {
    super(message)
    this.name = "FunctionError"
    this.code = code
    this.fn = fn
    this.serverCode = serverCode
  }
}

/** Localized, actionable message for an infrastructure-level failure. */
function infraMessage(name: string, code: "not-deployed" | "unreachable"): string {
  const i18n = getSharedI18n()
  return i18n.t(code === "not-deployed" ? "functions.notDeployed" : "functions.unreachable", {
    name,
  })
}

function failedMessage(name: string): string {
  return getSharedI18n().t("functions.failed", { name })
}

/**
 * Invoke a Supabase Edge Function with the signed-in user's JWT (the session
 * token is attached automatically by supabase-js). Every function answers
 * JSON; error envelopes are normalised into a thrown `FunctionError` so the
 * UI can show a localized, actionable message:
 *
 * - Function missing (gateway 404) or the browser blocked the request
 *   (preflight without `content-type`, the usual symptom of a function that
 *   was never deployed) → tells the user the exact `supabase functions
 *   deploy` command to run.
 * - Function answered with an error → the function's own message.
 */
export async function invokeFunction<T>(name: string, body?: unknown): Promise<T> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    throw new FunctionError(
      getSharedI18n().t("functions.unavailable", { name }),
      "unreachable",
      name,
    )
  }

  const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} })

  if (error) {
    // `context` is the Response for HTTP/relay errors, or the raw fetch
    // failure (no `.status`) when the request never completed — which is what
    // the browser reports for an undeployed function: its preflight rejects
    // because the gateway 404 does not allow `content-type`.
    const context = (error as { context?: unknown }).context
    const response =
      context && typeof (context as Response).status === "number" ? (context as Response) : null

    if (!response) {
      console.error(`[functions] «${name}» → sin respuesta (red, CORS o no desplegada)`, error)
      throw new FunctionError(infraMessage(name, "unreachable"), "unreachable", name)
    }

    let detail = ""
    let serverCode: string | null = null
    let notFound = response.status === 404
    try {
      const parsed = (await response.clone().json()) as FunctionErrorBody | null
      if (parsed && typeof parsed === "object") {
        detail = parsed.error || parsed.message || parsed.msg || ""
        // Machine-readable cause (`SLOT_TAKEN`…) kept for the callers.
        if (typeof parsed.code === "string") serverCode = parsed.code
        if (parsed.code === "NOT_FOUND") notFound = true
      }
    } catch {
      /* body is not JSON (gateway HTML); keep the status-based verdict. */
    }

    // The server's own message is the real cause; log it inline so the
    // browser console is enough to diagnose without opening the network tab.
    console.error(`[functions] «${name}» → HTTP ${response.status}${detail ? `: ${detail}` : ""}`)

    if (notFound) {
      throw new FunctionError(infraMessage(name, "not-deployed"), "not-deployed", name)
    }

    throw new FunctionError(detail || failedMessage(name), "failed", name, serverCode)
  }

  const parsed = data as (T & FunctionErrorBody) | null
  if (parsed && parsed.success === false) {
    throw new FunctionError(
      parsed.error || failedMessage(name),
      "failed",
      name,
      typeof parsed.code === "string" ? parsed.code : null,
    )
  }

  return parsed as T
}
