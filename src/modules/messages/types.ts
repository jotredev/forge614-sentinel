export type Locale = "es" | "en";
export type MessageParams = Record<string, string>;
type Msg = (params: MessageParams) => string;

// One key per message; es.ts and en.ts each implement the whole interface, so
// a key missing in one language does not compile.
export interface MessageCatalog {
  // engine
  notApplicable: Msg;
  checkFailed: Msg;
  sentinelOutdated: Msg;
  dataFileInvalidJson: Msg;
  // ported checks
  packageNamesOk: Msg;
  packageNamesInvalid: Msg;
  forbiddenMentionsNone: Msg;
  forbiddenMentionsFound: Msg;
  docsParityOk: Msg;
  docsParityBroken: Msg;
  decisionRecordsOk: Msg;
  decisionRecordsInvalid: Msg;
  decisionsIndexMissing: Msg;
  agentImpactDeclared: Msg;
  agentImpactMissing: Msg;
  errorCodesOk: Msg;
  errorCodesInvalid: Msg;
  supportMatrixMissing: Msg;
  supportMatrixInvalid: Msg;
  supportMatrixCurrent: Msg;
  supportMatrixStale: Msg;
  workflowsNone: Msg;
  workflowsOk: Msg;
  workflowsInvalid: Msg;
  contextBudgetOk: Msg;
  contextBudgetOverBudget: Msg;
  contextBudgetInvalid: Msg;
  ecosystemContractOk: Msg;
  ecosystemContractDiverged: Msg;
  rulesCatalogOk: Msg;
  rulesCatalogInvalid: Msg;
  // new checks
  nodePointerOk: Msg;
  nodePointerMismatch: Msg;
  nodePointerUnverifiable: Msg;
  layoutOk: Msg;
  layoutIncomplete: Msg;
  stackOk: Msg;
  stackViolations: Msg;
  secretsNone: Msg;
  secretsFound: Msg;
  nodeContractOk: Msg;
  nodeContractBroken: Msg;
  installerOk: Msg;
  installerDrifted: Msg;
  releaseOk: Msg;
  releaseDrifted: Msg;
  versionsOk: Msg;
  versionsInconsistent: Msg;
}
export type MessageKey = keyof MessageCatalog;
