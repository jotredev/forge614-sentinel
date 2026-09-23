import { fail, pass, type CheckDefinition } from "../check";
import { parseJsonData } from "../json-data";
import { SupportMatrixSchema } from "../schemas/support-matrix";
import { has, read } from "../snapshot";

const DAY = 86_400_000;
const MATRIX_PATH = "standard/support-matrix.json";

export const supportMatrixCheck: CheckDefinition = {
  id: "support-matrix",
  appliesWhen: (snapshot) => has(snapshot, MATRIX_PATH),
  run: (snapshot, params) => {
    const raw = read(snapshot, MATRIX_PATH);
    if (raw === undefined) return fail([`${MATRIX_PATH} missing`], "supportMatrixMissing");
    const json = parseJsonData(MATRIX_PATH, raw);
    if (!json.ok) return fail([json.evidence], "dataFileInvalidJson");
    const parsed = SupportMatrixSchema.safeParse(json.data);
    if (!parsed.success) return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), "supportMatrixInvalid");
    const evidence: string[] = [];
    for (const cell of parsed.data.cells) {
      if (cell.status !== "revalidate" || cell.revalidateSince === undefined) continue;
      if (Date.parse(params.today) - Date.parse(cell.revalidateSince) > 30 * DAY) {
        evidence.push(`${cell.node}/${cell.agent}: in revalidate since ${cell.revalidateSince} (> 30 days)`);
      }
    }
    return evidence.length === 0 ? pass("supportMatrixCurrent") : fail(evidence, "supportMatrixStale", { days: "30" });
  },
};
