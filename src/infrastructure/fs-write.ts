import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function writeTextAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content, { encoding: "utf8", mode: 0o644 });
  renameSync(tmp, path);
}

export function writeBytesAtomic(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, bytes, { mode: 0o644 });
  renameSync(tmp, path);
}

// Writes every file under tmpDir (created fresh), then renames tmpDir to
// finalDir in one step: a reader never sees a half-written cache entry.
// An existing finalDir is replaced only after the new tree is complete.
export function writeTreeAtomic(finalDir: string, files: ReadonlyMap<string, Uint8Array>, tmpDir: string): void {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  for (const [rel, bytes] of files) {
    const target = join(tmpDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { mode: 0o644 });
  }
  rmSync(finalDir, { recursive: true, force: true });
  mkdirSync(dirname(finalDir), { recursive: true });
  renameSync(tmpDir, finalDir);
}
