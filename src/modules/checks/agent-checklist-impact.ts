import { fail, pass, type CheckDefinition } from "../check";
import { listUnder, read } from "../snapshot";

const SECTION = "## Impacto en el procedimiento de agentes";
// `\b` cannot be used after "Sí": JS's ASCII-only \w does not treat "í" as a
// word character. A Unicode-aware separator (whitespace or punctuation) is
// used instead.
const IMPACT_RE = /^(Sí|No)[\s\p{P}].{10,}/su;

export const agentChecklistImpactCheck: CheckDefinition = {
  id: "agent-checklist-impact",
  appliesWhen: () => true,
  run: (snapshot) => {
    const evidence: string[] = [];
    for (const path of listUnder(snapshot, ".agents/plans/")) {
      const text = read(snapshot, path) ?? "";
      if (!/^\*\*Status:\*\*\s*completed\s*$/m.test(text)) continue;
      const start = text.indexOf(SECTION);
      const body = start < 0 ? "" : (text.slice(start + SECTION.length).split(/\n## /)[0]?.trim() ?? "");
      if (!IMPACT_RE.test(body)) evidence.push(`${path}: section '${SECTION}' must start with 'Sí' or 'No' and explain`);
    }
    return evidence.length === 0 ? pass("agentImpactDeclared") : fail(evidence, "agentImpactMissing");
  },
};
