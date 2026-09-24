import { expect, test } from "bun:test";
import { deepDiff } from "./deep-diff";

test("reports scalar, missing and extra differences with JSON paths", () => {
  expect(deepDiff({ a: 1, b: [1, 2], c: { d: "x" } }, { a: 1, b: [1, 3], c: { d: "y" }, e: 1 }, "jobs.verify")).toEqual([
    "jobs.verify.b[1]: expected 2 got 3",
    "jobs.verify.c.d: expected \"x\" got \"y\"",
    "jobs.verify.e: unexpected",
  ]);
  expect(deepDiff({ a: 1 }, {}, "r")).toEqual(["r.a: missing"]);
  expect(deepDiff([1], [1, 2], "r")).toEqual(["r: 2 items vs template 1"]);
  expect(deepDiff({ a: 1 }, { a: 1 }, "r")).toEqual([]);
});
