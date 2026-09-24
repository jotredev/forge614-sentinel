import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractTarGz } from "../infrastructure/archive";
import { sha256File } from "../infrastructure/hashing";
import { archiveName, binaryName, buildTarget, hostTarget, parseTarget, TARGETS, type Exec } from "./build-target";
import { repoRoot } from "./repo";

test("parseTarget accepts the five targets only; hostTarget maps this machine", () => {
  for (const t of TARGETS) expect(parseTarget(t)).toBe(t);
  expect(parseTarget("linux-x86")).toBeNull();
  expect(parseTarget(undefined)).toBeNull();
  expect(hostTarget() === null || TARGETS.includes(hostTarget() as (typeof TARGETS)[number])).toBe(true);
  expect(binaryName("windows-x64")).toBe("forge614-sentinel.exe");
  expect(archiveName("windows-x64")).toBe("forge614-sentinel-windows-x64.zip");
  expect(archiveName("linux-arm64")).toBe("forge614-sentinel-linux-arm64.tar.gz");
});

test("invokes bun build --compile with the right target and packages the result", () => {
  const outDir = mkdtempSync(join(tmpdir(), "sentinel-build-"));
  const calls: string[][] = [];
  // Fake compiler: records the command and writes a fake binary where --outfile says.
  const exec: Exec = (cmd) => {
    calls.push(cmd);
    const outfile = cmd[cmd.indexOf("--outfile") + 1] ?? "";
    writeFileSync(outfile, "#!/bin/sh\necho fake\n");
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const r = buildTarget({ root: repoRoot, target: "linux-arm64", outDir, exec });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(calls[0]?.slice(0, 5)).toEqual(["bun", "build", join(repoRoot, "src/interfaces/cli/main.ts"), "--compile", "--target=bun-linux-arm64"]);
  expect(r.binary).toBe(join(outDir, "linux-arm64", "forge614-sentinel"));
  expect(r.archive).toBe(join(outDir, "forge614-sentinel-linux-arm64.tar.gz"));
  expect(existsSync(r.archive)).toBe(true);
  expect(r.sha256).toBe(sha256File(r.archive));
  const members = extractTarGz(new Uint8Array(readFileSync(r.archive)));
  expect(members.map((m) => [m.path, m.mode])).toEqual([["forge614-sentinel", 0o755]]);
});

test("a failing compiler is BUILD_FAILED with its stderr", () => {
  const outDir = mkdtempSync(join(tmpdir(), "sentinel-build-"));
  const exec: Exec = () => ({ exitCode: 1, stdout: "", stderr: "error: cannot compile" });
  expect(buildTarget({ root: repoRoot, target: "darwin-arm64", outDir, exec })).toMatchObject({ ok: false, code: "BUILD_FAILED" });
});
