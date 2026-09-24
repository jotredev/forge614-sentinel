import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releasePublish } from "./release-publish";
import { repoRoot } from "./repo";
import { archiveName, TARGETS, type Exec } from "./build-target";

function assetsDir(missing?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-assets-"));
  for (const t of TARGETS) if (archiveName(t) !== missing) writeFileSync(join(dir, archiveName(t)), `bin-${t}`);
  return dir;
}

const okExec: Exec = () => ({ exitCode: 0, stdout: "https://github.com/jotredev/forge614-sentinel/releases/tag/v0.1.0\n", stderr: "" });

test("dry run: writes SHA256SUMS (sha256sum format) and returns the gh command without executing", () => {
  const dir = assetsDir();
  const calls: string[][] = [];
  const r = releasePublish({ root: repoRoot, tag: "v0.1.0", version: "0.1.0", assetsDir: dir, exec: (cmd) => { calls.push(cmd); return okExec(cmd); }, dryRun: true });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(calls).toHaveLength(0);
  expect(r.published).toBe(false);
  expect(r.command.slice(0, 4)).toEqual(["gh", "release", "create", "v0.1.0"]);
  expect(r.command).toContain(`${join(repoRoot, "install.sh")}#install.sh`);
  expect(r.command).toContain(`${join(repoRoot, "install.ps1")}#install.ps1`);
  expect(r.command).not.toContain("--prerelease");
  const sums = readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n");
  expect(sums).toHaveLength(5);
  for (const line of sums) expect(line).toMatch(/^[a-f0-9]{64}  forge614-sentinel-[a-z0-9-]+\.(tar\.gz|zip)$/);
});

test("tag must be v<package.json version>; a missing asset aborts before gh; a failing gh is RELEASE_PUBLISH_FAILED; a hyphenated tag is a prerelease", () => {
  expect(releasePublish({ root: repoRoot, tag: "v0.2.0", version: "0.1.0", assetsDir: assetsDir(), exec: okExec, dryRun: true })).toMatchObject({ ok: false, code: "RELEASE_TAG_MISMATCH" });
  expect(releasePublish({ root: repoRoot, tag: "v0.1.0", version: "0.1.0", assetsDir: assetsDir("forge614-sentinel-windows-x64.zip"), exec: okExec, dryRun: true })).toMatchObject({ ok: false, code: "RELEASE_ASSETS_MISSING" });
  const failing: Exec = () => ({ exitCode: 1, stdout: "", stderr: "release v0.1.0 already exists" });
  const r = releasePublish({ root: repoRoot, tag: "v0.1.0", version: "0.1.0", assetsDir: assetsDir(), exec: failing, dryRun: false });
  expect(r).toMatchObject({ ok: false, code: "RELEASE_PUBLISH_FAILED" });
  if (r.ok) return;
  expect(r.error).toContain("already exists");
  const pre = releasePublish({ root: repoRoot, tag: "v0.2.0-rc.1", version: "0.2.0-rc.1", assetsDir: assetsDir(), exec: okExec, dryRun: true });
  expect(pre.ok && pre.command.includes("--prerelease")).toBe(true);
});
