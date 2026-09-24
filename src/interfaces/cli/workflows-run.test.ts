import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { run } from "../../infrastructure/process";

const CLI = resolve(import.meta.dir, "workflows-run.ts");
const REPO_ROOT = resolve(import.meta.dir, "../../..");

test("--help prints the usage; an unknown workflow is WORKFLOW_NOT_FOUND with exit 1", () => {
  expect(JSON.parse(run(["bun", "run", CLI, "--help"], { cwd: REPO_ROOT }).stdout.trim())).toEqual({ schemaVersion: 1, usage: "workflows-run [--workflow <name>]" });
  const r = run(["bun", "run", CLI, "--workflow", "nope"], { cwd: REPO_ROOT });
  expect(r.exitCode).toBe(1);
  expect(JSON.parse(r.stderr.trim())).toMatchObject({ schemaVersion: 1, code: "WORKFLOW_NOT_FOUND" });
});
