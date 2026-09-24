import { parse } from "yaml";
import type { CheckParams } from "../modules/check-params";
import { BUILTIN_ALLOWED_EXTRA_JOBS, BUILTIN_LAYOUT, BUILTIN_SECRETS, BUILTIN_STACK, LEGACY_VALIDATOR_IDS } from "./build-check-params";

// Parameters for the development CLIs that run one check on this very
// repository without the standard (workflows:check). Everything the
// `workflows` check reads is here; the pack is a placeholder that no
// selection ever consults on this path.
export function devCheckParams(sentinelVersion: string, today: string): CheckParams {
  return {
    sentinelVersion,
    today,
    pointer: { schemaVersion: 1, node: "sentinel", kind: "product", standard: { version: "1.0.0", sha256: "0".repeat(64) } },
    standard: { version: "1.0.0", sha256: "0".repeat(64), pointerVersionSha256: undefined },
    pack: { schemaVersion: 1, name: "forge614-pack-ecosystem-node", version: "1.0.0", title: { es: "t", en: "t" }, rules: ["forge614-rule-thin-workflows"] },
    manifests: new Map(),
    forbiddenMentions: { terms: [], excludePaths: [] },
    templates: new Map(),
    ecosystemContract: "",
    layout: BUILTIN_LAYOUT,
    stack: BUILTIN_STACK,
    secrets: BUILTIN_SECRETS,
    allowedExtraJobs: BUILTIN_ALLOWED_EXTRA_JOBS,
    knownCheckIds: [],
    legacyValidatorIds: LEGACY_VALIDATOR_IDS,
    parseYaml: (text) => parse(text),
  };
}
