import { resolve } from "node:path";
import { z } from "zod";
import { parseTarget, TARGETS } from "../../app/build-target";
import { repoRoot } from "../../app/repo";
import { runCommand } from "../../app/run-command";
import { smokeTarget } from "../../app/smoke-target";
import { issuesOf, parseMixed } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested, SENTINEL_VERSION } from "./version";

const USAGE = "smoke-target [--target <darwin-arm64|darwin-x64|linux-x64|linux-arm64|windows-x64>] (or FORGE614_TARGET)";
const Args = z.object({ help: z.literal(true).optional(), target: z.string().optional() }).strict();

function main(argv: string[]): number {
  if (printVersionIfRequested(argv)) return 0;
  const { flags, positionals } = parseMixed(argv, ["target"]);
  const parsed = Args.safeParse(flags);
  if (!parsed.success || positionals.length > 0) {
    printError("INVALID_ARGUMENTS", parsed.success ? `unexpected argument '${positionals[0] ?? ""}'` : issuesOf(parsed.error));
    return 2;
  }
  if (parsed.data.help) {
    printJson({ schemaVersion: 1, usage: USAGE, targets: TARGETS });
    return 0;
  }
  const target = parseTarget(parsed.data.target ?? process.env.FORGE614_TARGET);
  if (target === null) {
    printError("INVALID_ARGUMENTS", `target must be one of ${TARGETS.join(", ")} (--target or FORGE614_TARGET)`);
    return 2;
  }
  const result = smokeTarget({
    root: repoRoot,
    target,
    outDir: resolve(repoRoot, "dist/release"),
    expectedVersion: SENTINEL_VERSION,
    exec: (cmd, options) => runCommand(cmd, options ?? {}),
  });
  if (!result.ok) {
    printError(result.code, result.error);
    return 1;
  }
  printJson({ schemaVersion: 1, ...result });
  return 0;
}

process.exit(await runCli("SMOKE_FAILED", () => main(process.argv.slice(2))));
