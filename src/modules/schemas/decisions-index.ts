import { z } from "zod";
import { IsoDate, Slug } from "./common";

const DecisionNumber = z.string().regex(/^\d{4}$/, "4-digit decision number");

const Decision = z
  .object({
    number: DecisionNumber,
    slug: Slug,
    title: z.string().min(1),
    status: z.enum(["propuesta", "aceptada", "revocada", "reemplazada"]),
    replacedBy: DecisionNumber.optional(),
    date: IsoDate,
    session: z.string().min(1).optional(),
    file: z.string().min(1),
  })
  .strict();

export const DecisionsIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    decisions: z.array(Decision),
  })
  .strict();

export type DecisionsIndex = z.infer<typeof DecisionsIndexSchema>;
