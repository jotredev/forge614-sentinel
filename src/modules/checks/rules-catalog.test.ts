import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { rulesCatalogCheck } from "./rules-catalog";

const params = testParams({ knownCheckIds: ["package-naming", "docs-parity"] });

test("applies only when standard/rules or standard/packs exist", () => {
  expect(rulesCatalogCheck.appliesWhen(snapshotFrom({ "README.md": "" }), params)).toBe(false);
  expect(rulesCatalogCheck.appliesWhen(snapshotFromDir("rules-catalog/pass"), params)).toBe(true);
});

test("catalog: manifest valid, folder = name, RULE.md + RULE.en.md, validator known, pack rules exist", () => {
  expect(rulesCatalogCheck.run(snapshotFromDir("rules-catalog/pass"), params).verdict).toBe("pass");
  const r = rulesCatalogCheck.run(snapshotFromDir("rules-catalog/fail"), params);
  expect(r.evidence).toEqual(
    expect.arrayContaining([
      "forge614-rule-x: manifest.name 'forge614-rule-y' differs from folder",
      "forge614-rule-x: unknown validator 'nope'",
      "forge614-rule-x: missing RULE.en.md",
      "forge614-pack-ecosystem-node: rule 'forge614-rule-zzz' not found in standard/rules",
    ]),
  );
});

test("a legacy validator id (bilingual-docs) is known through the legacy map", () => {
  const manifest = JSON.stringify({ schemaVersion: 1, name: "forge614-rule-bilingual-docs", version: "1.0.0", level: "core", title: { es: "t", en: "t" }, appliesWhen: [], validator: "bilingual-docs", decisions: ["0002"] });
  const s = snapshotFrom({ "standard/rules/forge614-rule-bilingual-docs/manifest.json": manifest, "standard/rules/forge614-rule-bilingual-docs/RULE.md": "#", "standard/rules/forge614-rule-bilingual-docs/RULE.en.md": "#" });
  expect(rulesCatalogCheck.run(s, params).verdict).toBe("pass");
});

test("invalid JSON in a manifest or pack is evidence, never a throw; missing manifest is reported; pack name must match folder", () => {
  const s = snapshotFrom({
    "standard/rules/forge614-rule-x/manifest.json": "{ not json",
    "standard/rules/forge614-rule-z/RULE.md": "# r",
    "standard/packs/forge614-pack-ecosystem-node/pack.json": JSON.stringify({ schemaVersion: 1, name: "forge614-pack-other", version: "1.0.0", title: { es: "n", en: "n" }, rules: ["forge614-rule-z"] }),
  });
  const r = rulesCatalogCheck.run(s, params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(
    expect.arrayContaining([
      "forge614-rule-z: missing manifest.json",
      "forge614-pack-ecosystem-node: pack name 'forge614-pack-other' differs from folder",
      "forge614-pack-ecosystem-node: rule 'forge614-rule-z' not found in standard/rules",
    ]),
  );
  expect(r.evidence.some((e) => e.startsWith("standard/rules/forge614-rule-x/manifest.json: invalid JSON: "))).toBe(true);
});
