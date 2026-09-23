import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { repoRoot } from "../../app/repo";
import { takeSnapshot } from "../../app/take-snapshot";
import { snapshotFrom, type RepoSnapshot } from "../snapshot";
import { stackCheck } from "./stack";

const params = testParams();
const BUILTIN_NOTE = "stack rules source: builtin (standard 1.0.0 ships no stack.json)";

// A fixture cannot be named *.test.ts (bun test would run it), so the test
// file of stack/fail is stored as bad.spec-fixture.ts and renamed here to
// the path the check must skip.
function failTree(): RepoSnapshot {
  const s = snapshotFromDir("stack/fail");
  return { files: new Map([...s.files].map(([p, text]) => [p.replace(/\.spec-fixture\.ts$/, ".test.ts"), text] as const)), facts: s.facts };
}

test("applies when package.json or tsconfig.json exists", () => {
  expect(stackCheck.appliesWhen(snapshotFrom({ "README.md": "" }), params)).toBe(false);
  expect(stackCheck.appliesWhen(snapshotFrom({ "package.json": "{}" }), params)).toBe(true);
});

test("passes on the conforming fixture, with the builtin-list note", () => {
  const r = stackCheck.run(snapshotFromDir("stack/pass"), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual([BUILTIN_NOTE]);
});

test("reports every violation: flags, any, ts-ignore, ts-expect-error, bun.lock, engines.bun", () => {
  const r = stackCheck.run(failTree(), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual([
    BUILTIN_NOTE,
    "tsconfig.json: compilerOptions.noUncheckedIndexedAccess is not true",
    "tsconfig.json: compilerOptions.exactOptionalPropertyTypes is not true",
    "src/app/bad.ts:1: any",
    "src/app/bad.ts:2: @ts-ignore",
    "src/app/bad.ts:5: @ts-expect-error",
    "bun.lock missing",
    "package.json: engines.bun '>=1.2.0' is below the minimum 1.3.9",
  ]);
});

test("test files under src/ are excluded (bad.spec-fixture.ts stands in for bad.test.ts)", () => {
  expect(stackCheck.run(failTree(), params).evidence.some((e) => e.startsWith("src/app/bad.test.ts"))).toBe(false);
  expect(stackCheck.run(snapshotFromDir("stack/fail"), params).evidence).toContain("src/app/bad.spec-fixture.ts:1: any");
});

test("missing tsconfig.json, missing engines and unparsable JSON are evidence", () => {
  const r = stackCheck.run(snapshotFrom({ "package.json": "{}", "bun.lock": "" }), params);
  expect(r.evidence).toEqual(expect.arrayContaining(["tsconfig.json missing", "package.json: engines.bun missing"]));
  const bad = stackCheck.run(snapshotFrom({ "package.json": "{ nope", "tsconfig.json": "{ nope", "bun.lock": "" }), params);
  expect(bad.evidence).toEqual(expect.arrayContaining(["tsconfig.json: invalid JSON", "package.json: invalid JSON"]));
});

const conforming = {
  "tsconfig.json": '{ // comment\n "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true } }',
  "package.json": JSON.stringify({ engines: { bun: ">=1.4.2" } }),
  "bun.lock": "",
};

test("tsconfig with comments (JSONC) is accepted; 'any' inside comments, strings and identifiers is not a hit", () => {
  const s = snapshotFrom({ ...conforming, "src/a.ts": 'const anyThing = "any"; // any\nexport const t = anyThing; /* as any */\nexport const p = Promise.any([]);\n' });
  expect(stackCheck.run(s, params).verdict).toBe("pass");
});

test("every type position of any is a hit: annotation, assertion, type argument and array", () => {
  const src = "let a: any;\nconst b = x as any;\nconst c = new Map<string, any>();\nconst d: Array<any> = [];\nconst e: any[] = [];\n";
  const r = stackCheck.run(snapshotFrom({ ...conforming, "src/a.ts": src }), params);
  expect(r.evidence.filter((line) => line.startsWith("src/"))).toEqual(["src/a.ts:1: any", "src/a.ts:2: any", "src/a.ts:3: any", "src/a.ts:4: any", "src/a.ts:5: any"]);
});

test("regex literals, strings and prose never produce any or directive hits", () => {
  const src = "const re = /[\"'`]/;\nconst p = /<any>|as any|: any/;\nexport const note = \"use @ts-ignore never\";\n// we never write @ts-ignore here\n";
  expect(stackCheck.run(snapshotFrom({ ...conforming, "src/b.ts": src }), params).verdict).toBe("pass");
});

test("Sentinel's own src/ has no stack hits (the check passes on the repository that ships it)", () => {
  const r = stackCheck.run(takeSnapshot(repoRoot), params);
  expect(r.evidence.filter((line) => line.startsWith("src/"))).toEqual([]);
});
