import { fail, pass, type CheckDefinition } from "../check";
import { DecisionsIndexSchema } from "../schemas/decisions-index";
import { has, listUnder, read } from "../snapshot";

const DECISIONS_DIR = "docs/decisions/";
const INDEX_PATH = "docs/decisions/INDEX.json";
const FILE_RE = /^docs\/decisions\/(\d{4})-[a-z0-9-]+\.md$/;
const STATE_RE = /^\*\*Estado:\*\*\s*(propuesta|aceptada|revocada|reemplazada por \d{4})(\s*\(.*\))?\s*$/m;
const RAW_STATE_RE = /^\*\*Estado:\*\*\s*(.+)$/m;
const SECTIONS = ["## Contexto", "## Decisión", "## Alternativas descartadas", "## Consecuencias"];

export const decisionsCheck: CheckDefinition = {
  id: "decisions",
  appliesWhen: () => true,
  run: (snapshot) => {
    const indexRaw = read(snapshot, INDEX_PATH);
    if (indexRaw === undefined) return fail([`${INDEX_PATH} missing`], "decisionsIndexMissing");

    const evidence: string[] = [];
    const files = listUnder(snapshot, DECISIONS_DIR).filter((p) => FILE_RE.test(p));
    let expected = 1;
    for (const path of files) {
      const name = path.slice(DECISIONS_DIR.length);
      const num = Number(FILE_RE.exec(path)?.[1]);
      if (num !== expected) evidence.push(`numbering gap before ${String(num).padStart(4, "0")}`);
      expected = num + 1;
      const text = read(snapshot, path) ?? "";
      if (!STATE_RE.test(text)) evidence.push(`${name}: invalid state '${RAW_STATE_RE.exec(text)?.[1]?.trim() ?? "?"}'`);
      for (const section of SECTIONS) if (!text.includes(`${section}\n`)) evidence.push(`${name}: missing section '${section}'`);
    }

    let parsedIndex: unknown;
    try {
      parsedIndex = JSON.parse(indexRaw);
    } catch {
      return fail([...evidence, `${INDEX_PATH}: invalid JSON`], "decisionRecordsInvalid");
    }
    const result = DecisionsIndexSchema.safeParse(parsedIndex);
    if (!result.success) {
      evidence.push(`${INDEX_PATH}: invalid index: ${result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    } else {
      const indexed = new Set(result.data.decisions.map((d) => d.file));
      for (const f of indexed) if (!has(snapshot, `${DECISIONS_DIR}${f}`)) evidence.push(`INDEX.json lists ${f} but file is missing (records are never deleted)`);
      for (const path of files) {
        const name = path.slice(DECISIONS_DIR.length);
        if (!indexed.has(name)) evidence.push(`INDEX.json does not list ${name}`);
      }
    }
    return evidence.length === 0 ? pass("decisionRecordsOk") : fail(evidence, "decisionRecordsInvalid");
  },
};
