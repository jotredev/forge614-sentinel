import { resolve } from "node:path";
import { z } from "zod";
import { releasePublish } from "../../app/release-publish";
import { repoRoot } from "../../app/repo";
import { runCommand } from "../../app/run-command";
import { issuesOf, parseMixed } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested, SENTINEL_VERSION } from "./version";

const USAGE = "release-publish [--tag vX.Y.Z] [--dry-run]";
const Args = z.object({ help: z.literal(true).optional(), tag: z.string().min(1).optional(), "dry-run": z.literal(true).optional() }).strict();

// The tag comes from --tag or, in the release workflow, from GITHUB_REF_NAME
// (the pushed tag). An empty GITHUB_REF_NAME counts as absent.
function main(argv: string[]): number {
  if (printVersionIfRequested(argv)) return 0;
  const { flags, positionals } = parseMixed(argv, ["tag"]);
  const parsed = Args.safeParse(flags);
  if (!parsed.success || positionals.length > 0) {
    printError("INVALID_ARGUMENTS", parsed.success ? `unexpected argument '${positionals[0] ?? ""}'` : issuesOf(parsed.error));
    return 2;
  }
  if (parsed.data.help) {
    printJson({ schemaVersion: 1, usage: USAGE });
    return 0;
  }
  const refName = process.env.GITHUB_REF_NAME;
  const tag = parsed.data.tag ?? (refName !== undefined && refName !== "" ? refName : undefined);
  if (tag === undefined) {
    printError("INVALID_ARGUMENTS", "no tag: pass --tag vX.Y.Z or set GITHUB_REF_NAME");
    return 2;
  }
  const result = releasePublish({
    root: repoRoot,
    tag,
    version: SENTINEL_VERSION,
    assetsDir: resolve(repoRoot, "dist/release"),
    exec: (cmd, options) => runCommand(cmd, options ?? {}),
    dryRun: parsed.data["dry-run"] === true,
  });
  if (!result.ok) {
    printError(result.code, result.error);
    return 1;
  }
  printJson({ schemaVersion: 1, ...result });
  return 0;
}

process.exit(await runCli("RELEASE_PUBLISH_FAILED", () => main(process.argv.slice(2))));
