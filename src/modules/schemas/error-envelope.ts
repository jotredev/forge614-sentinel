import { z } from "zod";
export const ErrorEnvelopeSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    error: z.string().min(1),
  })
  .strict();
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
