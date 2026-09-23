import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { packageNamingCheck } from "./package-naming";

const params = testParams();

test("id and appliesWhen: always applies", () => {
  expect(packageNamingCheck.id).toBe("package-naming");
  expect(packageNamingCheck.appliesWhen(snapshotFrom({}), params)).toBe(true);
});

test("every folder under standard/rules, packs and .agents/{rules,skills,policies,mcps,plugins} is canonical", () => {
  expect(packageNamingCheck.run(snapshotFromDir("package-naming/pass"), params).verdict).toBe("pass");
  const r = packageNamingCheck.run(snapshotFromDir("package-naming/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual([".agents/skills/pdf-tools", "standard/rules/package-naming"]);
  expect(r.messageKey).toBe("packageNamesInvalid");
});

test("a Hub package under .agents/ with a manifest.json must be canonical too", () => {
  const r = packageNamingCheck.run(snapshotFrom({ ".agents/skills/pdf-tools/manifest.json": "{}" }), params);
  expect(r.evidence).toEqual([".agents/skills/pdf-tools"]);
});
