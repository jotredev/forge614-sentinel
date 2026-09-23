import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { agentChecklistImpactCheck } from "./agent-checklist-impact";

const params = testParams();
const plan = (status: string, impact: string) => `# P\n\n**Date:** 2026-09-22\n**Type:** feature\n**Status:** ${status}\n\n## Impacto en el procedimiento de agentes\n${impact}\n## Result\nok\n`;

test("completed plans need Sí/No with content; in_progress plans are skipped", () => {
  expect(agentChecklistImpactCheck.run(snapshotFromDir("agent-checklist-impact/pass"), params).verdict).toBe("pass");
  const r = agentChecklistImpactCheck.run(snapshotFromDir("agent-checklist-impact/fail"), params);
  expect(r.evidence).toEqual([".agents/plans/2026-09-22--b.md: section '## Impacto en el procedimiento de agentes' must start with 'Sí' or 'No' and explain"]);
  const s = snapshotFrom({
    ".agents/plans/c.md": plan("in_progress", ""),
    ".agents/plans/d.md": plan("completed", "Sí — Engines acepta --readable-dir; agregar validación en la sección de Engines."),
  });
  expect(agentChecklistImpactCheck.run(s, params).verdict).toBe("pass");
});

test("passes when there are no plans at all", () => {
  expect(agentChecklistImpactCheck.run(snapshotFrom({}), params).verdict).toBe("pass");
});
