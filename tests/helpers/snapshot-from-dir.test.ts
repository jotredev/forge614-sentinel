import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshotFromDir } from "./snapshot-from-dir";

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "snapshot-from-dir-"));
  mkdirSync(join(dir, "docs", "es"), { recursive: true });
  writeFileSync(join(dir, "docs", "es", "00-a.md"), "# a\r\n\r\n## b\r\n", "utf8");
  writeFileSync(join(dir, "README.md"), "# x\n", "utf8");
  return dir;
}

test("loads every file under the folder with / separators and LF-normalized text", () => {
  const s = snapshotFromDir(makeDir());
  expect([...s.files.keys()]).toEqual(["README.md", "docs/es/00-a.md"]);
  expect(s.files.get("docs/es/00-a.md")).toBe("# a\n\n## b\n");
});

test("facts default to empty and can be given partially", () => {
  const s = snapshotFromDir(makeDir(), { gitTags: ["v0.1.0"] });
  expect(s.facts.gitTags).toEqual(["v0.1.0"]);
  expect(s.facts.gitAvailable).toBe(false);
});
