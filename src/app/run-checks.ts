import type { CheckDefinition, CheckResult } from "../modules/check";
import type { CheckParams } from "../modules/check-params";
import { renderBoth } from "../modules/messages/render";
import type { CheckEntry } from "../modules/report";
import type { RepoSnapshot } from "../modules/snapshot";

export interface Selection {
  selected: CheckDefinition[];
  outdated: Array<{ validator: string; rule: string }>;
}

// The pack decides what runs (spec D3): every rule's `validator` (through
// the legacy name map) plus the checks Sentinel implements natively for the
// standard version that does not yet name them. A validator this Sentinel
// lacks is never dropped silently: it is carried as an outdated entry.
export function selectChecks(params: CheckParams, registry: readonly CheckDefinition[], nativeIds: readonly string[], only?: readonly string[]): Selection {
  const wanted = new Set<string>(nativeIds);
  const outdated: Array<{ validator: string; rule: string }> = [];
  for (const rule of params.pack.rules) {
    const validator = params.manifests.get(rule)?.validator;
    if (validator === undefined) continue;
    const id = params.legacyValidatorIds[validator] ?? validator;
    if (registry.some((c) => c.id === id)) wanted.add(id);
    else outdated.push({ validator, rule });
  }
  const onlySet = only === undefined ? undefined : new Set(only);
  const keep = (id: string): boolean => onlySet === undefined || onlySet.has(id);
  return {
    selected: registry.filter((c) => wanted.has(c.id) && keep(c.id)),
    outdated: outdated.filter((o) => keep(o.validator)),
  };
}

export interface RunChecksResult {
  entries: CheckEntry[];
  crashed: string[];
}

function toEntry(id: string, result: CheckResult, applied: boolean): CheckEntry {
  return { id, verdict: result.verdict, applied, evidence: result.evidence, message: renderBoth(result.messageKey, result.params) };
}

function notApplicableReason(check: CheckDefinition, snapshot: RepoSnapshot): string {
  switch (check.id) {
    case "support-matrix":
      return "standard/support-matrix.json not present";
    case "context-budget":
      return "standard/packs/forge614-pack-ecosystem-node/pack.json not present";
    case "rules-catalog":
      return "no standard/rules or standard/packs in this repository";
    case "installer":
      return "forge614-ai is exempt from the installer template";
    case "stack":
      return "no package.json or tsconfig.json";
    case "versions":
      return "no package.json";
    case "node-contract":
      return "no CONTRACT.md";
    default:
      return `appliesWhen returned false (${snapshot.files.size} files)`;
  }
}

// Checks are pure and independent, so they run through Promise.all: in 0.1
// every `run` is synchronous and the order of entries is the selection
// order regardless of timing. A throw inside a check is captured as a
// CHECK_FAILED entry (spec §7); the run continues.
export async function runChecks(snapshot: RepoSnapshot, params: CheckParams, selection: Selection): Promise<RunChecksResult> {
  const crashed: string[] = [];
  const entries = await Promise.all(
    selection.selected.map(async (check): Promise<CheckEntry> => {
      if (!check.appliesWhen(snapshot, params)) {
        return toEntry(check.id, { verdict: "not-applicable", evidence: [], messageKey: "notApplicable", params: { reason: notApplicableReason(check, snapshot) } }, false);
      }
      try {
        return toEntry(check.id, check.run(snapshot, params), true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        crashed.push(check.id);
        return toEntry(check.id, { verdict: "fail", evidence: [`CHECK_FAILED: ${message}`], messageKey: "checkFailed", params: { error: message } }, true);
      }
    }),
  );
  for (const { validator, rule } of selection.outdated) {
    entries.push(
      toEntry(
        validator,
        {
          verdict: "caution",
          evidence: [`SENTINEL_OUTDATED: validator '${validator}' requested by ${rule} is not implemented by sentinel ${params.sentinelVersion}`],
          messageKey: "sentinelOutdated",
          params: { validator },
        },
        true,
      ),
    );
  }
  return { entries, crashed: crashed.sort() };
}
