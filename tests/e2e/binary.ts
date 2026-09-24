import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildTarget, hostTarget } from "../../src/app/build-target";
import { run } from "../../src/infrastructure/process";

const REPO_ROOT = resolve(import.meta.dir, "../..");
let cached: string | undefined;

// One real `bun build --compile` per test process: the e2e suite exercises
// the same artifact release.yml ships, not `bun run` of the sources.
export function builtBinary(): string {
  if (cached !== undefined) return cached;
  const target = hostTarget();
  if (target === null) throw new Error(`unsupported host ${process.platform}-${process.arch}`);
  const outDir = join(tmpdir(), `sentinel-e2e-${process.pid}`);
  const r = buildTarget({ root: REPO_ROOT, target, outDir, exec: (cmd, options) => run(cmd, options ?? {}) });
  if (!r.ok) throw new Error(r.error);
  if (!existsSync(r.binary)) throw new Error(`binary not found at ${r.binary}`);
  cached = r.binary;
  return cached;
}
