import { expect, test } from "bun:test";
import { snapshotFrom } from "../modules/snapshot";
import { runWorkflow } from "./run-workflows";

const VERIFY = [
  "name: verify",
  "on:",
  "  pull_request: {}",
  "jobs:",
  "  verify:",
  "    runs-on: ubuntu-24.04",
  "    timeout-minutes: 10",
  "    steps:",
  "      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  "      - run: bun install --frozen-lockfile",
  "      - run: bun run typecheck",
  "      - run: bun run verify",
  "",
].join("\n");

test("runs the run steps of every job in order and stops a job at its first failure", () => {
  const calls: string[][] = [];
  const exec = (cmd: string[]) => {
    calls.push(cmd);
    return { exitCode: cmd.join(" ") === "bun run typecheck" ? 1 : 0, stdout: "", stderr: "" };
  };
  const r = runWorkflow(snapshotFrom({ ".github/workflows/verify.yml": VERIFY }), "verify", exec);
  expect(calls).toEqual([
    ["bun", "install", "--frozen-lockfile"],
    ["bun", "run", "typecheck"],
  ]);
  expect(r.ok).toBe(false);
  expect(r.jobs[0]?.steps.map((s) => s.exitCode)).toEqual([0, 1]);
});

test("all steps succeed: ok is true and every step ran", () => {
  const r = runWorkflow(snapshotFrom({ ".github/workflows/verify.yml": VERIFY }), "verify", () => ({ exitCode: 0, stdout: "", stderr: "" }));
  expect(r.ok).toBe(true);
  expect(r.jobs).toEqual([{ job: "verify", steps: [{ run: "bun install --frozen-lockfile", exitCode: 0 }, { run: "bun run typecheck", exitCode: 0 }, { run: "bun run verify", exitCode: 0 }] }]);
});

test("an unknown workflow name throws", () => {
  expect(() => runWorkflow(snapshotFrom({}), "nope", () => ({ exitCode: 0, stdout: "", stderr: "" }))).toThrow("workflow not found: nope");
});
