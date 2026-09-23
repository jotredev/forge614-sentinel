import { existsSync } from "node:fs";
import { join } from "node:path";
import { run } from "./process";

export interface GitFacts {
  available: boolean;
  // Every path git knows about (tracked, plus untracked files not ignored),
  // "/"-separated; undefined when git is unavailable so the caller walks the
  // disk instead.
  listing: string[] | undefined;
  tags: string[];
  logSubjects: string[];
  executablePaths: string[];
}

const UNAVAILABLE: GitFacts = { available: false, listing: undefined, tags: [], logSubjects: [], executablePaths: [] };
const LOG_LIMIT = 50;

// All commands are read-only and bounded by a timeout; Sentinel never writes
// to the repository it inspects. Modes come from the index (100755), never
// from the disk, so Windows reports the same executables as macOS.
export function readGitFacts(root: string, options: { timeoutMs?: number; git?: string } = {}): GitFacts {
  if (!existsSync(join(root, ".git"))) return UNAVAILABLE;
  const git = options.git ?? "git";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const exec = (...args: string[]) => {
    try {
      return run([git, "-c", "core.quotepath=off", ...args], { cwd: root, timeoutMs });
    } catch {
      return { exitCode: 127, stdout: "", stderr: "git could not be executed" };
    }
  };

  const staged = exec("ls-files", "-z", "--stage");
  if (staged.exitCode !== 0) return UNAVAILABLE;
  const listing = new Set<string>();
  const executablePaths: string[] = [];
  for (const record of staged.stdout.split("\0")) {
    if (record === "") continue;
    // "<mode> <object> <stage>\t<path>"
    const tab = record.indexOf("\t");
    const meta = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    const mode = meta[0] ?? "";
    if (mode === "120000" || mode === "160000") continue; // symlink, submodule
    listing.add(path);
    if (mode === "100755") executablePaths.push(path);
  }

  const untracked = exec("ls-files", "-z", "--others", "--exclude-standard");
  if (untracked.exitCode === 0) for (const path of untracked.stdout.split("\0")) if (path !== "") listing.add(path);

  const tags = exec("tag", "--list", "v*");
  const log = exec("log", `-n${LOG_LIMIT}`, "--format=%h %s");

  return {
    available: true,
    listing: [...listing].sort(),
    tags: tags.exitCode === 0 ? tags.stdout.split("\n").filter((t) => t !== "").sort() : [],
    logSubjects: log.exitCode === 0 ? log.stdout.split("\n").filter((l) => l !== "") : [],
    executablePaths: executablePaths.sort(),
  };
}
