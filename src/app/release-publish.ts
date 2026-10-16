import { readdirSync } from "node:fs";
import { join } from "node:path";
import { archiveName, TARGETS, type Exec } from "./build-target";

export type ReleasePublishResult =
  | { ok: true; tag: string; version: string; assets: string[]; command: string[]; published: boolean }
  | { ok: false; code: "RELEASE_TAG_MISMATCH" | "RELEASE_ASSETS_MISSING" | "RELEASE_PUBLISH_FAILED"; error: string };

// Publishes prepared release assets; a missing assets directory is reported as
// the complete missing-asset list, while other directory-read errors propagate.
// The standard template creates SHA256SUMS after staging installers and archives.
export function releasePublish(options: { root: string; tag: string; version: string; assetsDir: string; exec: Exec; dryRun: boolean }): ReleasePublishResult {
  if (options.tag !== `v${options.version}`) {
    return { ok: false, code: "RELEASE_TAG_MISMATCH", error: `tag '${options.tag}' does not name package.json version '${options.version}' (expected 'v${options.version}')` };
  }
  const required = [
    ...TARGETS.map(archiveName),
    "install.sh", "install.ps1", "install.mjs", "forge614.node.json", "SHA256SUMS",
  ];
  const entries = (() => {
    try {
      return readdirSync(options.assetsDir, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  })();
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const missing = required.filter((name) => !names.includes(name));
  if (missing.length > 0) return { ok: false, code: "RELEASE_ASSETS_MISSING", error: `missing release assets: ${missing.join(", ")}` };
  const assets = names.map((name) => join(options.assetsDir, name));

  const command = [
    "gh", "release", "create", options.tag,
    ...assets,
    "--title", options.tag,
    "--notes", `forge614-sentinel ${options.version}. Instala con install.sh (macOS/Linux) o install.ps1 (Windows); huellas en SHA256SUMS.`,
    "--verify-tag",
    ...(options.tag.includes("-") ? ["--prerelease"] : []),
  ];
  if (options.dryRun) return { ok: true, tag: options.tag, version: options.version, assets, command, published: false };

  let run: ReturnType<Exec>;
  try {
    run = options.exec(command, { cwd: options.root });
  } catch (error) {
    return { ok: false, code: "RELEASE_PUBLISH_FAILED", error: `gh could not be executed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (run.exitCode !== 0) return { ok: false, code: "RELEASE_PUBLISH_FAILED", error: `gh release create exited ${run.exitCode}: ${run.stderr.trim()}` };
  return { ok: true, tag: options.tag, version: options.version, assets, command, published: true };
}
