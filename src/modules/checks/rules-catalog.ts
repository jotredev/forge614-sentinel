import { fail, pass, type CheckDefinition } from "../check";
import { parseJsonData } from "../json-data";
import { PackSchema } from "../schemas/pack";
import { RuleManifestSchema } from "../schemas/rule-manifest";
import { has, hasDirectory, listUnder, read } from "../snapshot";

// Rules catalog and packs catalog in one check (spec §8.1): the evidence
// strings are the ones forge614-ai's two validators produced, rules first,
// then packs, then the invalid-JSON lines each of them appended.
export const rulesCatalogCheck: CheckDefinition = {
  id: "rules-catalog",
  appliesWhen: (snapshot) => hasDirectory(snapshot, "standard/rules") || hasDirectory(snapshot, "standard/packs"),
  run: (snapshot, params) => {
    const evidence: string[] = [];
    const invalidJson: string[] = [];
    const known = new Set([...params.knownCheckIds, ...Object.keys(params.legacyValidatorIds)]);

    const dirs = new Set(listUnder(snapshot, "standard/rules/").map((p) => p.split("/")[2] ?? ""));
    for (const dir of [...dirs].sort()) {
      const base = `standard/rules/${dir}/`;
      const raw = read(snapshot, `${base}manifest.json`);
      if (raw === undefined) {
        evidence.push(`${dir}: missing manifest.json`);
        continue;
      }
      const json = parseJsonData(`${base}manifest.json`, raw);
      if (!json.ok) {
        invalidJson.push(json.evidence);
        continue;
      }
      const parsed = RuleManifestSchema.safeParse(json.data);
      if (!parsed.success) {
        evidence.push(`${dir}: invalid manifest: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        continue;
      }
      if (parsed.data.name !== dir) evidence.push(`${dir}: manifest.name '${parsed.data.name}' differs from folder`);
      if (parsed.data.validator !== undefined && !known.has(parsed.data.validator)) evidence.push(`${dir}: unknown validator '${parsed.data.validator}'`);
      if (!has(snapshot, `${base}RULE.md`)) evidence.push(`${dir}: missing RULE.md`);
      if (!has(snapshot, `${base}RULE.en.md`)) evidence.push(`${dir}: missing RULE.en.md`);
    }

    for (const path of listUnder(snapshot, "standard/packs/").filter((p) => p.endsWith("/pack.json"))) {
      const dir = path.split("/")[2] ?? "";
      const json = parseJsonData(path, read(snapshot, path) ?? "{}");
      if (!json.ok) {
        invalidJson.push(json.evidence);
        continue;
      }
      const parsed = PackSchema.safeParse(json.data);
      if (!parsed.success) {
        evidence.push(`${dir}: invalid pack.json`);
        continue;
      }
      if (parsed.data.name !== dir) evidence.push(`${dir}: pack name '${parsed.data.name}' differs from folder`);
      for (const rule of parsed.data.rules) if (!has(snapshot, `standard/rules/${rule}/manifest.json`)) evidence.push(`${dir}: rule '${rule}' not found in standard/rules`);
    }

    const all = [...evidence, ...invalidJson];
    return all.length === 0 ? pass("rulesCatalogOk") : fail(all, "rulesCatalogInvalid");
  },
};
