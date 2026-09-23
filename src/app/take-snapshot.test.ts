import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../infrastructure/process";
import { takeSnapshot } from "./take-snapshot";

const hasGit = Bun.which("git") !== null;

test("without git: walks the disk, facts are empty", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-snap-"));
  mkdirSync(join(root, "node_modules/x"), { recursive: true });
  writeFileSync(join(root, "node_modules/x/a.md"), "no");
  writeFileSync(join(root, "a.md"), "a\r\n");
  const s = takeSnapshot(root);
  expect([...s.files.entries()]).toEqual([["a.md", "a\n"]]);
  expect(s.facts.gitAvailable).toBe(false);
});

test.skipIf(!hasGit)("with git: honors .gitignore and reports executables and tags", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-snap-git-"));
  const env = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@x", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@x" };
  run(["git", "init", "-q", "-b", "main"], { cwd: root });
  writeFileSync(join(root, ".gitignore"), "ignored.md\n");
  writeFileSync(join(root, "ignored.md"), "x");
  writeFileSync(join(root, "run.sh"), "#!/bin/sh\n");
  writeFileSync(join(root, "README.md"), "# r\n");
  run(["git", "add", "."], { cwd: root });
  run(["git", "update-index", "--chmod=+x", "run.sh"], { cwd: root });
  run(["git", "commit", "-q", "-m", "init"], { cwd: root, env });
  run(["git", "tag", "v0.1.0"], { cwd: root });
  const s = takeSnapshot(root);
  expect([...s.files.keys()]).toEqual([".gitignore", "README.md", "run.sh"]);
  expect(s.facts).toMatchObject({ gitAvailable: true, gitTags: ["v0.1.0"], executablePaths: ["run.sh"] });
});
