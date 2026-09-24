import type { CheckDefinition } from "../check";
import { agentChecklistImpactCheck } from "./agent-checklist-impact";
import { contextBudgetCheck } from "./context-budget";
import { decisionsCheck } from "./decisions";
import { docsParityCheck } from "./docs-parity";
import { ecosystemContractCheck } from "./ecosystem-contract";
import { errorCodesCheck } from "./error-codes";
import { forbiddenMentionsCheck } from "./forbidden-mentions";
import { installerCheck } from "./installer";
import { layoutCheck } from "./layout";
import { nodeContractCheck } from "./node-contract";
import { nodePointerCheck } from "./node-pointer";
import { packageNamingCheck } from "./package-naming";
import { releaseCheck } from "./release";
import { rulesCatalogCheck } from "./rules-catalog";
import { secretsHygieneCheck } from "./secrets-hygiene";
import { stackCheck } from "./stack";
import { supportMatrixCheck } from "./support-matrix";
import { versionsCheck } from "./versions";
import { workflowsCheck } from "./workflows";

// Report order: identity and structure first, then the ported content
// checks, then contract/installer/release/versions, then the checks that
// only apply to forge614-ai's own tree.
export const CHECKS: readonly CheckDefinition[] = [
  nodePointerCheck, layoutCheck, stackCheck, secretsHygieneCheck,
  packageNamingCheck, forbiddenMentionsCheck, docsParityCheck, decisionsCheck, agentChecklistImpactCheck, errorCodesCheck,
  nodeContractCheck, installerCheck, releaseCheck, versionsCheck,
  workflowsCheck, supportMatrixCheck, contextBudgetCheck, ecosystemContractCheck, rulesCatalogCheck,
];

export const CHECK_IDS: readonly string[] = CHECKS.map((c) => c.id);

// Checks the 1.0.0 pack does not reference through a manifest `validator`
// field and that Sentinel therefore always selects (spec §8.2 + support-matrix,
// ecosystem-contract, rules-catalog). Standard 1.1.0 references them explicitly.
export const NATIVE_CHECK_IDS: readonly string[] = [
  "node-pointer", "layout", "stack", "secrets-hygiene", "node-contract", "installer", "release", "versions",
  "support-matrix", "ecosystem-contract", "rules-catalog",
];

export function checkById(id: string): CheckDefinition | undefined {
  return CHECKS.find((c) => c.id === id);
}
