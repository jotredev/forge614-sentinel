import { expect, test } from "bun:test";
import { CheckReportSchema, type CheckEntry } from "../modules/report";
import { buildReport } from "./build-report";

const entry = (id: string, verdict: CheckEntry["verdict"], applied = true): CheckEntry => ({ id, verdict, applied, evidence: [], message: { es: "x", en: "x" } });
const standard = { version: "1.0.0", sha256: "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922", forced: false, fetched: false, latestKnown: "1.0.0" };

test("verdict is the worst of the applied entries; not-applicable does not count", () => {
  const r = buildReport({ sentinelVersion: "0.1.0", standard, repositoryName: "demo", entries: [entry("a", "pass"), entry("b", "not-applicable", false), entry("c", "caution")], durationMs: 12 });
  expect(CheckReportSchema.safeParse(r).success).toBe(true);
  expect(r.verdict).toBe("caution");
  expect(r.standard).toEqual({ version: "1.0.0", sha256: standard.sha256, forced: false, fetched: false });
  expect(r.repository).toEqual({ kind: "node", name: "demo" });
});

test("latestKnown appears only when a newer standard than the one used is cached", () => {
  const r = buildReport({ sentinelVersion: "0.1.0", standard: { ...standard, latestKnown: "1.1.0" }, repositoryName: "demo", entries: [], durationMs: 0 });
  expect(r.standard.latestKnown).toBe("1.1.0");
  expect(r.verdict).toBe("pass");
});
