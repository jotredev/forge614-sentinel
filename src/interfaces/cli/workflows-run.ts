import { z } from "zod";
import { repoRoot } from "../../app/repo";
import { runCommand } from "../../app/run-command";
import { runWorkflow, type WorkflowRunResult } from "../../app/run-workflows";
import { takeSnapshot } from "../../app/take-snapshot";
import { issuesOf, parsePairs } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested } from "./version";

const USAGE = "workflows-run [--workflow <name>]";
const Args = z.object({ workflow: z.string().min(1).default("verify") }).strict();

function main(argv: string[]): number {
  if (printVersionIfRequested(argv)) return 0;
  if (argv.includes("--help")) {
    printJson({ schemaVersion: 1, usage: USAGE });
    return 0;
  }
  const parsed = Args.safeParse(parsePairs(argv));
  if (!parsed.success) {
    printError("INVALID_ARGUMENTS", issuesOf(parsed.error));
    return 2;
  }
  const { workflow } = parsed.data;
  let result: WorkflowRunResult;
  try {
    result = runWorkflow(takeSnapshot(repoRoot), workflow, (cmd) => {
      const r = runCommand(cmd, { cwd: repoRoot });
      process.stderr.write(`[${workflow}] ${cmd.join(" ")} … exit ${r.exitCode}\n`);
      return r;
    });
  } catch (error) {
    printError("WORKFLOW_NOT_FOUND", error instanceof Error ? error.message : String(error));
    return 1;
  }
  printJson({ ...result });
  return result.ok ? 0 : 1;
}

process.exit(await runCli("WORKFLOWS_RUN_FAILED", () => main(process.argv.slice(2))));
