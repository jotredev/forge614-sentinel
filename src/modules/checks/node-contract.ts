import { z } from "zod";
import { fail, pass, type CheckDefinition } from "../check";
import { tableRowsAfter } from "../headings";
import { has, listUnder, read } from "../snapshot";
import { ERROR_CODE_PATTERN } from "./error-codes";

const Scripts = z.object({ scripts: z.record(z.string(), z.string()).optional() }).passthrough();
const BUN_RUN = /`bun run ([a-z0-9:.-]+)`/g;
const CODE_CELL = /^`([^`]+)`$/;
const CLI_CODE_LITERAL = /\b(?:printError|runCli)\(\s*"([A-Z][A-Z0-9_]+)"/g;
const TEMPLATE_RUN = /\bbun run ([a-z0-9:.-]+)/g;
const HEADINGS = {
  es: { commands: "## Comandos públicos", codes: "## Códigos de error" },
  en: { commands: "## Public commands", codes: "## Error codes" },
} as const;

// A script is a public command when the standard's own workflow templates
// invoke it (`bun run verify`, `bun run build:target`, …): CI depends on it,
// so the contract must promise it. Derived from the loaded standard, never
// from a list inside the check.
function publicScripts(templates: ReadonlyMap<string, string>): Set<string> {
  const out = new Set<string>();
  for (const name of ["verify.yml", "release.yml"]) for (const m of (templates.get(name) ?? "").matchAll(TEMPLATE_RUN)) out.add(m[1] ?? "");
  return out;
}

function codesOf(rows: string[][]): string[] {
  return rows.map((r) => CODE_CELL.exec(r[0] ?? "")?.[1]).filter((c): c is string => c !== undefined && ERROR_CODE_PATTERN.test(c));
}

// The contract is a promise about package.json and the CLI; this check
// keeps the three in step, in both directions: every command row names a
// real script and every public script has a row; every listed code is a
// literal in the CLI and every CLI code is listed. Binary commands
// (`forge614-<node> …`) are not executed in 0.1: machine-contracts (0.2)
// does that.
export const nodeContractCheck: CheckDefinition = {
  id: "node-contract",
  appliesWhen: (snapshot) => has(snapshot, "CONTRACT.md") || has(snapshot, "CONTRACT.en.md"),
  run: (snapshot, params) => {
    const evidence: string[] = [];
    const es = read(snapshot, "CONTRACT.md");
    const en = read(snapshot, "CONTRACT.en.md");
    if (es === undefined) evidence.push("CONTRACT.md missing");
    if (en === undefined) evidence.push("CONTRACT.en.md missing");

    let scripts: Set<string> | undefined;
    const pkgRaw = read(snapshot, "package.json");
    if (pkgRaw === undefined) evidence.push("package.json missing");
    else {
      try {
        const parsed = Scripts.safeParse(JSON.parse(pkgRaw));
        if (parsed.success) scripts = new Set(Object.keys(parsed.data.scripts ?? {}));
        else evidence.push("package.json: scripts is not an object");
      } catch {
        evidence.push("package.json: invalid JSON");
      }
    }

    if (es !== undefined) {
      const commandRows = tableRowsAfter(es, HEADINGS.es.commands);
      const listedScripts = new Set<string>();
      for (const row of commandRows) for (const m of (row[0] ?? "").matchAll(BUN_RUN)) listedScripts.add(m[1] ?? "");
      if (scripts !== undefined) {
        for (const script of listedScripts) {
          if (!scripts.has(script)) evidence.push(`CONTRACT.md: command 'bun run ${script}' has no package.json script '${script}'`);
        }
        const required = publicScripts(params.templates);
        for (const script of [...scripts].sort()) {
          if (required.has(script) && !listedScripts.has(script)) {
            evidence.push(`package.json: script '${script}' is run by the standard's workflow templates but CONTRACT.md does not list 'bun run ${script}'`);
          }
        }
      }

      const listed = new Set(codesOf(tableRowsAfter(es, HEADINGS.es.codes)));
      const cliFiles = listUnder(snapshot, "src/interfaces/cli/").filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts"));
      const cliText = cliFiles.map((p) => read(snapshot, p) ?? "").join("\n");
      for (const code of listed) if (!cliText.includes(`"${code}"`)) evidence.push(`CONTRACT.md: code ${code} not found in src/interfaces/cli`);
      const reported = new Set<string>();
      for (const path of cliFiles) {
        (read(snapshot, path) ?? "").split("\n").forEach((line, i) => {
          for (const m of line.matchAll(CLI_CODE_LITERAL)) {
            const code = m[1] ?? "";
            if (!listed.has(code) && !reported.has(code)) {
              reported.add(code);
              evidence.push(`${path}:${i + 1}: code ${code} not in CONTRACT.md`);
            }
          }
        });
      }

      if (en !== undefined) {
        const enCommands = tableRowsAfter(en, HEADINGS.en.commands).length;
        const enCodes = tableRowsAfter(en, HEADINGS.en.codes).length;
        const esCodes = tableRowsAfter(es, HEADINGS.es.codes).length;
        if (commandRows.length !== enCommands) evidence.push(`CONTRACT.md: ${commandRows.length} command rows vs CONTRACT.en.md: ${enCommands}`);
        if (esCodes !== enCodes) evidence.push(`CONTRACT.md: ${esCodes} error code rows vs CONTRACT.en.md: ${enCodes}`);
      }
    }
    return evidence.length === 0 ? pass("nodeContractOk") : fail(evidence, "nodeContractBroken");
  },
};
