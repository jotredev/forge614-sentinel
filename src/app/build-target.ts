import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeBytesAtomic } from "../infrastructure/fs-write";
import { sha256Hex } from "../infrastructure/hashing";
import { packTarGz, packZip } from "../infrastructure/packaging";

export const TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "windows-x64"] as const;
export type Target = (typeof TARGETS)[number];

export type Exec = (cmd: string[], options?: { cwd?: string; env?: Record<string, string> }) => { exitCode: number; stdout: string; stderr: string };

export function parseTarget(value: string | undefined): Target | null {
  return TARGETS.find((t) => t === value) ?? null;
}

export function hostTarget(): Target | null {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : process.platform === "win32" ? "windows" : null;
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;
  return os === null || arch === null ? null : parseTarget(`${os}-${arch}`);
}

export function binaryName(target: Target): string {
  return target.startsWith("windows") ? "forge614-sentinel.exe" : "forge614-sentinel";
}

export function archiveName(target: Target): string {
  return `forge614-sentinel-${target}.${target.startsWith("windows") ? "zip" : "tar.gz"}`;
}

export type BuildTargetResult = { ok: true; target: Target; binary: string; archive: string; sha256: string } | { ok: false; code: "BUILD_FAILED"; error: string };

// One target per invocation (release.yml runs one matrix leg per OS with
// FORGE614_TARGET). The binary lands in <outDir>/<target>/ and the release
// asset next to it in <outDir>/, which is what the workflow uploads.
export function buildTarget(options: { root: string; target: Target; outDir: string; exec: Exec }): BuildTargetResult {
  const { target } = options;
  const targetDir = join(options.outDir, target);
  mkdirSync(targetDir, { recursive: true });
  const binary = join(targetDir, binaryName(target));
  const entry = join(options.root, "src/interfaces/cli/main.ts");
  let build: ReturnType<Exec>;
  try {
    build = options.exec(["bun", "build", entry, "--compile", `--target=bun-${target}`, "--outfile", binary], { cwd: options.root });
  } catch (error) {
    return { ok: false, code: "BUILD_FAILED", error: `bun build could not be executed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (build.exitCode !== 0) return { ok: false, code: "BUILD_FAILED", error: `bun build --compile exited ${build.exitCode}: ${build.stderr.trim()}` };

  const bytes = new Uint8Array(readFileSync(binary));
  const archive = join(options.outDir, archiveName(target));
  const packed = target.startsWith("windows") ? packZip({ [binaryName(target)]: bytes }) : packTarGz([{ path: binaryName(target), mode: 0o755, content: bytes }]);
  writeBytesAtomic(archive, packed);
  return { ok: true, target, binary, archive, sha256: sha256Hex(packed) };
}
