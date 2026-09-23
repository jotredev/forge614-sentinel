import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTextAtomic, writeTreeAtomic } from "./fs-write";

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

test("writes content and creates missing parent directories", () => {
  dir = mkdtempSync(join(tmpdir(), "fs-write-"));
  const target = join(dir, "nested", "file.txt");
  writeTextAtomic(target, "hello");
  expect(readFileSync(target, "utf8")).toBe("hello");
});

test("leaves no temp file behind after a successful write", () => {
  dir = mkdtempSync(join(tmpdir(), "fs-write-"));
  const target = join(dir, "file.txt");
  writeTextAtomic(target, "content");
  const entries = readdirSync(dir);
  expect(entries).toEqual(["file.txt"]);
});

test("overwrites an existing file atomically", () => {
  dir = mkdtempSync(join(tmpdir(), "fs-write-"));
  const target = join(dir, "file.txt");
  writeTextAtomic(target, "first");
  writeTextAtomic(target, "second");
  expect(existsSync(target)).toBe(true);
  expect(readFileSync(target, "utf8")).toBe("second");
});

test("writeBytesAtomic writes binary content verbatim and leaves no temp file behind", async () => {
  const { writeBytesAtomic } = await import("./fs-write");
  dir = mkdtempSync(join(tmpdir(), "fs-write-"));
  const target = join(dir, "nested", "blob.bin");
  const bytes = new Uint8Array([0x1f, 0x8b, 0x00, 0xff, 0x80, 0x7f]);
  writeBytesAtomic(target, bytes);
  expect(new Uint8Array(readFileSync(target))).toEqual(bytes);
  expect(readdirSync(join(dir, "nested"))).toEqual(["blob.bin"]);
});

test("writeTreeAtomic leaves the final dir complete and no temp dir behind", () => {
  dir = mkdtempSync(join(tmpdir(), "fs-write-tree-"));
  const files = new Map<string, Uint8Array>([["a/b.txt", new TextEncoder().encode("b")], ["c.txt", new TextEncoder().encode("c")]]);
  writeTreeAtomic(join(dir, "final"), files, join(dir, "final.tmp"));
  expect(readFileSync(join(dir, "final/a/b.txt"), "utf8")).toBe("b");
  expect(readdirSync(dir)).toEqual(["final"]);
  // replacing an existing tree drops files that are no longer present
  writeTreeAtomic(join(dir, "final"), new Map([["only.txt", new TextEncoder().encode("1")]]), join(dir, "final.tmp"));
  expect(readdirSync(join(dir, "final"))).toEqual(["only.txt"]);
});
