import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { run } from "../../infrastructure/process";

const CLI = resolve(import.meta.dir, "main.ts");
const REPO_ROOT = resolve(import.meta.dir, "../../..");

test("no command or --help prints usage and exits 0; an unknown command is INVALID_ARGUMENTS", () => {
  expect(JSON.parse(run(["bun", "run", CLI], { cwd: REPO_ROOT }).stdout.trim())).toMatchObject({ schemaVersion: 1, commands: ["check", "standard fetch", "update", "uninstall"] });
  expect(run(["bun", "run", CLI, "--help"], { cwd: REPO_ROOT }).exitCode).toBe(0);
  const r = run(["bun", "run", CLI, "chek"], { cwd: REPO_ROOT });
  expect(r.exitCode).toBe(2);
  expect(JSON.parse(r.stderr.trim())).toMatchObject({ code: "INVALID_ARGUMENTS" });
});

test("dispatches to check and standard fetch (their --help)", () => {
  expect(JSON.parse(run(["bun", "run", CLI, "check", "--help"], { cwd: REPO_ROOT }).stdout.trim()).usage).toStartWith("check ");
  expect(JSON.parse(run(["bun", "run", CLI, "standard", "fetch", "--help"], { cwd: REPO_ROOT }).stdout.trim()).usage).toStartWith("standard fetch");
});

test("uninstall --self reports no integrations to remove without contacting the installer", () => {
  const json = run(["bun", "run", CLI, "uninstall", "--self", "--json"], { cwd: REPO_ROOT });
  expect(json.exitCode).toBe(0);
  expect(JSON.parse(json.stdout.trim())).toEqual({ schemaVersion: 1, result: { integrationsRemoved: true } });
  expect(json.stderr).toBe("");
  const text = run(["bun", "run", CLI, "uninstall", "--self"], { cwd: REPO_ROOT });
  expect(text.exitCode).toBe(0);
  expect(text.stdout).toContain("no tiene integraciones");
});
