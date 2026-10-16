// The unit of work of every check: a read-only, in-memory picture of the
// repository. Paths always use "/" and are relative to the repository root;
// text is always LF-normalized (infrastructure does both), so a check never
// sees a platform difference.
export interface RepoFacts {
  readonly gitAvailable: boolean;
  readonly gitTags: readonly string[];
  readonly gitLogSubjects: readonly string[];
  readonly executablePaths: readonly string[];
  readonly skippedLargeFiles: readonly string[];
}

export interface RepoSnapshot {
  readonly files: ReadonlyMap<string, string>;
  /** Original file bytes, retained for checks where line-ending normalization is unsafe. */
  readonly rawFiles?: ReadonlyMap<string, Uint8Array>;
  readonly facts: RepoFacts;
}

export const EMPTY_FACTS: RepoFacts = {
  gitAvailable: false,
  gitTags: [],
  gitLogSubjects: [],
  executablePaths: [],
  skippedLargeFiles: [],
};

// Text files above this size are not loaded (a generated fixture or a data
// dump would otherwise dominate the run); they are listed in facts instead.
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export function snapshotFrom(entries: Record<string, string>, facts: Partial<RepoFacts> = {}): RepoSnapshot {
  return { files: new Map(Object.entries(entries)), rawFiles: new Map(Object.entries(entries).map(([path, text]) => [path, new TextEncoder().encode(text)])), facts: { ...EMPTY_FACTS, ...facts } };
}

export function read(snapshot: RepoSnapshot, path: string): string | undefined {
  return snapshot.files.get(path);
}

/** Returns raw bytes when available, or UTF-8 bytes for synthetic snapshots. */
export function readRaw(snapshot: RepoSnapshot, path: string): Uint8Array | undefined {
  const raw = snapshot.rawFiles?.get(path);
  if (raw !== undefined) return raw;
  const text = snapshot.files.get(path);
  return text === undefined ? undefined : new TextEncoder().encode(text);
}

export function has(snapshot: RepoSnapshot, path: string): boolean {
  return snapshot.files.has(path);
}

export function listUnder(snapshot: RepoSnapshot, prefix: string): string[] {
  return [...snapshot.files.keys()].filter((p) => p.startsWith(prefix)).sort();
}

export function hasDirectory(snapshot: RepoSnapshot, dir: string): boolean {
  const prefix = dir.endsWith("/") ? dir : `${dir}/`;
  for (const path of snapshot.files.keys()) if (path.startsWith(prefix)) return true;
  return false;
}
