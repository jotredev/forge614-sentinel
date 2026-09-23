import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { contextBudgetCheck } from "./context-budget";

const params = testParams();
const PACK = "standard/packs/forge614-pack-ecosystem-node/pack.json";

test("applies only when the ecosystem pack.json exists in the repository (forge614-ai)", () => {
  expect(contextBudgetCheck.appliesWhen(snapshotFrom({}), params)).toBe(false);
  expect(contextBudgetCheck.appliesWhen(snapshotFromDir("context-budget/pass"), params)).toBe(true);
});

test("pass within budget, fail over 3000 estimated tokens", () => {
  const ok = contextBudgetCheck.run(snapshotFromDir("context-budget/pass"), params);
  expect(ok.verdict).toBe("pass");
  expect(ok.messageKey).toBe("contextBudgetOk");
  expect(ok.evidence[0]).toMatch(/^origin-rule-one: ~\d+ tokens \(estimate\)$/);
  const over = contextBudgetCheck.run(snapshotFromDir("context-budget/fail"), params);
  expect(over.verdict).toBe("fail");
  expect(over.messageKey).toBe("contextBudgetOverBudget");
});

test("invalid JSON or invalid pack are fail findings, never a throw", () => {
  expect(contextBudgetCheck.run(snapshotFrom({ [PACK]: "{ not json" }), params).messageKey).toBe("dataFileInvalidJson");
  expect(contextBudgetCheck.run(snapshotFrom({ [PACK]: "{}" }), params).messageKey).toBe("contextBudgetInvalid");
});

test("pins the boundary: total === 3000 still passes", () => {
  const rule = "origin-rule-one";
  const firstLine = "x".repeat(3000 * 4 - `${rule}: `.length);
  const pack = JSON.stringify({ schemaVersion: 1, name: "forge614-pack-ecosystem-node", version: "1.0.0", title: { es: "t", en: "t" }, rules: [rule] });
  const r = contextBudgetCheck.run(snapshotFrom({ [PACK]: pack, [`standard/rules/${rule}/RULE.md`]: `${firstLine}\n` }), params);
  expect(r.params.tokens).toBe("3000");
  expect(r.verdict).toBe("pass");
});
