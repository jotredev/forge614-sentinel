import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyRepository } from "./classify-repository";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
const pointer = { schemaVersion: 1 as const, node: "demo", kind: "product" as const, standard: { version: "1.0.0", sha256: SHA }, ecosystem: "forge614" };

function folder(): string {
  return mkdtempSync(join(tmpdir(), "sentinel-classify-"));
}

test("a valid forge614.node.json makes a node, regardless of folder name or remotes", () => {
  const root = folder();
  writeFileSync(join(root, "forge614.node.json"), JSON.stringify(pointer));
  expect(classifyRepository(root)).toEqual({ kind: "node", pointer });
});

test(".forge614/project.json without a pointer is an external project", () => {
  const root = folder();
  mkdirSync(join(root, ".forge614"));
  writeFileSync(join(root, ".forge614/project.json"), "{}");
  expect(classifyRepository(root)).toEqual({ kind: "external-project" });
});

// The folder holds a subfolder without read permission: any walk of the
// tree would throw EACCES, so a clean answer proves classification never
// lists the folder. POSIX permissions only, hence the Windows skip.
test.skipIf(process.platform === "win32")("neither identity file is not a forge614 repo, and the tree is not read", () => {
  const root = folder();
  const locked = join(root, "huge");
  mkdirSync(locked);
  writeFileSync(join(locked, "x.md"), "x");
  chmodSync(locked, 0o000);
  try {
    expect(() => readdirSync(locked)).toThrow();
    expect(classifyRepository(root)).toEqual({ kind: "not-a-forge614-repo" });
  } finally {
    chmodSync(locked, 0o755);
  }
});

test("a pointer that fails NodePointerSchema is invalid-pointer with the issues, never a throw", () => {
  const root = folder();
  writeFileSync(join(root, "forge614.node.json"), JSON.stringify({ ...pointer, kind: "tool", extra: 1 }));
  const r = classifyRepository(root);
  expect(r.kind).toBe("invalid-pointer");
  if (r.kind !== "invalid-pointer") return;
  expect(r.error).toContain("kind");
  writeFileSync(join(root, "forge614.node.json"), "{ not json");
  expect(classifyRepository(root).kind).toBe("invalid-pointer");
});

test("the pointer wins over .forge614/project.json when both exist", () => {
  const root = folder();
  mkdirSync(join(root, ".forge614"));
  writeFileSync(join(root, ".forge614/project.json"), "{}");
  writeFileSync(join(root, "forge614.node.json"), JSON.stringify(pointer));
  expect(classifyRepository(root).kind).toBe("node");
});
