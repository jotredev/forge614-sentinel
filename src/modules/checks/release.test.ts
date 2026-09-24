import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { testParams } from "../../../tests/helpers/params";
import { FIXTURES, snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { releaseCheck } from "./release";

// The fixture's release.yml IS the 1.0.0 template (byte-identical), so it
// doubles as the template here; verify.yml's template is the first job only.
const releaseTemplate = readFileSync(resolve(FIXTURES, "release/pass/.github/workflows/release.yml"), "utf8");
const verifyTemplate = `name: verify\non:\n  push: { branches: [main] }\n  pull_request:\njobs:\n  verify:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 10\n    steps:\n      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1\n      - uses: oven-sh/setup-bun@735343b667d3e6f658f44d0eca948eb6282f2b76 # v2.0.2\n        with: { bun-version: "1.4.2" }\n      - run: bun install --frozen-lockfile\n      - run: bun run verify\n`;
const params = testParams({ templates: new Map([["verify.yml", verifyTemplate], ["release.yml", releaseTemplate]]) });

test("passes when both workflows match the template (an allowed extra job is named) and CHANGELOG exists", () => {
  const r = releaseCheck.run(snapshotFromDir("release/pass"), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["verify.yml: extra job 'parity' (allowed; its shape is checked by 'workflows')"]);
});

test("reports a diff path for a changed template job, an unpinned action, a missing workflow and a missing CHANGELOG", () => {
  const r = releaseCheck.run(snapshotFromDir("release/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(
    expect.arrayContaining([
      "verify.yml: jobs.verify.steps[0].uses: expected \"actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5\" got \"actions/checkout@v4\"",
      "verify.yml: jobs.verify.steps[3].run: expected \"bun run verify\" got \"bun run test\"",
      "verify.yml: job verify step 1: uses not pinned to a 40-hex SHA: actions/checkout@v4",
      ".github/workflows/release.yml missing",
      "CHANGELOG.md missing",
    ]),
  );
});

test("an extra job outside the allowed list is a fail naming it", () => {
  const verify = `${verifyTemplate}  deploy:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 5\n    steps:\n      - run: bun run verify\n`;
  const s = snapshotFrom({ ".github/workflows/verify.yml": verify, ".github/workflows/release.yml": releaseTemplate, "CHANGELOG.md": "# Changelog\n" });
  const r = releaseCheck.run(s, params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toContain("verify.yml: extra job 'deploy' is not in the allowed list (parity)");
});
