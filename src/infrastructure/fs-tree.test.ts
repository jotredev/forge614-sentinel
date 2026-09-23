import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeText, readListedFiles, walkTree } from "./fs-tree";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "sentinel-tree-"));
}

test("walkTree skips node_modules, dist, .git, .superpowers and binaries; includes extensionless and .env* files", () => {
  const root = tmp();
  mkdirSync(join(root, "node_modules/x"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, "hooks"), { recursive: true });
  writeFileSync(join(root, "node_modules/x/a.md"), "no");
  writeFileSync(join(root, ".git/HEAD"), "ref");
  writeFileSync(join(root, "a.md"), "yes");
  writeFileSync(join(root, "img.png"), "bin");
  writeFileSync(join(root, "hooks/pre-push"), "#!/bin/sh\n");
  writeFileSync(join(root, ".env.local"), "KEY=v\n");
  writeFileSync(join(root, "bun.lock"), "{}");
  expect([...walkTree(root).files.keys()].sort()).toEqual([".env.local", "a.md", "bun.lock", "hooks/pre-push"]);
});

test("walkTree normalizes CRLF to LF", () => {
  const root = tmp();
  writeFileSync(join(root, "a.md"), "# T\r\n## A\r\n");
  expect(walkTree(root).files.get("a.md")).toBe("# T\n## A\n");
  expect(normalizeText("a\r\nb\rc\n")).toBe("a\nb\rc\n");
});

// Creating symlinks on Windows needs developer mode or admin rights; the
// behavior under test (lstat, never follow) is the same code path there.
test.skipIf(process.platform === "win32")("walkTree skips symlinks (never follows them) and lists files above MAX_TEXT_BYTES", () => {
  const root = tmp();
  writeFileSync(join(root, "real.md"), "x");
  symlinkSync(join(root, "real.md"), join(root, "link.md"));
  mkdirSync(join(root, "outside"));
  symlinkSync(join(root, "outside"), join(root, "dir-link"));
  writeFileSync(join(root, "big.json"), "x".repeat(2 * 1024 * 1024 + 1));
  const tree = walkTree(root);
  expect([...tree.files.keys()].sort()).toEqual(["real.md"]);
  expect(tree.skippedLargeFiles).toEqual(["big.json"]);
});

test("walkTree reads .pem and .key files as text so secrets-hygiene can see a committed private key", () => {
  const root = tmp();
  writeFileSync(join(root, "server.pem"), "-----BEGIN X-----\n");
  writeFileSync(join(root, "client.key"), "k\n");
  expect([...walkTree(root).files.keys()].sort()).toEqual(["client.key", "server.pem"]);
});

test("readListedFiles reads only the given paths, skips a listed file missing from disk and uses / separators", () => {
  const root = tmp();
  mkdirSync(join(root, "docs/es"), { recursive: true });
  writeFileSync(join(root, "docs/es/00-a.md"), "a\r\n");
  writeFileSync(join(root, "other.md"), "o");
  const tree = readListedFiles(root, ["docs/es/00-a.md", "deleted.md", "img.png"]);
  expect([...tree.files.entries()]).toEqual([["docs/es/00-a.md", "a\n"]]);
});
