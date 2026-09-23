import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SRC = resolve(import.meta.dir, "../../src");
type Layer = "modules" | "app" | "infrastructure" | "interfaces";
const ALLOWED: Record<Layer, readonly Layer[]> = {
  modules: ["modules"],
  infrastructure: ["infrastructure", "modules"],
  app: ["app", "modules", "infrastructure"],
  interfaces: ["interfaces", "app", "modules"],
};
const MODULES_EXTERNAL_ALLOWLIST = new Set(["node:crypto", "node:util", "zod"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function layerOf(file: string): Layer {
  const first = relative(SRC, file).split(/[\\/]/)[0];
  if (first === "modules" || first === "app" || first === "infrastructure" || first === "interfaces") return first;
  throw new Error(`file outside a known layer: ${file}`);
}

// Three shapes of module reference: `import/export ... from "x"` (multi-line
// and `type` imports included), a side-effect `import "x"`, and a dynamic
// `import("x")`.
const IMPORT_RE = /^\s*(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;

function specifiersOf(text: string): string[] {
  return [...text.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
}

function importsOf(file: string): string[] {
  return specifiersOf(readFileSync(file, "utf8"));
}

describe("IMPORT_RE", () => {
  test("covers from-imports, re-exports, side-effect imports and dynamic import()", () => {
    const sample = [
      'import { a } from "./a";',
      "import type { B } from './b';",
      'export { c } from "./c";',
      'export type { D } from "./d";',
      'import "./side-effect";',
      'const e = await import("./e");',
      'import {\n  f,\n} from "./f";',
      'const notAnImport = "from \'./x\'";',
    ].join("\n");
    expect(specifiersOf(sample)).toEqual(["./a", "./b", "./c", "./d", "./side-effect", "./e", "./f"]);
  });
});

describe("layer import rules (STANDARD §2)", () => {
  const files = walk(SRC);
  test("src has at least one file per layer", () => {
    const layers: Layer[] = ["modules", "app", "infrastructure", "interfaces"];
    for (const layer of layers) {
      expect(files.some((file) => layerOf(file) === layer), `expected at least one .ts file in src/${layer}`).toBe(true);
    }
  });
  for (const file of files) {
    test(relative(SRC, file), () => {
      const from = layerOf(file);
      for (const spec of importsOf(file)) {
        // package.json is imported as data by interfaces/cli/version.ts so the
        // compiled binary carries its own version; a .json file has no layer.
        if (spec.endsWith(".json")) {
          expect(from, `only interfaces may import JSON data: ${spec} in ${relative(SRC, file)}`).toBe("interfaces");
          continue;
        }
        if (spec.startsWith(".")) {
          const target = resolve(dirname(file), `${spec.replace(/\.js$/, "")}.ts`);
          const to = layerOf(target);
          expect(ALLOWED[from], `${from} → ${to} in ${relative(SRC, file)}`).toContain(to);
        } else if (from === "modules") {
          expect(MODULES_EXTERNAL_ALLOWLIST.has(spec), `modules imports external ${spec}`).toBe(true);
        }
      }
    });
  }
});
