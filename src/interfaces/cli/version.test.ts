import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { run } from "../../infrastructure/process";
import { PRODUCT_NAME, SENTINEL_VERSION } from "./version";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const VersionEnvelope = z.object({ schemaVersion: z.literal(1), name: z.literal(PRODUCT_NAME), version: z.literal(SENTINEL_VERSION) }).strict();

// Every entry point in this folder answers --version before anything else.
const HELPERS = new Set(["output.ts", "version.ts", "args.ts", "codes.ts"]);
const CLIS = readdirSync(import.meta.dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts") && !HELPERS.has(n)).sort();

describe("--version in every CLI", () => {
  // check.ts arrives first (this task); standard-fetch.ts, main.ts and the
  // development CLIs join the list as their tasks add them.
  test("there are entry points to check", () => expect(CLIS.length).toBeGreaterThan(0));
  for (const cli of CLIS) {
    test(`${cli} --version exits 0 with { schemaVersion, name, version }`, () => {
      const r = run(["bun", "run", resolve(import.meta.dir, cli), "--version"], { cwd: REPO_ROOT });
      expect(r.exitCode, r.stderr).toBe(0);
      expect(r.stderr).toBe("");
      expect(VersionEnvelope.safeParse(JSON.parse(r.stdout.trim())).success).toBe(true);
    });
  }
});
