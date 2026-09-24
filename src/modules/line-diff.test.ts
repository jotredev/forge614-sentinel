import { expect, test } from "bun:test";
import { lineDiff } from "./line-diff";

test("reports the first differing lines with expected/actual and the length difference", () => {
  expect(lineDiff("a\nb\nc\n", "a\nB\nc\n", "install.sh")).toEqual(["install.sh:2: expected 'b' got 'B'"]);
  expect(lineDiff("a\nb\n", "a\nb\nc\n", "x")).toEqual(["x: 3 lines vs template 2"]);
  expect(lineDiff("a\n", "a\n", "x")).toEqual([]);
});

test("a final newline that is missing or extra is reported: the installer must match the template byte for byte", () => {
  expect(lineDiff("a\n", "a", "x")).toEqual(["x: final newline differs from template"]);
  expect(lineDiff("a", "a\n", "x")).toEqual(["x: final newline differs from template"]);
});

test("truncates long lines and stops after the limit", () => {
  const expected = Array.from({ length: 10 }, (_, i) => `l${i}`).join("\n");
  const actual = Array.from({ length: 10 }, (_, i) => `L${i}`).join("\n");
  expect(lineDiff(expected, actual, "x", 3)).toHaveLength(4);
  expect(lineDiff(expected, actual, "x", 3)[3]).toBe("x: 7 more differing lines");
  expect(lineDiff("a".repeat(200), "b".repeat(200), "x")[0]?.length).toBeLessThan(200);
});
