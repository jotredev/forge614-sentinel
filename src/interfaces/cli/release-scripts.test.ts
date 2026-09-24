import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { run } from "../../infrastructure/process";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const cli = (name: string, args: string[], env: Record<string, string> = {}) => run(["bun", "run", resolve(import.meta.dir, name), ...args], { cwd: REPO_ROOT, env });

test("build:target and smoke:target need a valid target (flag or FORGE614_TARGET)", () => {
  for (const name of ["build-target.ts", "smoke-target.ts"]) {
    expect(cli(name, ["--help"]).exitCode).toBe(0);
    const r = cli(name, [], { FORGE614_TARGET: "" });
    expect(r.exitCode).toBe(2);
    expect(JSON.parse(r.stderr.trim())).toMatchObject({ code: "INVALID_ARGUMENTS" });
    expect(cli(name, ["--target", "linux-x86"]).exitCode).toBe(2);
  }
});

test("release:publish --dry-run without assets is RELEASE_ASSETS_MISSING; without a tag is INVALID_ARGUMENTS", () => {
  expect(JSON.parse(cli("release-publish.ts", ["--tag", "v0.1.0", "--dry-run"], { GITHUB_REF_NAME: "" }).stderr.trim())).toMatchObject({ code: "RELEASE_ASSETS_MISSING" });
  expect(cli("release-publish.ts", ["--dry-run"], { GITHUB_REF_NAME: "" }).exitCode).toBe(2);
});
