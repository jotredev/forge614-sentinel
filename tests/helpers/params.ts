import { parse } from "yaml";
import { BUILTIN_ALLOWED_EXTRA_JOBS, BUILTIN_LAYOUT, BUILTIN_SECRETS, BUILTIN_STACK, LEGACY_VALIDATOR_IDS } from "../../src/app/build-check-params";
import type { CheckParams } from "../../src/modules/check-params";
import type { Pack } from "../../src/modules/schemas/pack";

export const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";

export const DEMO_POINTER = { schemaVersion: 1 as const, node: "demo", kind: "product" as const, standard: { version: "1.0.0", sha256: SHA } };

const MINIMAL_PACK: Pack = { schemaVersion: 1, name: "forge614-pack-ecosystem-node", version: "1.0.0", title: { es: "t", en: "t" }, rules: ["forge614-rule-package-naming"] };

export function testParams(overrides: Partial<CheckParams> = {}): CheckParams {
  return {
    sentinelVersion: "0.1.0",
    today: "2026-09-22",
    pointer: DEMO_POINTER,
    standard: { version: "1.0.0", sha256: SHA, pointerVersionSha256: SHA },
    pack: MINIMAL_PACK,
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
    ...overrides,
  };
}
