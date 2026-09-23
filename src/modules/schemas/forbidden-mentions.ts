import { z } from "zod";

// \p{Lu} covers every Unicode uppercase letter, not only A-Z, so a term such
// as "Ñandú" is rejected the same way "Vendor" is.
const LowercaseTerm = z.string().min(1).regex(/^\P{Lu}*$/u, "must be lowercase");

export const ForbiddenMentionsSchema = z
  .object({
    schemaVersion: z.literal(1),
    terms: z.array(LowercaseTerm).min(1),
    excludePaths: z.array(z.string()),
  })
  .strict();

export type ForbiddenMentions = z.infer<typeof ForbiddenMentionsSchema>;
