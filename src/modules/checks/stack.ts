import { z } from "zod";
import { fail, pass, type CheckDefinition } from "../check";
import { compareSemver } from "../semver";
import { has, read } from "../snapshot";
import { stripCommentsAndStrings, stripJsonComments } from "../source-text";

const TsConfig = z.object({ compilerOptions: z.record(z.string(), z.unknown()).optional() }).passthrough();
const PackageEngines = z.object({ engines: z.object({ bun: z.string().optional() }).passthrough().optional() }).passthrough();
// `any` only where it is a type: annotation (`x: any`, `): any`), assertion
// (`as any`), type argument (`<any>`, `Record<string, any>`) and array
// (`any[]`). The scan runs on code whose comments, strings and regex bodies
// are blanked, so "any" in prose, in a message or in a pattern is never a hit.
const ANY_TYPE_RE = /:\s*any\b|\bas\s+any\b|<\s*any\s*>|,\s*any\s*>|\bany\s*\[\s*\]/;
// A suppression directive is a comment that starts with it, never the word
// inside a string or in the middle of a sentence.
const TS_DIRECTIVE = /^\s*(?:\/\/|\/\*+)\s*@ts-(ignore|expect-error)\b/;
const ENGINE_RE = /^\s*(?:>=|\^|~)?\s*(\d+\.\d+\.\d+)/;

function parseJson<T>(schema: z.ZodType<T>, raw: string, jsonc: boolean): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(jsonc ? stripJsonComments(raw) : raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const stackCheck: CheckDefinition = {
  id: "stack",
  appliesWhen: (snapshot) => has(snapshot, "package.json") || has(snapshot, "tsconfig.json"),
  run: (snapshot, params) => {
    const evidence: string[] = [
      params.stack.source === "builtin" ? `stack rules source: builtin (standard ${params.standard.version} ships no stack.json)` : "stack rules source: standard/stack.json",
    ];
    let problems = 0;
    const flag = (line: string): void => {
      evidence.push(line);
      problems += 1;
    };

    const tsconfigRaw = read(snapshot, "tsconfig.json");
    if (tsconfigRaw === undefined) flag("tsconfig.json missing");
    else {
      const tsconfig = parseJson(TsConfig, tsconfigRaw, true);
      if (tsconfig === null) flag("tsconfig.json: invalid JSON");
      else for (const f of params.stack.tsconfigFlags) if (tsconfig.compilerOptions?.[f] !== true) flag(`tsconfig.json: compilerOptions.${f} is not true`);
    }

    for (const [path, text] of snapshot.files) {
      if (!path.startsWith("src/") || !path.endsWith(".ts") || path.endsWith(".test.ts")) continue;
      const code = stripCommentsAndStrings(text).split("\n");
      text.split("\n").forEach((line, i) => {
        if (ANY_TYPE_RE.test(code[i] ?? "")) flag(`${path}:${i + 1}: any`);
        const directive = TS_DIRECTIVE.exec(line)?.[1];
        if (directive !== undefined) flag(`${path}:${i + 1}: @ts-${directive}`);
      });
    }

    if (!has(snapshot, "bun.lock")) flag("bun.lock missing");

    const pkgRaw = read(snapshot, "package.json");
    if (pkgRaw === undefined) flag("package.json missing");
    else {
      const pkg = parseJson(PackageEngines, pkgRaw, false);
      if (pkg === null) flag("package.json: invalid JSON");
      else {
        const engine = pkg.engines?.bun;
        if (engine === undefined) flag("package.json: engines.bun missing");
        else {
          const version = ENGINE_RE.exec(engine)?.[1];
          if (version === undefined) flag(`package.json: engines.bun '${engine}' is not a version constraint`);
          else if (compareSemver(version, params.stack.minimumBun) < 0) flag(`package.json: engines.bun '${engine}' is below the minimum ${params.stack.minimumBun}`);
        }
      }
    }
    return problems === 0 ? pass("stackOk", {}, evidence) : fail(evidence, "stackViolations");
  },
};
