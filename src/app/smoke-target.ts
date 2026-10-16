import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { binaryName, type Exec, type Target } from "./build-target";

const Verdict = z.object({ schemaVersion: z.literal(1), verdict: z.enum(["pass", "caution", "fail"]) }).passthrough();

export type SmokeTargetResult = { ok: true; target: Target; version: string; steps: string[] } | { ok: false; code: "SMOKE_FAILED"; error: string };

function parseJson<T>(schema: z.ZodType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text.trim()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Proves the compiled binary is the program we think it is: it reports its
// own version, it answers --help, and it checks a real node fixture with the
// standard served from the fixture copy in a throwaway FORGE614_HOME.
export function smokeTarget(options: { root: string; target: Target; outDir: string; expectedVersion: string; exec: Exec }): SmokeTargetResult {
  const binary = join(options.outDir, options.target, binaryName(options.target));
  const steps: string[] = [];
  const fail = (error: string): SmokeTargetResult => ({ ok: false, code: "SMOKE_FAILED", error });

  const version = options.exec([binary, "--version"]);
  const reportedVersion = version.exitCode === 0 ? /^forge614-sentinel (\d+\.\d+\.\d+)\s*$/.exec(version.stdout)?.[1] : undefined;
  if (reportedVersion === undefined) return fail(`--version failed (exit ${version.exitCode}): ${version.stderr.trim()}`);
  if (reportedVersion !== options.expectedVersion) return fail(`--version reports ${reportedVersion}, package.json says ${options.expectedVersion}`);
  steps.push("--version");

  const help = options.exec([binary, "--help"]);
  if (help.exitCode !== 0 || parseJson(z.object({ schemaVersion: z.literal(1) }).passthrough(), help.stdout) === null) return fail(`--help failed (exit ${help.exitCode})`);
  steps.push("--help");

  const home = mkdtempSync(join(tmpdir(), "sentinel-smoke-home-"));
  try {
    const check = options.exec([binary, "check", "--repo", resolve(options.root, "fixtures/pass-node"), "--json"], {
      cwd: options.root,
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_SENTINEL_RELEASE_BASE: pathToFileURL(resolve(options.root, "fixtures/standard")).href },
    });
    const report = parseJson(Verdict, check.stdout);
    if (check.exitCode !== 0 || report === null || report.verdict !== "pass") return fail(`check on fixtures/pass-node: exit ${check.exitCode}, verdict ${report?.verdict ?? "?"}: ${check.stderr.trim()}`);
    steps.push("check fixtures/pass-node");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  return { ok: true, target: options.target, version: reportedVersion, steps };
}
