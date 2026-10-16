import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releasePublish } from "./release-publish";
import { repoRoot } from "./repo";
import { archiveName, TARGETS, type Exec } from "./build-target";

function assetsDir(missing?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-assets-"));
  for (const t of TARGETS) if (archiveName(t) !== missing) writeFileSync(join(dir, archiveName(t)), `bin-${t}`);
  for (const name of ["install.sh", "install.ps1", "install.mjs", "forge614.node.json", "SHA256SUMS"]) writeFileSync(join(dir, name), `prepared-${name}`);
  return dir;
}

const okExec: Exec = () => ({ exitCode: 0, stdout: "https://github.com/jotredev/forge614-sentinel/releases/tag/v0.1.0\n", stderr: "" });

/** A missing release directory is reported as ten missing assets without invoking gh. */
test("a missing assets directory reports every required asset without invoking gh", () => {
  const dir = join(tmpdir(), `sentinel-assets-missing-${randomUUID()}`);
  const calls: string[][] = [];
  const result = releasePublish({
    root: repoRoot,
    tag: "v0.1.0",
    version: "0.1.0",
    assetsDir: dir,
    exec: (command) => { calls.push(command); return okExec(command); },
    dryRun: false,
  });
  const required = [...TARGETS.map(archiveName), "install.sh", "install.ps1", "install.mjs", "forge614.node.json", "SHA256SUMS"];
  expect(result).toMatchObject({ ok: false, code: "RELEASE_ASSETS_MISSING" });
  if (result.ok) return;
  for (const name of required) expect(result.error).toContain(name);
  expect(calls).toHaveLength(0);
});

test("dry run: publishes all prepared release files without rewriting SHA256SUMS", () => {
  const dir = assetsDir();
  const calls: string[][] = [];
  const r = releasePublish({ root: repoRoot, tag: "v0.1.0", version: "0.1.0", assetsDir: dir, exec: (cmd) => { calls.push(cmd); return okExec(cmd); }, dryRun: true });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(calls).toHaveLength(0);
  expect(r.published).toBe(false);
  expect(r.command.slice(0, 4)).toEqual(["gh", "release", "create", "v0.1.0"]);
  expect(r.command).toContain(join(dir, "install.sh"));
  expect(r.command).toContain(join(dir, "install.ps1"));
  expect(r.command).not.toContain("--prerelease");
  expect(r.assets).toHaveLength(10);
  for (const name of ["install.mjs", "forge614.node.json", "SHA256SUMS"]) expect(r.command).toContain(join(dir, name));
  expect(readFileSync(join(dir, "SHA256SUMS"), "utf8")).toBe("prepared-SHA256SUMS");
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
