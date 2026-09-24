import { expect, test } from "bun:test";
import { join } from "node:path";
import { smokeTarget } from "./smoke-target";
import { repoRoot } from "./repo";
import type { Exec } from "./build-target";

function fakeBinary(version: string, verdict: string): Exec {
  return (cmd) => {
    if (cmd.includes("--version")) return { exitCode: 0, stdout: `${JSON.stringify({ schemaVersion: 1, name: "forge614-sentinel", version })}\n`, stderr: "" };
    if (cmd.includes("--help")) return { exitCode: 0, stdout: `${JSON.stringify({ schemaVersion: 1, usage: "x" })}\n`, stderr: "" };
    return { exitCode: verdict === "pass" ? 0 : 1, stdout: `${JSON.stringify({ schemaVersion: 1, verdict, checks: [] })}\n`, stderr: "" };
  };
}

test("runs --version, --help and check on fixtures/pass-node with an isolated FORGE614_HOME", () => {
  const r = smokeTarget({ root: repoRoot, target: "linux-x64", outDir: "/tmp/out", expectedVersion: "0.1.0", exec: fakeBinary("0.1.0", "pass") });
  expect(r).toEqual({ ok: true, target: "linux-x64", version: "0.1.0", steps: ["--version", "--help", "check fixtures/pass-node"] });
});

test("a version mismatch or a non-pass verdict is SMOKE_FAILED", () => {
  expect(smokeTarget({ root: repoRoot, target: "linux-x64", outDir: "/tmp/out", expectedVersion: "0.1.0", exec: fakeBinary("0.0.1", "pass") })).toMatchObject({ ok: false, code: "SMOKE_FAILED" });
  expect(smokeTarget({ root: repoRoot, target: "linux-x64", outDir: "/tmp/out", expectedVersion: "0.1.0", exec: fakeBinary("0.1.0", "fail") })).toMatchObject({ ok: false, code: "SMOKE_FAILED" });
});

test("the binary path is <outDir>/<target>/<binaryName>", () => {
  const seen: string[] = [];
  const exec: Exec = (cmd) => {
    seen.push(cmd[0] ?? "");
    return fakeBinary("0.1.0", "pass")(cmd);
  };
  smokeTarget({ root: repoRoot, target: "windows-x64", outDir: "/tmp/out", expectedVersion: "0.1.0", exec });
  expect(seen[0]).toBe(join("/tmp/out", "windows-x64", "forge614-sentinel.exe"));
});
