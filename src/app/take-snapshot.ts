import { readListedFiles, walkTree } from "../infrastructure/fs-tree";
import { readGitFacts } from "../infrastructure/git";
import type { RepoSnapshot } from "../modules/snapshot";

// One snapshot per run (spec §13): the tree is read once and every check
// works on the same picture. A git checkout is listed by git (so ignored
// files, symlinks and submodules stay out); anything else is walked.
export function takeSnapshot(root: string): RepoSnapshot {
  const git = readGitFacts(root);
  const tree = git.listing === undefined ? walkTree(root) : readListedFiles(root, git.listing);
  return {
    files: tree.files,
    facts: {
      gitAvailable: git.available,
      gitTags: git.tags,
      gitLogSubjects: git.logSubjects,
      executablePaths: git.executablePaths,
      skippedLargeFiles: tree.skippedLargeFiles,
    },
  };
}
