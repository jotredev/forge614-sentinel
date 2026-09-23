import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { layoutCheck } from "./layout";

const params = testParams({ templates: new Map([["install.sh", "#!"], ["verify.yml", "name: verify"], ["hooks/pre-push", "#!"]]) });

test("passes with every mandatory directory and file, declaring the builtin list for standard 1.0.0", () => {
  const r = layoutCheck.run(snapshotFromDir("layout/pass"), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["layout list source: builtin (standard 1.0.0 ships no layout.json)"]);
});

test("lists every missing directory and file, and scripts/ files that duplicate a template", () => {
  const r = layoutCheck.run(snapshotFromDir("layout/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual([
    "layout list source: builtin (standard 1.0.0 ships no layout.json)",
    "missing directory src/app/",
    "missing directory src/infrastructure/",
    "missing directory src/interfaces/",
    "missing directory docs/es/",
    "missing directory docs/en/",
    "missing directory docs/decisions/",
    "missing directory .github/workflows/",
    "missing file CONTRACT.md",
    "missing file .githooks/pre-push",
    "missing file .agents/templates/plan.md",
    "scripts/install.sh duplicates the standard template install.sh",
  ]);
});

test("when the standard ships layout.json the evidence names it instead", () => {
  const p = testParams({ layout: { directories: ["src"], files: ["README.md"], source: "standard/layout.json" } });
  const r = layoutCheck.run(snapshotFrom({ "src/a.ts": "", "README.md": "" }), p);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["layout list source: standard/layout.json"]);
});
