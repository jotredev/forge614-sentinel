import { expect, test } from "bun:test";
import { checkOwnWorkflows } from "./check-own-workflows";
import { repoRoot } from "./repo";

test("this repository's workflows are thin, pinned and documented", () => {
  const r = checkOwnWorkflows(repoRoot, "0.1.0");
  expect(r.evidence).toEqual([]);
  expect(r.verdict).toBe("pass");
});
