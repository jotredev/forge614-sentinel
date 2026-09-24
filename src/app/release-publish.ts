import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { writeTextAtomic } from "../infrastructure/fs-write";
import { sha256Hex } from "../infrastructure/hashing";
import { archiveName, TARGETS, type Exec } from "./build-target";

export type ReleasePublishResult =
  | { ok: true; tag: string; version: string; assets: string[]; command: string[]; published: boolean }
  | { ok: false; code: "RELEASE_TAG_MISMATCH" | "RELEASE_ASSETS_MISSING" | "RELEASE_PUBLISH_FAILED"; error: string };

// Mirrors the proven flow of forge614-engram's release workflow, as a script:
// the tag must name package.json's version, all five assets must be present
// (download-artifact merged them into assetsDir), SHA256SUMS is written in
// sha256sum format (what install.sh and install.ps1 parse), and gh publishes
// the assets plus the two installers. Nothing is published on any failure.
export function releasePublish(options: { root: string; tag: string; version: string; assetsDir: string; exec: Exec; dryRun: boolean }): ReleasePublishResult {
  if (options.tag !== `v${options.version}`) {
    return { ok: false, code: "RELEASE_TAG_MISMATCH", error: `tag '${options.tag}' does not name package.json version '${options.version}' (expected 'v${options.version}')` };
  }
  const assets = TARGETS.map((t) => join(options.assetsDir, archiveName(t)));
  const missing = assets.filter((a) => !existsSync(a));
  if (missing.length > 0) return { ok: false, code: "RELEASE_ASSETS_MISSING", error: `missing release assets: ${missing.map((m) => basename(m)).join(", ")}` };

  const sums = TARGETS.map((t) => `${sha256Hex(new Uint8Array(readFileSync(join(options.assetsDir, archiveName(t)))))}  ${archiveName(t)}`).join("\n");
  const sumsPath = join(options.assetsDir, "SHA256SUMS");
  writeTextAtomic(sumsPath, `${sums}\n`);

  const command = [
    "gh", "release", "create", options.tag,
    ...assets, sumsPath,
    `${join(options.root, "install.sh")}#install.sh`,
    `${join(options.root, "install.ps1")}#install.ps1`,
    "--title", options.tag,
    "--notes", `forge614-sentinel ${options.version}. Instala con install.sh (macOS/Linux) o install.ps1 (Windows); huellas en SHA256SUMS.`,
    "--verify-tag",
    ...(options.tag.includes("-") ? ["--prerelease"] : []),
  ];
  if (options.dryRun) return { ok: true, tag: options.tag, version: options.version, assets: [...assets, sumsPath], command, published: false };

  let run: ReturnType<Exec>;
  try {
    run = options.exec(command, { cwd: options.root });
  } catch (error) {
    return { ok: false, code: "RELEASE_PUBLISH_FAILED", error: `gh could not be executed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (run.exitCode !== 0) return { ok: false, code: "RELEASE_PUBLISH_FAILED", error: `gh release create exited ${run.exitCode}: ${run.stderr.trim()}` };
  return { ok: true, tag: options.tag, version: options.version, assets: [...assets, sumsPath], command, published: true };
}
