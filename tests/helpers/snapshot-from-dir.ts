import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { RepoFacts, RepoSnapshot } from "../../src/modules/snapshot";
import { snapshotFrom } from "../../src/modules/snapshot";

export const FIXTURES = resolve(import.meta.dir, "../../fixtures");

// Test-only loader: reads every file under a fixture folder into a snapshot
// (no git, no ignore rules, CRLF normalized) so a check can be exercised
// against `fixtures/<id>/{pass,fail}/` without going through infrastructure.
export function snapshotFromDir(dir: string, facts: Partial<RepoFacts> = {}): RepoSnapshot {
  const root = resolve(FIXTURES, dir);
  const entries: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else entries[relative(root, full).split("\\").join("/")] = readFileSync(full, "utf8").replace(/\r\n/g, "\n");
    }
  };
  walk(root);
  return snapshotFrom(entries, facts);
}
