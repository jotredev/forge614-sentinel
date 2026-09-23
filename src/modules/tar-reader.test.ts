import { expect, test } from "bun:test";
import { parseUstar } from "./tar-reader";
import { buildUstarArchive } from "./tar";

const enc = new TextEncoder();
const dec = new TextDecoder();

test("round-trips files and directories written by the ecosystem's own ustar writer", () => {
  const archive = buildUstarArchive([
    { path: "VERSION", mode: 0o644, content: enc.encode("1.0.0\n") },
    { path: "rules/", mode: 0o755 },
    { path: "rules/RULE.md", mode: 0o644, content: enc.encode("# rule\n".repeat(100)) },
    { path: "run.sh", mode: 0o755, content: enc.encode("#!/bin/sh\n") },
    { path: "empty.txt", mode: 0o644, content: new Uint8Array() },
  ]);
  const members = parseUstar(archive);
  expect(members.map((m) => m.path)).toEqual(["VERSION", "rules/", "rules/RULE.md", "run.sh", "empty.txt"]);
  expect(members[1]?.content).toBeUndefined();
  expect(members[1]?.mode).toBe(0o755);
  expect(dec.decode(members[2]?.content)).toBe("# rule\n".repeat(100));
  expect(members[3]?.mode).toBe(0o755);
  expect(members[4]?.content?.length).toBe(0);
});

test("a content length that is an exact multiple of 512 needs no padding block", () => {
  const archive = buildUstarArchive([{ path: "a", mode: 0o644, content: new Uint8Array(1024).fill(7) }, { path: "b", mode: 0o644, content: enc.encode("b") }]);
  const members = parseUstar(archive);
  expect(members.map((m) => m.path)).toEqual(["a", "b"]);
  expect(members[0]?.content?.length).toBe(1024);
});

test("rejects a corrupted header checksum and a bad magic", () => {
  const archive = buildUstarArchive([{ path: "a", mode: 0o644, content: enc.encode("x") }]);
  const flipped = new Uint8Array(archive);
  flipped[0] = 0x62; // "a" → "b" without recomputing the checksum
  expect(() => parseUstar(flipped)).toThrow(/checksum/);
  const noMagic = new Uint8Array(archive);
  noMagic.set(enc.encode("gnu\0\0\0"), 257);
  expect(() => parseUstar(noMagic)).toThrow(/magic/);
});

test("rejects unsafe member paths (absolute, parent traversal)", () => {
  for (const bad of ["../x", "a/../../x", "/etc/passwd"]) {
    const archive = buildUstarArchive([{ path: bad, mode: 0o644, content: enc.encode("x") }]);
    expect(() => parseUstar(archive), bad).toThrow(/unsafe/);
  }
});

test("an empty archive (only end blocks) yields no members; a truncated one throws", () => {
  expect(parseUstar(new Uint8Array(1024))).toEqual([]);
  const archive = buildUstarArchive([{ path: "a", mode: 0o644, content: enc.encode("x".repeat(600)) }]);
  expect(() => parseUstar(archive.subarray(0, 700))).toThrow(/truncated/);
});
