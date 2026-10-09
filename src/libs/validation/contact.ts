import { z } from "zod"

import type { TranslateFn } from "./auth"

export function createContactSchema(t: TranslateFn) {
  return z.object({
    name: z.string().trim().min(2, t("validation.fullNameMin")),
    email: z.string().trim().min(1, t("validation.emailRequired")).email(t("validation.email")),
    subject: z.string().trim().min(2, t("validation.subjectRequired")),
    message: z
      .string()
      .trim()
      .min(1, t("validation.messageRequired"))
      .max(500, t("validation.messageMax")),
  })
}

export type ContactValues = z.infer<ReturnType<typeof createContactSchema>>
