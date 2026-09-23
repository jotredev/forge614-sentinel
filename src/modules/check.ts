import type { CheckParams } from "./check-params";
import type { MessageKey, MessageParams } from "./messages/types";
import type { RepoSnapshot } from "./snapshot";

export type CheckVerdict = "pass" | "caution" | "fail" | "not-applicable";
export type Verdict = Exclude<CheckVerdict, "not-applicable">;

// What a check returns: pure data. The id, the `applied` flag and the
// rendered messages are added by app/run-checks when it builds the report.
export interface CheckResult {
  verdict: CheckVerdict;
  evidence: string[];
  messageKey: MessageKey;
  params: MessageParams;
}

export interface CheckDefinition {
  id: string;
  appliesWhen: (snapshot: RepoSnapshot, params: CheckParams) => boolean;
  run: (snapshot: RepoSnapshot, params: CheckParams) => CheckResult;
}

// A pass may still carry informational evidence (for example, which list a
// check used when the standard version does not ship it yet).
export function pass(key: MessageKey, params: MessageParams = {}, evidence: string[] = []): CheckResult {
  return { verdict: "pass", evidence, messageKey: key, params };
}

export function caution(evidence: string[], key: MessageKey, params: MessageParams = {}): CheckResult {
  return { verdict: "caution", evidence, messageKey: key, params };
}

export function fail(evidence: string[], key: MessageKey, params: MessageParams = {}): CheckResult {
  return { verdict: "fail", evidence, messageKey: key, params };
}

export function notApplicable(reason: string): CheckResult {
  return { verdict: "not-applicable", evidence: [], messageKey: "notApplicable", params: { reason } };
}

export function worst(verdicts: readonly CheckVerdict[]): Verdict {
  if (verdicts.includes("fail")) return "fail";
  if (verdicts.includes("caution")) return "caution";
  return "pass";
}
