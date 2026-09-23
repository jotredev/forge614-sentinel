import { fail, pass, type CheckDefinition } from "../check";
import { countHeadings, headingNumbering } from "../headings";
import { listUnder, read } from "../snapshot";

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["README.md", "README.en.md"],
  ["standard/STANDARD.md", "standard/STANDARD.en.md"],
  ["CONTRACT.md", "CONTRACT.en.md"],
  ["standard/FORGE614_ECOSYSTEM_CONTRACT.md", "standard/FORGE614_ECOSYSTEM_CONTRACT.en.md"],
];

export const docsParityCheck: CheckDefinition = {
  id: "docs-parity",
  appliesWhen: () => true,
  run: (snapshot) => {
    const evidence: string[] = [];
    for (const [es, en] of PAIRS) {
      const a = read(snapshot, es);
      const b = read(snapshot, en);
      if (a !== undefined && b === undefined) {
        evidence.push(`${es}: missing ${en}`);
        continue;
      }
      if (b !== undefined && a === undefined) {
        evidence.push(`${en}: missing ${es}`);
        continue;
      }
      if (a === undefined || b === undefined) continue;
      const ha = countHeadings(a);
      const hb = countHeadings(b);
      if (ha !== hb) evidence.push(`${es}: ${ha} headings vs ${en}: ${hb}`);
      const na = headingNumbering(a);
      const nb = headingNumbering(b);
      if (JSON.stringify(na) !== JSON.stringify(nb)) evidence.push(`${es}: heading numbering [${na.join(", ")}] vs ${en}: [${nb.join(", ")}]`);
    }
    for (const es of listUnder(snapshot, "docs/es/")) {
      const num = /docs\/es\/(\d{2})-/.exec(es)?.[1];
      if (!num) continue;
      const en = listUnder(snapshot, `docs/en/${num}-`)[0];
      if (!en) {
        evidence.push(`${es}: missing docs/en/${num}-*.md`);
        continue;
      }
      const ha = countHeadings(read(snapshot, es) ?? "");
      const hb = countHeadings(read(snapshot, en) ?? "");
      if (ha !== hb) evidence.push(`${es}: ${ha} headings vs ${en}: ${hb}`);
    }
    return evidence.length === 0 ? pass("docsParityOk") : fail(evidence, "docsParityBroken");
  },
};
