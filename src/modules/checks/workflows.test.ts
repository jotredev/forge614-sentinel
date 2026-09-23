import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { workflowsCheck } from "./workflows";

const params = testParams();
const yml = `name: verify\non:\n  pull_request: {}\njobs:\n  verify:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 10\n    steps:\n      - uses: actions/checkout@34e114876b0b11a390a9f2f37d3e4bb0e8a0a8bb\n      - run: bun run verify\n`;
const doc = "# 04 — Workflows\n\n## verify.yml\n| Job | Disparador |\n| --- | --- |\n| `verify` | pr |\n";

test("pass when every job is documented and thin; fail on undocumented job or missing timeout", () => {
  expect(workflowsCheck.run(snapshotFromDir("workflows/pass"), params).verdict).toBe("pass");
  const r = workflowsCheck.run(snapshotFromDir("workflows/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence[0]).toStartWith("verify.yml: schema: jobs.build.timeout-minutes ");
});

test("bad yaml, missing doc and unknown script are evidence (same strings as forge614-ai)", () => {
  expect(workflowsCheck.run(snapshotFrom({ ".github/workflows/x.yml": "jobs: [", "docs/es/04-workflows.md": doc }), params).evidence[0]).toContain("x.yml: YAML parse error");
  expect(workflowsCheck.run(snapshotFrom({ ".github/workflows/verify.yml": yml }), params).evidence).toEqual([
    "docs/es/NN-workflows.md missing (no file matches docs/es/[0-9][0-9]-workflows.md)",
  ]);
  const pkg = JSON.stringify({ scripts: { verify: "x" } });
  const r = workflowsCheck.run(snapshotFrom({ ".github/workflows/verify.yml": yml.replace("bun run verify", "bun run nope"), "docs/es/04-workflows.md": doc, "package.json": pkg }), params);
  expect(r.evidence).toEqual(["verify.yml: job verify step 2: script 'nope' not found in package.json scripts: bun run nope"]);
});

test("no workflows found is a pass with workflowsNone", () => {
  const r = workflowsCheck.run(snapshotFrom({}), params);
  expect(r.verdict).toBe("pass");
  expect(r.messageKey).toBe("workflowsNone");
});
