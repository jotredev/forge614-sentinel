import { z } from "zod";
import { parse as parseYaml } from "yaml";
import type { CheckParams, LayoutSpec, SecretsSpec, StackSpec } from "../modules/check-params";
import { ForbiddenMentionsSchema } from "../modules/schemas/forbidden-mentions";
import type { NodePointer } from "../modules/schemas/node-pointer";
import { PackSchema } from "../modules/schemas/pack";
import { RuleManifestSchema, type RuleManifest } from "../modules/schemas/rule-manifest";
import type { LoadedStandard } from "./load-standard";

// Standard 1.0.0 does not ship these three data files; they arrive in
// 1.1.0 as layout.json, stack.json and secret-patterns.json (spec §8.2,
// §9.2). Until then the lists are builtin: they live here and every check
// that uses them says `source: builtin` in its evidence, so a report never
// hides which list judged the repository.
export const BUILTIN_LAYOUT: LayoutSpec = {
  directories: ["src/modules", "src/app", "src/infrastructure", "src/interfaces", "docs/es", "docs/en", "docs/decisions", ".github/workflows"],
  files: ["CONTRACT.md", "README.md", ".githooks/pre-push", ".agents/templates/plan.md"],
  source: "builtin",
};

export const BUILTIN_STACK: StackSpec = {
  tsconfigFlags: ["strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes"],
  minimumBun: "1.3.9", // acta 0026
  source: "builtin",
};

export const BUILTIN_SECRETS: SecretsSpec = {
  patterns: [
    { id: "private-key", pattern: "-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----" },
    { id: "aws-access-key-id", pattern: "\\bAKIA[0-9A-Z]{16}\\b" },
    { id: "github-token", pattern: "\\bgh[pousr]_[A-Za-z0-9]{36,}\\b" },
    { id: "github-fine-grained-token", pattern: "\\bgithub_pat_[A-Za-z0-9_]{22,}\\b" },
    { id: "slack-token", pattern: "\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b" },
    { id: "connection-string-with-credentials", pattern: "\\b[a-z][a-z0-9+.-]*://[^\\s/:@]+:[^\\s/@]+@" },
  ],
  excludePaths: ["fixtures/"],
  source: "builtin",
};

// Jobs a node may add to the standard's workflow templates (spec §13: the
// cross-platform `parity` job is the one allowed deviation). An explicit
// list, not "any extra job": a node that adds a deploy job to verify.yml
// gets a release fail naming it.
export const BUILTIN_ALLOWED_EXTRA_JOBS: readonly string[] = ["parity"];

// Validator ids that standard 1.0.0 manifests still use for checks Sentinel
// renamed (spec §8.1).
export const LEGACY_VALIDATOR_IDS: Readonly<Record<string, string>> = {
  "bilingual-docs": "docs-parity",
  "decision-records": "decisions",
};

const LayoutFileSchema = z.object({ schemaVersion: z.literal(1), directories: z.array(z.string().min(1)), files: z.array(z.string().min(1)) }).strict();
const StackFileSchema = z.object({ schemaVersion: z.literal(1), tsconfigFlags: z.array(z.string().min(1)).min(1), minimumBun: z.string().regex(/^\d+\.\d+\.\d+$/) }).strict();
const SecretsFileSchema = z
  .object({ schemaVersion: z.literal(1), patterns: z.array(z.object({ id: z.string().min(1), pattern: z.string().min(1) }).strict()).min(1), excludePaths: z.array(z.string()) })
  .strict();

export type BuildParamsResult = { ok: true; params: CheckParams } | { ok: false; code: "STANDARD_CORRUPT"; error: string };

function corrupt(version: string, what: string): BuildParamsResult {
  return { ok: false, code: "STANDARD_CORRUPT", error: `standard ${version} content is inconsistent: ${what}` };
}

function parseJson<T>(schema: z.ZodType<T>, raw: string | undefined, what: string, version: string): { ok: true; value: T } | { ok: false; result: BuildParamsResult } {
  if (raw === undefined) return { ok: false, result: corrupt(version, `${what} missing`) };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, result: corrupt(version, `${what} is not valid JSON`) };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, result: corrupt(version, `${what} does not match its schema`) };
  return { ok: true, value: parsed.data };
}

export interface BuildCheckParamsOptions {
  standard: LoadedStandard;
  pointer: NodePointer;
  pointerVersionSha256: string | undefined;
  today: string;
  sentinelVersion: string;
  knownCheckIds: readonly string[];
}

const PACK_PATH = "packs/forge614-pack-ecosystem-node/pack.json";

export function buildCheckParams(options: BuildCheckParamsOptions): BuildParamsResult {
  const { files, version } = options.standard;

  const pack = parseJson(PackSchema, files.get(PACK_PATH), PACK_PATH, version);
  if (!pack.ok) return pack.result;

  const manifests = new Map<string, RuleManifest>();
  for (const rule of pack.value.rules) {
    const path = `rules/${rule}/manifest.json`;
    const manifest = parseJson(RuleManifestSchema, files.get(path), path, version);
    if (!manifest.ok) return manifest.result;
    manifests.set(rule, manifest.value);
  }

  const forbidden = parseJson(ForbiddenMentionsSchema, files.get("forbidden-mentions.json"), "forbidden-mentions.json", version);
  if (!forbidden.ok) return forbidden.result;

  const templates = new Map<string, string>();
  for (const [path, text] of files) if (path.startsWith("templates/")) templates.set(path.slice("templates/".length), text);
  if (templates.size === 0) return corrupt(version, "templates/ missing");

  const ecosystemContract = files.get("FORGE614_ECOSYSTEM_CONTRACT.md");
  if (ecosystemContract === undefined) return corrupt(version, "FORGE614_ECOSYSTEM_CONTRACT.md missing");

  let layout: LayoutSpec = BUILTIN_LAYOUT;
  if (files.has("layout.json")) {
    const parsed = parseJson(LayoutFileSchema, files.get("layout.json"), "layout.json", version);
    if (!parsed.ok) return parsed.result;
    layout = { directories: parsed.value.directories, files: parsed.value.files, source: "standard/layout.json" };
  }
  let stack: StackSpec = BUILTIN_STACK;
  if (files.has("stack.json")) {
    const parsed = parseJson(StackFileSchema, files.get("stack.json"), "stack.json", version);
    if (!parsed.ok) return parsed.result;
    stack = { tsconfigFlags: parsed.value.tsconfigFlags, minimumBun: parsed.value.minimumBun, source: "standard/stack.json" };
  }
  let secrets: SecretsSpec = BUILTIN_SECRETS;
  if (files.has("secret-patterns.json")) {
    const parsed = parseJson(SecretsFileSchema, files.get("secret-patterns.json"), "secret-patterns.json", version);
    if (!parsed.ok) return parsed.result;
    secrets = { patterns: parsed.value.patterns, excludePaths: parsed.value.excludePaths, source: "standard/secret-patterns.json" };
  }

  return {
    ok: true,
    params: {
      sentinelVersion: options.sentinelVersion,
      today: options.today,
      pointer: options.pointer,
      standard: { version, sha256: options.standard.sha256, pointerVersionSha256: options.pointerVersionSha256 },
      pack: pack.value,
      manifests,
      forbiddenMentions: { terms: forbidden.value.terms, excludePaths: forbidden.value.excludePaths },
      templates,
      ecosystemContract,
      layout,
      stack,
      secrets,
      allowedExtraJobs: BUILTIN_ALLOWED_EXTRA_JOBS,
      knownCheckIds: options.knownCheckIds,
      legacyValidatorIds: LEGACY_VALIDATOR_IDS,
      parseYaml: (text) => parseYaml(text),
    },
  };
}
