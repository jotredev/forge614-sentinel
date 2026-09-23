import { expect, test } from "bun:test";
import { caution, fail, notApplicable, pass, worst } from "./check";

test("constructors carry verdict, evidence, key and params", () => {
  expect(pass("layoutOk")).toEqual({ verdict: "pass", evidence: [], messageKey: "layoutOk", params: {} });
  expect(pass("layoutOk", {}, ["layout list source: builtin (standard 1.0.0 ships no layout.json)"]).evidence).toHaveLength(1);
  expect(caution(["x"], "nodePointerUnverifiable")).toMatchObject({ verdict: "caution", evidence: ["x"] });
  expect(fail(["a", "b"], "layoutIncomplete")).toMatchObject({ verdict: "fail", evidence: ["a", "b"] });
  expect(notApplicable("no package.json")).toEqual({ verdict: "not-applicable", evidence: [], messageKey: "notApplicable", params: { reason: "no package.json" } });
});

test("worst ignores not-applicable and ranks fail > caution > pass", () => {
  expect(worst(["pass", "not-applicable"])).toBe("pass");
  expect(worst(["pass", "caution", "not-applicable"])).toBe("caution");
  expect(worst(["caution", "fail"])).toBe("fail");
  expect(worst(["not-applicable"])).toBe("pass");
  expect(worst([])).toBe("pass");
});
