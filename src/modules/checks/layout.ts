import { fail, pass, type CheckDefinition } from "../check";
import { has, hasDirectory, listUnder } from "../snapshot";

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

export const layoutCheck: CheckDefinition = {
  id: "layout",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    const evidence: string[] = [
      params.layout.source === "builtin"
        ? `layout list source: builtin (standard ${params.standard.version} ships no layout.json)`
        : "layout list source: standard/layout.json",
    ];
    let problems = 0;
    for (const dir of params.layout.directories) {
      if (!hasDirectory(snapshot, dir)) {
        evidence.push(`missing directory ${dir}/`);
        problems += 1;
      }
    }
    for (const file of params.layout.files) {
      if (!has(snapshot, file)) {
        evidence.push(`missing file ${file}`);
        problems += 1;
      }
    }
    // STANDARD §2: scripts/ holds only what the standard does not provide.
    const templateNames = new Set([...params.templates.keys()].map(basename));
    for (const path of listUnder(snapshot, "scripts/")) {
      const name = basename(path);
      if (templateNames.has(name)) {
        evidence.push(`${path} duplicates the standard template ${name}`);
        problems += 1;
      }
    }
    return problems === 0 ? pass("layoutOk", {}, evidence) : fail(evidence, "layoutIncomplete");
  },
};
