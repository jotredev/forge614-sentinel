import { expect, test } from "bun:test";
import { compareSemver, highestSemver, parseSemver } from "./semver";

test("parseSemver accepts X.Y.Z only", () => {
  expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
  expect(parseSemver("v1.2.3")).toBeNull();
  expect(parseSemver("1.2")).toBeNull();
});

test("compareSemver orders numerically, not lexically", () => {
  expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
  expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
  expect(compareSemver("0.9.9", "1.0.0")).toBeLessThan(0);
});

test("highestSemver ignores non-semver strings and returns undefined for none", () => {
  expect(highestSemver(["0.1.0", "0.10.0", "0.2.0", "latest"])).toBe("0.10.0");
  expect(highestSemver([])).toBeUndefined();
});
