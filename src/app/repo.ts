import { resolve } from "node:path";

// This file lives at <repo>/src/app/repo.ts, so two levels up is the repo
// root. Used only by the development CLIs (verify, workflows, release
// scripts); `check` never assumes it runs inside this repository.
export const repoRoot = resolve(import.meta.dir, "../..");
