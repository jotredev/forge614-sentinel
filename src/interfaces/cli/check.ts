import { resolve } from "node:path";
import { z } from "zod";
import { checkRepository, type CheckRepositoryOptions } from "../../app/check-repository";
import { cacheRoot, fetcherFromEnv, releaseBaseFromEnv } from "../../app/environment";
import { CHECK_IDS, CHECKS } from "../../modules/checks";
import type { CheckReport } from "../../modules/report";
import { issuesOf, parseMixed } from "./args";
import { SENTINEL_ERROR_CODES } from "./codes";
import { printError, printJson, runCli } from "./output";
import { printVersionIfRequested, SENTINEL_VERSION } from "./version";

export const CHECK_USAGE = "check [--repo <path>] [--standard <version>] [--only <id,id>] [--strict] [--json]";

const Args = z
  .object({
    help: z.literal(true).optional(),
    json: z.literal(true).optional(),
    strict: z.literal(true).optional(),
    repo: z.string().min(1).optional(),
    standard: z.string().regex(/^\d+\.\d+\.\d+$/, "must be X.Y.Z").optional(),
    only: z
      .string()
      .min(1)
      .transform((s) => s.split(",").map((id) => id.trim()).filter((id) => id !== ""))
      .optional(),
  })
  .strict();

function summary(report: CheckReport): string {
  const lines = report.checks.map((c) => {
    const head = `[sentinel] ${c.id}: ${c.verdict} — ${c.message.es}`;
    return c.evidence.length === 0 ? head : `${head}\n${c.evidence.map((e) => `  - ${e}`).join("\n")}`;
  });
  lines.push(`[sentinel] ${report.repository.name} · standard ${report.standard.version}${report.standard.forced ? " (forced)" : ""} · verdict: ${report.verdict} · ${report.durationMs} ms`);
  return `${lines.join("\n")}\n`;
}

export async function checkMain(argv: string[], env: Record<string, string | undefined> = process.env, tty: boolean = process.stderr.isTTY === true): Promise<number> {
  if (printVersionIfRequested(argv)) return 0;
  const { flags, positionals } = parseMixed(argv, ["repo", "standard", "only"]);
  if (positionals.length > 0) {
    printError("INVALID_ARGUMENTS", `unexpected argument '${positionals[0] ?? ""}'; usage: ${CHECK_USAGE}`);
    return 2;
  }
  const parsed = Args.safeParse(flags);
  if (!parsed.success) {
    printError("INVALID_ARGUMENTS", issuesOf(parsed.error));
    return 2;
  }
  if (parsed.data.help) {
    printJson({ schemaVersion: 1, usage: CHECK_USAGE, checks: CHECK_IDS, errorCodes: SENTINEL_ERROR_CODES });
    return 0;
  }
  const unknown = (parsed.data.only ?? []).filter((id) => !CHECK_IDS.includes(id));
  if (unknown.length > 0) {
    printError("INVALID_ARGUMENTS", `--only names unknown checks: ${unknown.join(", ")}`);
    return 2;
  }

  // Test seam (Review Focus 5): make one check throw to prove CHECK_FAILED
  // handling end to end with the real binary.
  const crash = env.FORGE614_SENTINEL_CRASH_CHECK;
  if (crash !== undefined) {
    const target = CHECKS.find((c) => c.id === crash);
    if (target !== undefined) target.run = () => { throw new Error("injected crash"); };
  }

  const options: CheckRepositoryOptions = {
    root: resolve(parsed.data.repo ?? "."),
    ...(parsed.data.standard === undefined ? {} : { standardVersion: parsed.data.standard }),
    ...(parsed.data.only === undefined ? {} : { only: parsed.data.only }),
    cacheRoot: cacheRoot(env),
    fetcher: fetcherFromEnv(env),
    releaseBase: releaseBaseFromEnv(env),
    today: new Date().toISOString().slice(0, 10),
    sentinelVersion: SENTINEL_VERSION,
  };
  const result = await checkRepository(options);

  if (result.kind === "error") {
    printError(result.code, result.error);
    return result.code === "NODE_POINTER_INVALID" ? 2 : 1;
  }
  if (result.kind === "not-applicable") {
    printJson({ ...result.report });
    return 0;
  }

  const { report, crashed } = result;
  if (parsed.data.json !== true && tty) process.stderr.write(summary(report));
  printJson({ ...report });
  if (crashed.length > 0) {
    printError("CHECK_FAILED", `checks threw an unexpected exception: ${crashed.join(", ")}`);
    return 1;
  }
  if (report.verdict === "fail") return 1;
  if (report.verdict === "caution") return parsed.data.strict === true ? 1 : 0;
  return 0;
}

if (import.meta.main) process.exit(await runCli("SENTINEL_FAILED", () => checkMain(process.argv.slice(2))));
