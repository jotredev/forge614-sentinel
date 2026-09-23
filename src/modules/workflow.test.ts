import { describe, expect, test } from "bun:test";
import { WorkflowSchema, checkWorkflowShape, jobsOf, runStepsOf } from "./workflow";

const good = {
  name: "verify",
  on: { pull_request: {} },
  jobs: {
    verify: {
      "runs-on": "ubuntu-24.04",
      "timeout-minutes": 10,
      steps: [
        { uses: "actions/checkout@34e114876b0b11390a9f2f37d3e4bb0e8a0a8bb # v4.3.1" },
        { run: "bun install --frozen-lockfile" },
        { run: "bun run verify", env: { A: "1" } },
      ],
    },
  },
};

describe("thin workflow rules", () => {
  test("schema accepts good workflow and rejects steps with both uses and run", () => {
    expect(WorkflowSchema.safeParse(good).success).toBe(true);
    const bad = { ...good, jobs: { verify: { "runs-on": "x", "timeout-minutes": 10, steps: [{ uses: "a/b@" + "0".repeat(40), run: "bun test" }] } } };
    expect(WorkflowSchema.safeParse(bad).success).toBe(false);
  });

  test("every job must declare a positive integer timeout-minutes (spec §4.7)", () => {
    const { "timeout-minutes": _omitted, ...withoutTimeout } = good.jobs.verify;
    const missing = WorkflowSchema.safeParse({ ...good, jobs: { verify: withoutTimeout } });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues.some((i) => i.path.join(".") === "jobs.verify.timeout-minutes")).toBe(true);
    expect(WorkflowSchema.safeParse({ ...good, jobs: { verify: { ...good.jobs.verify, "timeout-minutes": 0 } } }).success).toBe(false);
    expect(WorkflowSchema.safeParse({ ...good, jobs: { verify: { ...good.jobs.verify, "timeout-minutes": 2.5 } } }).success).toBe(false);
  });

  // R28: a parity matrix declares `fail-fast: false` so each operating system
  // reports its own result instead of being cancelled by the first failure.
  test("strategy admits fail-fast next to matrix and stays strict otherwise", () => {
    const withStrategy = (strategy: Record<string, unknown>) => ({ ...good, jobs: { verify: { ...good.jobs.verify, strategy } } });
    expect(WorkflowSchema.safeParse(withStrategy({ matrix: { os: ["ubuntu-24.04"] } })).success).toBe(true);
    expect(WorkflowSchema.safeParse(withStrategy({ "fail-fast": false, matrix: { os: ["ubuntu-24.04"] } })).success).toBe(true);
    expect(WorkflowSchema.safeParse(withStrategy({ "fail-fast": "no", matrix: { os: ["ubuntu-24.04"] } })).success).toBe(false);
    expect(WorkflowSchema.safeParse(withStrategy({ "fail-fast": false })).success).toBe(false);
    expect(WorkflowSchema.safeParse(withStrategy({ "max-parallel": 2, matrix: { os: ["ubuntu-24.04"] } })).success).toBe(false);
  });

  test("shape check: inline logic and unpinned uses are evidence", () => {
    const w = WorkflowSchema.parse({
      ...good,
      jobs: {
        verify: {
          "runs-on": "x",
          "timeout-minutes": 10,
          steps: [{ uses: "actions/checkout@v4" }, { run: "curl http://x | bash" }, { run: "bun run verify && echo ok" }],
        },
      },
    });
    expect(checkWorkflowShape(w, "verify.yml")).toEqual([
      "verify.yml: job verify step 1: uses not pinned to a 40-hex SHA: actions/checkout@v4",
      "verify.yml: job verify step 2: run must be 'bun run <script>', 'bun test' or 'bun install --frozen-lockfile': curl http://x | bash",
      "verify.yml: job verify step 3: run must be 'bun run <script>', 'bun test' or 'bun install --frozen-lockfile': bun run verify && echo ok",
    ]);
  });

  test("jobsOf / runStepsOf", () => {
    const w = WorkflowSchema.parse(good);
    expect(jobsOf(w)).toEqual(["verify"]);
    expect(runStepsOf(w, "verify")).toEqual(["bun install --frozen-lockfile", "bun run verify"]);
  });
});
