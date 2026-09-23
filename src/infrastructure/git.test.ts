import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readGitFacts } from "./git";
import { run } from "./process";

const hasGit = Bun.which("git") !== null;

function gitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "sentinel-git-"));
  const git = (...args: string[]) => run(["git", ...args], { cwd: root, env: { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@x", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@x" } });
  git("init", "-q", "-b", "main");
  mkdirSync(join(root, ".githooks"));
  writeFileSync(join(root, ".githooks/pre-push"), "#!/bin/sh\n");
  writeFileSync(join(root, "README.md"), "# r\n");
  writeFileSync(join(root, ".gitignore"), ".env\n");
  writeFileSync(join(root, ".env"), "SECRET=1\n");
  git("add", ".");
  git("update-index", "--chmod=+x", ".githooks/pre-push");
  git("commit", "-q", "-m", "first commit");
  git("tag", "v0.1.0");
  git("tag", "v0.2.0");
  git("tag", "standard-v1.0.0");
  writeFileSync(join(root, "untracked.md"), "new\n");
  return root;
}

test.skipIf(!hasGit)("reads listing (tracked + untracked, ignoring .gitignore), tags v*, log subjects and executable paths from git modes", () => {
  const facts = readGitFacts(gitRepo());
  expect(facts.available).toBe(true);
  expect(facts.listing).toEqual([".githooks/pre-push", ".gitignore", "README.md", "untracked.md"]);
  expect(facts.tags).toEqual(["v0.1.0", "v0.2.0"]);
  expect(facts.logSubjects).toHaveLength(1);
  expect(facts.logSubjects[0]).toMatch(/^[0-9a-f]{7} first commit$/);
  expect(facts.executablePaths).toEqual([".githooks/pre-push"]);
});

test("a folder that is not a git repository yields available: false and no listing, without throwing", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-nogit-"));
  writeFileSync(join(root, "a.md"), "x");
  const facts = readGitFacts(root);
  expect(facts).toEqual({ available: false, listing: undefined, tags: [], logSubjects: [], executablePaths: [] });
});

test("a missing git binary is handled as unavailable", () => {
  // The .git folder gets readGitFacts past its existsSync guard, so the path
  // exercised is "the git executable cannot be spawned".
  const root = mkdtempSync(join(tmpdir(), "sentinel-nogitbin-"));
  mkdirSync(join(root, ".git"));
  const facts = readGitFacts(root, { git: "definitely-not-a-git-binary" });
  expect(facts).toEqual({ available: false, listing: undefined, tags: [], logSubjects: [], executablePaths: [] });
});
