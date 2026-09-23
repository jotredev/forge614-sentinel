import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { MAX_TEXT_BYTES } from "../modules/snapshot";

// Used only when the repository is not a git checkout (fixtures, plain
// folders): a git checkout gets its listing from `git ls-files` (git.ts),
// which already honors .gitignore.
const DEFAULT_IGNORE = ["node_modules", "dist", ".git", ".superpowers", "coverage", "build", "out"];

// Extensions treated as text. A file with no extension (or a dotfile such as
// `.gitignore`) is text too; `.env*` files are always text so the secrets
// check can look at them; `pem` and `key` are read so a private key
// committed by mistake reaches the secrets-hygiene check.
const TEXT_EXTENSIONS = new Set(["md", "json", "ts", "js", "mjs", "cjs", "yml", "yaml", "sh", "ps1", "txt", "toml", "lock", "pem", "key"]);

export interface TreeOptions {
  ignore?: readonly string[];
}

export interface TreeRead {
  files: Map<string, string>;
  skippedLargeFiles: string[];
}

export function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function isTextFile(name: string): boolean {
  if (name.startsWith(".env")) return true;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return true;
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

function toPosix(path: string): string {
  return path.split("\\").join("/");
}

function readOne(root: string, rel: string, out: TreeRead): void {
  const full = join(root, rel);
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(full);
  } catch {
    return; // listed by git but missing from the working tree
  }
  if (!stat.isFile()) return; // symlink, directory, socket
  if (stat.size > MAX_TEXT_BYTES) {
    out.skippedLargeFiles.push(rel);
    return;
  }
  out.files.set(rel, normalizeText(readFileSync(full, "utf8")));
}

export function walkTree(root: string, options: TreeOptions = {}): TreeRead {
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.ignore ?? [])]);
  const out: TreeRead = { files: new Map(), skippedLargeFiles: [] };
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (ignore.has(name)) continue;
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && isTextFile(name)) readOne(root, toPosix(relative(root, full)), out);
    }
  };
  walk(root);
  out.skippedLargeFiles.sort();
  return out;
}

export function readListedFiles(root: string, paths: readonly string[]): TreeRead {
  const out: TreeRead = { files: new Map(), skippedLargeFiles: [] };
  for (const rel of [...paths].sort()) {
    const name = rel.split("/").at(-1) ?? rel;
    if (isTextFile(name)) readOne(root, rel, out);
  }
  return out;
}
