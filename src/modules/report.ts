import { z } from "zod";
import { SemVer, Sha256, Slug } from "./schemas/common";

const CheckVerdictSchema = z.enum(["pass", "caution", "fail", "not-applicable"]);
const VerdictSchema = z.enum(["pass", "caution", "fail"]);

export const CheckEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    verdict: CheckVerdictSchema,
    applied: z.boolean(),
    evidence: z.array(z.string()),
    message: z.object({ es: z.string().min(1), en: z.string().min(1) }).strict(),
  })
  .strict();
export type CheckEntry = z.infer<typeof CheckEntrySchema>;

// spec §6. Evolves additively (acta 0024): new fields are optional; nothing
// is renamed or removed without bumping schemaVersion.
export const CheckReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    sentinel: SemVer,
    standard: z
      .object({ version: SemVer, sha256: Sha256, forced: z.boolean(), fetched: z.boolean(), latestKnown: SemVer.optional() })
      .strict(),
    repository: z.object({ kind: z.literal("node"), name: Slug }).strict(),
    verdict: VerdictSchema,
    checks: z.array(CheckEntrySchema),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();
export type CheckReport = z.infer<typeof CheckReportSchema>;

export const NotApplicableReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    applicable: z.literal(false),
    reason: z.enum(["external-project", "not-a-forge614-repo"]),
  })
  .strict();
export type NotApplicableReport = z.infer<typeof NotApplicableReportSchema>;

export type SentinelReport = CheckReport | NotApplicableReport;
