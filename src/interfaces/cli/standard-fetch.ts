import { z } from "zod";
import { classifyRepository } from "../../app/classify-repository";
import { cacheRoot, describeCacheLocation, fetcherFromEnv, releaseBaseFromEnv } from "../../app/environment";
import { fetchStandard } from "../../app/fetch-standard";
import { standardSource } from "../../modules/standard-source";
import { issuesOf, parseMixed } from "./args";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested } from "./version";

export const FETCH_USAGE = "standard fetch [<version>] [--json]";

const Flags = z.object({ help: z.literal(true).optional(), json: z.literal(true).optional() }).strict();
const Version = z.string().regex(/^\d+\.\d+\.\d+$/, "version must be X.Y.Z");

export async function standardFetchMain(argv: string[], env: Record<string, string | undefined> = process.env): Promise<number> {
  if (printVersionIfRequested(argv)) return 0;
  const { flags, positionals } = parseMixed(argv, []);
  const parsed = Flags.safeParse(flags);
  if (!parsed.success) {
    printError("INVALID_ARGUMENTS", issuesOf(parsed.error));
    return 2;
  }
  if (parsed.data.help) {
    printJson({ schemaVersion: 1, usage: FETCH_USAGE });
    return 0;
  }
  if (positionals.length > 1) {
    printError("INVALID_ARGUMENTS", `expected at most one version, got ${positionals.length}`);
    return 2;
  }

  let version = positionals[0];
  let expectedSha256: string | undefined;
  if (version === undefined) {
    const here = classifyRepository(process.cwd());
    if (here.kind !== "node") {
      printError("INVALID_ARGUMENTS", "no version given and no forge614.node.json in the current directory");
      return 2;
    }
    version = here.pointer.standard.version;
    expectedSha256 = here.pointer.standard.sha256;
  }
  const v = Version.safeParse(version);
  if (!v.success) {
    printError("INVALID_ARGUMENTS", issuesOf(v.error));
    return 2;
  }

  const result = await fetchStandard({
    source: expectedSha256 === undefined ? standardSource(v.data) : standardSource(v.data, expectedSha256),
    cacheRoot: cacheRoot(env),
    fetcher: fetcherFromEnv(env),
    releaseBase: releaseBaseFromEnv(env),
  });
  if (!result.ok) {
    printError(result.reason === "corrupt" ? "STANDARD_CORRUPT" : "STANDARD_FETCH_FAILED", result.error);
    return 1;
  }
  printJson({ schemaVersion: 1, version: result.version, sha256: result.sha256, alreadyCached: result.alreadyCached, location: describeCacheLocation(result.version) });
  return 0;
}

if (import.meta.main) process.exit(await runCli("SENTINEL_FAILED", () => standardFetchMain(process.argv.slice(2))));
