import { fail, pass, type CheckDefinition } from "../check";
import { read } from "../snapshot";

export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]+$/;
const CONTRACT_ROW = /^\|\s*`([^`]+)`\s*\|/;
const PRINT_ERROR = /printError\(\s*"([^"]+)"/g;

// Format only: every code in CONTRACT.md's error table and every literal
// passed to printError under src/ (tests excluded) is UPPER_SNAKE_CASE.
// Cross-consistency between table and code is node-contract's job.
export const errorCodesCheck: CheckDefinition = {
  id: "error-codes",
  appliesWhen: () => true,
  run: (snapshot) => {
    const evidence: string[] = [];
    const contract = read(snapshot, "CONTRACT.md");
    if (contract !== undefined) {
      const section = contract.split(/^## /m).find((s) => s.startsWith("Códigos de error")) ?? "";
      for (const line of section.split("\n")) {
        const m = CONTRACT_ROW.exec(line);
        if (m?.[1] !== undefined && m[1] !== "Código" && !ERROR_CODE_PATTERN.test(m[1])) evidence.push(`CONTRACT.md: ${m[1]}`);
      }
    }
    for (const [path, text] of snapshot.files) {
      if (!path.startsWith("src/") || !path.endsWith(".ts") || path.endsWith(".test.ts")) continue;
      text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(PRINT_ERROR)) {
          const code = m[1] ?? "";
          if (!ERROR_CODE_PATTERN.test(code)) evidence.push(`${path}:${i + 1}: ${code}`);
        }
      });
    }
    return evidence.length === 0 ? pass("errorCodesOk") : fail(evidence, "errorCodesInvalid");
  },
};
