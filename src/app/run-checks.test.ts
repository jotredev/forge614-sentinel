import { expect, test } from "bun:test";
import { testParams } from "../../tests/helpers/params";
import type { CheckDefinition } from "../modules/check";
import { pass } from "../modules/check";
import { CHECKS, NATIVE_CHECK_IDS } from "../modules/checks";
import type { RuleManifest } from "../modules/schemas/rule-manifest";
import { snapshotFrom } from "../modules/snapshot";
import { runChecks, selectChecks } from "./run-checks";

const manifest = (name: string, validator?: string): RuleManifest => ({ schemaVersion: 1, name, version: "1.0.0", level: "core", title: { es: "t", en: "t" }, appliesWhen: [], decisions: ["0001"], ...(validator === undefined ? {} : { validator }) });

const packParams = testParams({
  pack: { schemaVersion: 1, name: "forge614-pack-ecosystem-node", version: "1.0.0", title: { es: "t", en: "t" }, rules: ["forge614-rule-a", "forge614-rule-b", "forge614-rule-c", "forge614-rule-d"] },
  manifests: new Map([
    ["forge614-rule-a", manifest("forge614-rule-a", "package-naming")],
    ["forge614-rule-b", manifest("forge614-rule-b", "bilingual-docs")],
    ["forge614-rule-c", manifest("forge614-rule-c")],
    ["forge614-rule-d", manifest("forge614-rule-d", "boundaries-zod")],
  ]),
});

test("selects checks named by the pack (through the legacy map) plus the native set, in registry order, and lists unknown validators as outdated", () => {
  const s = selectChecks(packParams, CHECKS, NATIVE_CHECK_IDS);
  expect(s.selected.map((c) => c.id)).toEqual([
    "node-pointer", "layout", "stack", "secrets-hygiene", "package-naming", "docs-parity",
    "node-contract", "installer", "release", "versions", "support-matrix", "ecosystem-contract", "rules-catalog",
  ]);
  expect(s.outdated).toEqual([{ validator: "boundaries-zod", rule: "forge614-rule-d" }]);
});

test("--only narrows the selection and the outdated list", () => {
  const s = selectChecks(packParams, CHECKS, NATIVE_CHECK_IDS, ["layout", "docs-parity", "boundaries-zod"]);
  expect(s.selected.map((c) => c.id)).toEqual(["layout", "docs-parity"]);
  expect(s.outdated).toEqual([{ validator: "boundaries-zod", rule: "forge614-rule-d" }]);
});

test("runs applicable checks, marks the rest not-applicable, and renders both messages", async () => {
  const s = selectChecks(packParams, CHECKS, NATIVE_CHECK_IDS, ["layout", "support-matrix"]);
  const { entries, crashed } = await runChecks(snapshotFrom({}), packParams, s);
  expect(crashed).toEqual([]);
  expect(entries.map((e) => [e.id, e.verdict, e.applied])).toEqual([
    ["layout", "fail", true],
    ["support-matrix", "not-applicable", false],
  ]);
  expect(entries[1]?.message).toEqual({ es: "No aplica: standard/support-matrix.json not present.", en: "Not applicable: standard/support-matrix.json not present." });
  expect(entries[0]?.message.es.length).toBeGreaterThan(0);
});

test("an outdated validator becomes a caution entry with SENTINEL_OUTDATED in the evidence", async () => {
  const s = selectChecks(packParams, CHECKS, NATIVE_CHECK_IDS, ["boundaries-zod"]);
  const { entries } = await runChecks(snapshotFrom({}), packParams, s);
  expect(entries).toEqual([
    {
      id: "boundaries-zod",
      verdict: "caution",
      applied: true,
      evidence: ["SENTINEL_OUTDATED: validator 'boundaries-zod' requested by forge614-rule-d is not implemented by sentinel 0.1.0"],
      message: {
        es: "El reglamento pide el validador 'boundaries-zod' que esta versión de Sentinel no implementa: actualiza Sentinel.",
        en: "The standard requests validator 'boundaries-zod', which this Sentinel version does not implement: update Sentinel.",
      },
    },
  ]);
});

test("a throwing check becomes CHECK_FAILED evidence with verdict fail; the others still run", async () => {
  const boom: CheckDefinition = { id: "boom", appliesWhen: () => true, run: () => { throw new Error("kaput"); } };
  const fine: CheckDefinition = { id: "fine", appliesWhen: () => true, run: () => pass("layoutOk") };
  const { entries, crashed } = await runChecks(snapshotFrom({}), packParams, { selected: [boom, fine], outdated: [] });
  expect(crashed).toEqual(["boom"]);
  expect(entries[0]).toMatchObject({ id: "boom", verdict: "fail", applied: true, evidence: ["CHECK_FAILED: kaput"] });
  expect(entries[0]?.message.en).toContain("kaput");
  expect(entries[1]).toMatchObject({ id: "fine", verdict: "pass" });
});
