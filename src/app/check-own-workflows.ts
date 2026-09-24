import type { CheckResult } from "../modules/check";
import { workflowsCheck } from "../modules/checks/workflows";
import { devCheckParams } from "./dev-params";
import { takeSnapshot } from "./take-snapshot";

export function checkOwnWorkflows(root: string, sentinelVersion: string): CheckResult {
  return workflowsCheck.run(takeSnapshot(root), devCheckParams(sentinelVersion, new Date().toISOString().slice(0, 10)));
}
