import { z } from "zod";
import { PACKAGE_NAME_PATTERN } from "../package-name";
import { Bilingual, IsoDate, SemVer, Slug } from "./common";

const RuleName = z
  .string()
  .regex(PACKAGE_NAME_PATTERN)
  .refine((n) => n.split("-")[1] === "rule", "must be a rule package");

export const AppliesWhenSchema = z.union([
  z.object({ fileExists: z.string().min(1) }).strict(),
  z.object({ anyFileMatches: z.string().min(1) }).strict(),
]);

// acta 0021: a model-limitation package must declare a verifiable retirement
// condition and a review date; a structural package never does, because
// structural pieces (memory, contracts, accounting, verification, install,
// project identity) do not sunset as the model improves.
export const SunsetSchema = z
  .object({
    condition: z.string().min(1),
    reviewBy: IsoDate,
  })
  .strict();

export const RuleManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: RuleName,
    version: SemVer,
    level: z.enum(["core", "stack", "optional"]),
    title: Bilingual,
    appliesWhen: z.array(AppliesWhenSchema),
    validator: Slug.optional(),
    decisions: z.array(z.string().regex(/^\d{4}$/)),
    // acta 0020: estimated size (tokens) of the package when injected into a session.
    tokens: z.number().int().nonnegative().optional(),
    // acta 0021: is this package compensating for a model limitation, or is it structural?
    compensates: z.enum(["model-limitation", "structural"]).optional(),
    sunset: SunsetSchema.optional(),
  })
  .strict()
  .refine((m) => m.level !== "stack" || m.appliesWhen.length > 0, {
    message: "stack rules must declare appliesWhen",
    path: ["appliesWhen"],
  })
  .superRefine((m, ctx) => {
    if (m.compensates === "model-limitation" && m.sunset === undefined) {
      ctx.addIssue({ code: "custom", message: "model-limitation packages require sunset", path: ["sunset"] });
    }
    if (m.compensates !== "model-limitation" && m.sunset !== undefined) {
      ctx.addIssue({ code: "custom", message: "sunset is only allowed for model-limitation packages", path: ["sunset"] });
    }
  });

export type RuleManifest = z.infer<typeof RuleManifestSchema>;
