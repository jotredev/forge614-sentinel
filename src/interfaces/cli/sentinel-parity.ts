import { z } from "zod";
import { runParity } from "../../app/parity";
import { repoRoot } from "../../app/repo";
import { issuesOf, parseFlags } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested, SENTINEL_VERSION } from "./version";

const USAGE = "sentinel-parity [--update]";
const Args = z.object({ help: z.literal(true).optional(), update: z.literal(true).optional() }).strict();

// A fixed date: no check that applies to the fixtures depends on the day
// (support-matrix does not apply to them), and a fixed value keeps a future
// date-dependent check from breaking parity between runners.
const PARITY_TODAY = "2026-09-23";

async function main(argv: string[]): Promise<number> {
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
  const result = await runParity({ root: repoRoot, update: parsed.data.update === true, sentinelVersion: SENTINEL_VERSION, today: PARITY_TODAY });
  if (!result.ok) {
    for (const diff of result.diffs) process.stderr.write(`[parity] ${diff}\n`);
    printError(result.code, result.error);
    return 1;
  }
  printJson({ schemaVersion: 1, ok: true, compared: result.compared });
  return 0;
}

process.exit(await runCli("PARITY_FAILED", () => main(process.argv.slice(2))));
