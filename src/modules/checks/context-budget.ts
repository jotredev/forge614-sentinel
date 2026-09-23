import { fail, pass, type CheckDefinition } from "../check";
import { parseJsonData } from "../json-data";
import { PackSchema } from "../schemas/pack";
import { has, read } from "../snapshot";

const PACK_PATH = "standard/packs/forge614-pack-ecosystem-node/pack.json";
const BUDGET = 3000;

// Coarse token estimate (acta 0020 asks only for an estimate, labeled as
// such in the message): ~4 characters per token.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const contextBudgetCheck: CheckDefinition = {
  id: "context-budget",
  appliesWhen: (snapshot) => has(snapshot, PACK_PATH),
  run: (snapshot) => {
    const raw = read(snapshot, PACK_PATH);
    if (raw === undefined) return fail([`${PACK_PATH} missing`], "contextBudgetInvalid");
    const json = parseJsonData(PACK_PATH, raw);
    if (!json.ok) return fail([json.evidence], "dataFileInvalidJson");
    const parsed = PackSchema.safeParse(json.data);
    if (!parsed.success) return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), "contextBudgetInvalid");

    const evidence: string[] = [];
    let total = 0;
    for (const rule of parsed.data.rules) {
      const firstLine = (read(snapshot, `standard/rules/${rule}/RULE.md`) ?? "").split("\n")[0]?.trim() ?? "";
      const tokens = estimateTokens(`${rule}: ${firstLine}`);
      total += tokens;
      evidence.push(`${rule}: ~${tokens} tokens (estimate)`);
    }
    const p = { tokens: String(total), budget: String(BUDGET) };
    return total > BUDGET ? fail(evidence, "contextBudgetOverBudget", p) : pass("contextBudgetOk", p, evidence);
  },
};
