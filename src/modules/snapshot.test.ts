import { expect, test } from "bun:test";
import { EMPTY_FACTS, has, hasDirectory, listUnder, read, snapshotFrom } from "./snapshot";

test("snapshotFrom builds a map and defaults to empty facts", () => {
  const s = snapshotFrom({ "README.md": "# x\n", "docs/es/00-a.md": "" });
  expect(read(s, "README.md")).toBe("# x\n");
  expect(read(s, "nope")).toBeUndefined();
  expect(has(s, "docs/es/00-a.md")).toBe(true);
  expect(s.facts).toEqual(EMPTY_FACTS);
});

test("listUnder returns sorted relative paths under a prefix; hasDirectory looks for any file below", () => {
  const s = snapshotFrom({ "docs/es/01-b.md": "", "docs/es/00-a.md": "", "docs/en/00-a.md": "" });
  expect(listUnder(s, "docs/es/")).toEqual(["docs/es/00-a.md", "docs/es/01-b.md"]);
  expect(listUnder(s, "nope/")).toEqual([]);
  expect(hasDirectory(s, "docs/es")).toBe(true);
  expect(hasDirectory(s, "docs")).toBe(true);
  expect(hasDirectory(s, "src")).toBe(false);
});

test("facts can be given partially and are merged over the empty ones", () => {
  const s = snapshotFrom({}, { gitTags: ["v0.1.0"] });
  expect(s.facts.gitTags).toEqual(["v0.1.0"]);
  expect(s.facts.gitAvailable).toBe(false);
  expect(s.facts.executablePaths).toEqual([]);
});
