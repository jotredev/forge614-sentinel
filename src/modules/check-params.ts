import type { NodePointer } from "./schemas/node-pointer";
import type { Pack } from "./schemas/pack";
import type { RuleManifest } from "./schemas/rule-manifest";

export interface StandardParams {
  version: string;
  sha256: string;
  // sha256 of the cached archive of the version the POINTER declares. Equal
  // to `sha256` unless `--standard` forced another version; undefined when
  // that version is not cached (node-pointer then reports caution).
  pointerVersionSha256: string | undefined;
}

export interface LayoutSpec {
  directories: readonly string[];
  files: readonly string[];
  source: "builtin" | "standard/layout.json";
}

export interface StackSpec {
  tsconfigFlags: readonly string[];
  minimumBun: string;
  source: "builtin" | "standard/stack.json";
}

export interface SecretPattern {
  id: string;
  pattern: string; // RegExp source, flags "g"
}

export interface SecretsSpec {
  patterns: readonly SecretPattern[];
  excludePaths: readonly string[];
  source: "builtin" | "standard/secret-patterns.json";
}

// Every parameter a check may need, built once per run from the loaded
// standard (spec §8: parameters come from the standard, never from constants
// inside a check). `parseYaml` is the only function: the yaml package is
// external to modules, so app injects it.
export interface CheckParams {
  sentinelVersion: string;
  today: string;
  pointer: NodePointer;
  standard: StandardParams;
  pack: Pack;
  manifests: ReadonlyMap<string, RuleManifest>;
  forbiddenMentions: { terms: readonly string[]; excludePaths: readonly string[] };
  templates: ReadonlyMap<string, string>;
  ecosystemContract: string;
  layout: LayoutSpec;
  stack: StackSpec;
  secrets: SecretsSpec;
  // Jobs a node may add to the standard's workflow templates without the
  // release check failing (spec §13 names `parity` as the allowed deviation).
  allowedExtraJobs: readonly string[];
  knownCheckIds: readonly string[];
  legacyValidatorIds: Readonly<Record<string, string>>;
  parseYaml: (text: string) => unknown;
}
