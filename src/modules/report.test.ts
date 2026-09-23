import { expect, test } from "bun:test";
import { CheckReportSchema, NotApplicableReportSchema } from "./report";

// Verbatim from spec §6 (with a real sha256 in place of the ellipsis).
const SPEC_EXAMPLE = {
  schemaVersion: 1,
  sentinel: "0.1.0",
  standard: { version: "1.0.0", sha256: "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922", forced: false, fetched: false },
  repository: { kind: "node", name: "engram" },
  verdict: "pass",
  checks: [
    {
      id: "docs-parity",
      verdict: "pass",
      applied: true,
      evidence: ["docs/es/03-x.md: 5 headings vs docs/en/03-x.md: 4"],
      message: { es: "…", en: "…" },
    },
  ],
  durationMs: 812,
};

test("the spec §6 example is a valid CheckReport", () => {
  expect(CheckReportSchema.safeParse(SPEC_EXAMPLE).success).toBe(true);
});

test("latestKnown is optional and unknown keys are rejected", () => {
  expect(CheckReportSchema.safeParse({ ...SPEC_EXAMPLE, standard: { ...SPEC_EXAMPLE.standard, latestKnown: "1.1.0" } }).success).toBe(true);
  expect(CheckReportSchema.safeParse({ ...SPEC_EXAMPLE, extra: 1 }).success).toBe(false);
  expect(CheckReportSchema.safeParse({ ...SPEC_EXAMPLE, checks: [{ ...SPEC_EXAMPLE.checks[0], ruleId: "x" }] }).success).toBe(false);
});

test("a not-applicable report has exactly the spec §4 shape", () => {
  expect(NotApplicableReportSchema.safeParse({ schemaVersion: 1, applicable: false, reason: "external-project" }).success).toBe(true);
  expect(NotApplicableReportSchema.safeParse({ schemaVersion: 1, applicable: false, reason: "other" }).success).toBe(false);
});
