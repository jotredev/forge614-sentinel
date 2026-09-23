import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { nodeContractCheck } from "./node-contract";

// The standard's workflow templates decide which package.json scripts are
// public commands: whatever CI invokes through `bun run <script>`.
const params = testParams({
  templates: new Map([
    ["verify.yml", "      - run: bun install --frozen-lockfile\n      - run: bun run verify\n"],
    ["release.yml", "      - run: bun run build:target\n      - run: bun run smoke:target\n      - run: bun run release:publish\n"],
  ]),
});

test("applies when CONTRACT.md or CONTRACT.en.md exists", () => {
  expect(nodeContractCheck.appliesWhen(snapshotFrom({}), params)).toBe(false);
  expect(nodeContractCheck.appliesWhen(snapshotFrom({ "CONTRACT.en.md": "" }), params)).toBe(true);
});

test("passes when every bun run command is a script, every public script is listed, codes exist in cli sources and both languages have the same rows", () => {
  expect(nodeContractCheck.run(snapshotFromDir("node-contract/pass"), params).verdict).toBe("pass");
});

test("reports missing script, unlisted public script, ghost code, unlisted cli code and row parity", () => {
  const r = nodeContractCheck.run(snapshotFromDir("node-contract/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual([
    "CONTRACT.md: command 'bun run nope' has no package.json script 'nope'",
    "package.json: script 'release:publish' is run by the standard's workflow templates but CONTRACT.md does not list 'bun run release:publish'",
    "CONTRACT.md: code GHOST_CODE not found in src/interfaces/cli",
    "src/interfaces/cli/main.ts:1: code UNLISTED_CODE not in CONTRACT.md",
    "CONTRACT.md: 2 command rows vs CONTRACT.en.md: 1",
    "CONTRACT.md: 2 error code rows vs CONTRACT.en.md: 1",
  ]);
});

test("a missing twin or a missing package.json is evidence", () => {
  const r = nodeContractCheck.run(snapshotFrom({ "CONTRACT.md": "# c\n## Comandos públicos\n| Comando | x |\n| --- | --- |\n| `bun run a` | y |\n" }), params);
  expect(r.evidence).toEqual(expect.arrayContaining(["CONTRACT.en.md missing", "package.json missing"]));
});
