import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { repoRoot } from "../../app/repo";
import { runCommand } from "../../app/run-command";
import { CheckReportSchema } from "../../modules/report";
import { issuesOf, parseFlags } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested } from "./version";

const USAGE = "verify [--skip-tests]";
const Args = z.object({ help: z.literal(true).optional(), "skip-tests": z.literal(true).optional() }).strict();

// Order matters: a broken build must not produce a misleading self-check.
// The self-check runs Sentinel from source on this repository (bootstrap:
// until 0.1 is published there is no binary to install), against the
// standard fixture copy (byte-identical to the release, fingerprint pinned
// by forge614.node.json) in a throwaway FORGE614_HOME, so CI needs no
// network and the real cache of the machine is never touched.
const STEPS: ReadonlyArray<readonly [string, string[]]> = [
  ["typecheck", ["bun", "run", "typecheck"]],
  ["test", ["bun", "test", "--timeout", "30000"]],
  ["workflows:check", ["bun", "run", "workflows:check"]],
  ["notion-map:build --check", ["bun", "run", "notion-map:build", "--check"]],
];

function main(argv: string[]): number {
  if (printVersionIfRequested(argv)) return 0;
  const parsed = Args.safeParse(parseFlags(argv));
  if (!parsed.success) {
    printError("INVALID_ARGUMENTS", issuesOf(parsed.error));
    return 2;
  }
  if (parsed.data.help) {
    printJson({ schemaVersion: 1, usage: USAGE });
    return 0;
  }

  const steps: Array<{ label: string; exitCode: number }> = [];
  for (const [label, cmd] of STEPS) {
    if (label === "test" && parsed.data["skip-tests"] === true) continue;
    const result = runCommand(cmd, { cwd: repoRoot });
    steps.push({ label, exitCode: result.exitCode });
    process.stderr.write(`[verify] ${label}: exit ${result.exitCode}\n`);
    if (result.exitCode !== 0) {
      process.stderr.write(result.stdout + result.stderr);
      printError("VERIFY_STEP_FAILED", `${label} failed`);
      return 1;
    }
  }

  const home = mkdtempSync(join(tmpdir(), "sentinel-verify-home-"));
  try {
    const env = process.env.FORGE614_SENTINEL_RELEASE_BASE === undefined ? { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: pathToFileURL(resolve(repoRoot, "fixtures/standard")).href } : { FORGE614_HOME: home };
    const self = runCommand(["bun", "run", "sentinel:check"], { cwd: repoRoot, env });
    steps.push({ label: "sentinel:check", exitCode: self.exitCode });
    process.stderr.write(`[verify] sentinel:check: exit ${self.exitCode}\n`);
    const report = CheckReportSchema.safeParse(JSON.parse(self.stdout.trim() || "{}"));
    if (!report.success) {
      process.stderr.write(self.stderr);
      printError("VERIFY_STEP_FAILED", "sentinel:check did not produce a CheckReport");
      return 1;
    }
    for (const c of report.data.checks) {
      process.stderr.write(`[verify] ${c.id}: ${c.verdict} — ${c.message.es}\n`);
      for (const e of c.evidence) process.stderr.write(`  - ${e}\n`);
    }
    if (self.exitCode !== 0) {
      printError("VERIFY_STEP_FAILED", `sentinel:check verdict ${report.data.verdict}`);
      return 1;
    }
    printJson({ schemaVersion: 1, ok: true, steps, sentinel: { verdict: report.data.verdict, durationMs: report.data.durationMs } });
    return 0;
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

process.exit(await runCli("VERIFY_FAILED", () => main(process.argv.slice(2))));
