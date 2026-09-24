import { z } from "zod";
import { checkOwnWorkflows } from "../../app/check-own-workflows";
import { repoRoot } from "../../app/repo";
import { issuesOf, parseFlags } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested, SENTINEL_VERSION } from "./version";

const USAGE = "workflows-check";
const Args = z.object({ help: z.literal(true).optional() }).strict();

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
  const result = checkOwnWorkflows(repoRoot, SENTINEL_VERSION);
  printJson({ schemaVersion: 1, verdict: result.verdict, evidence: result.evidence });
  return result.verdict === "pass" ? 0 : 1;
}

process.exit(await runCli("WORKFLOWS_CHECK_FAILED", () => main(process.argv.slice(2))));
