import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CHECK_IDS, CHECKS, checkById, NATIVE_CHECK_IDS } from "./index";

const FIXTURES = resolve(import.meta.dir, "../../../fixtures");

test("exactly the 19 checks of spec §8, unique kebab-case ids, in report order", () => {
  expect(CHECK_IDS).toEqual([
    "node-pointer", "layout", "stack", "secrets-hygiene",
    "package-naming", "forbidden-mentions", "docs-parity", "decisions", "agent-checklist-impact", "error-codes",
    "node-contract", "installer", "release", "versions",
    "workflows", "support-matrix", "context-budget", "ecosystem-contract", "rules-catalog",
  ]);
  expect(new Set(CHECK_IDS).size).toBe(19);
  for (const id of CHECK_IDS) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  expect(CHECKS.map((c) => c.id)).toEqual([...CHECK_IDS]);
  expect(checkById("layout")?.id).toBe("layout");
  expect(checkById("nope")).toBeUndefined();
});

test("native ids are a subset of the registry and cover everything the 1.0.0 pack does not name", () => {
  for (const id of NATIVE_CHECK_IDS) expect(CHECK_IDS).toContain(id);
  expect(NATIVE_CHECK_IDS).toEqual(["node-pointer", "layout", "stack", "secrets-hygiene", "node-contract", "installer", "release", "versions", "support-matrix", "ecosystem-contract", "rules-catalog"]);
});

test("every check has pass and fail fixtures", () => {
  for (const id of CHECK_IDS) {
    expect(existsSync(resolve(FIXTURES, id, "pass")), `${id}/pass`).toBe(true);
    expect(existsSync(resolve(FIXTURES, id, "fail")), `${id}/fail`).toBe(true);
  }
});
