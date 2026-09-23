import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileFetcher } from "../infrastructure/network";
import { standardSource } from "../modules/standard-source";
import { buildCheckParams, BUILTIN_ALLOWED_EXTRA_JOBS, BUILTIN_LAYOUT, LEGACY_VALIDATOR_IDS } from "./build-check-params";
import { fetchStandard } from "./fetch-standard";
import { loadStandard, type LoadedStandard } from "./load-standard";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
const pointer = { schemaVersion: 1 as const, node: "demo", kind: "product" as const, standard: { version: "1.0.0", sha256: SHA } };
const BASE = pathToFileURL(resolve(import.meta.dir, "../../fixtures/standard")).href;

async function realStandard(): Promise<LoadedStandard> {
  const cacheRoot = mkdtempSync(join(tmpdir(), "sentinel-params-"));
  await fetchStandard({ source: standardSource("1.0.0"), cacheRoot, fetcher: fileFetcher(), releaseBase: BASE });
  const r = loadStandard({ version: "1.0.0", expectedSha256: SHA, cacheRoot });
  if (!r.ok) throw new Error(r.error);
  return r.standard;
}

const common = { pointer, pointerVersionSha256: SHA, today: "2026-09-23", sentinelVersion: "0.1.0", knownCheckIds: ["package-naming"] };

test("builds every parameter from the real standard 1.0.0", async () => {
  const r = buildCheckParams({ ...common, standard: await realStandard() });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const p = r.params;
  expect(p.pack.name).toBe("forge614-pack-ecosystem-node");
  expect(p.pack.rules).toHaveLength(16);
  expect(p.manifests.size).toBe(16);
  expect(p.manifests.get("forge614-rule-bilingual-docs")?.validator).toBe("bilingual-docs");
  expect(p.forbiddenMentions.terms.length).toBeGreaterThan(0);
  expect(p.forbiddenMentions.excludePaths).toContain(".superpowers/");
  expect([...p.templates.keys()].sort()).toEqual(expect.arrayContaining(["install.sh", "install.ps1", "verify.yml", "release.yml", "CONTRACT.md", "hooks/pre-push"]));
  expect(p.ecosystemContract.length).toBeGreaterThan(1000);
  expect(p.layout).toEqual(BUILTIN_LAYOUT);
  expect(p.stack.source).toBe("builtin");
  expect(p.secrets.source).toBe("builtin");
  expect(p.standard).toEqual({ version: "1.0.0", sha256: SHA, pointerVersionSha256: SHA });
  expect(p.legacyValidatorIds).toEqual(LEGACY_VALIDATOR_IDS);
  expect(p.allowedExtraJobs).toEqual(BUILTIN_ALLOWED_EXTRA_JOBS);
  expect(BUILTIN_ALLOWED_EXTRA_JOBS).toEqual(["parity"]);
  expect(p.parseYaml("a: 1")).toEqual({ a: 1 });
});

test("standard/layout.json, stack.json and secret-patterns.json override the builtin defaults when the standard ships them (1.1.0)", async () => {
  const base = await realStandard();
  const files = new Map(base.files);
  files.set("layout.json", JSON.stringify({ schemaVersion: 1, directories: ["src"], files: ["README.md"] }));
  files.set("stack.json", JSON.stringify({ schemaVersion: 1, tsconfigFlags: ["strict"], minimumBun: "1.4.2" }));
  files.set("secret-patterns.json", JSON.stringify({ schemaVersion: 1, patterns: [{ id: "x", pattern: "XSECRET[0-9]+" }], excludePaths: ["fixtures/"] }));
  const r = buildCheckParams({ ...common, standard: { ...base, files } });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.params.layout).toEqual({ directories: ["src"], files: ["README.md"], source: "standard/layout.json" });
  expect(r.params.stack).toEqual({ tsconfigFlags: ["strict"], minimumBun: "1.4.2", source: "standard/stack.json" });
  expect(r.params.secrets.patterns).toEqual([{ id: "x", pattern: "XSECRET[0-9]+" }]);
});

test("a standard whose pack.json or a manifest is invalid is STANDARD_CORRUPT (its sha256 passed, so the release itself is broken)", async () => {
  const base = await realStandard();
  const files = new Map(base.files);
  files.set("packs/forge614-pack-ecosystem-node/pack.json", "{ not json");
  const r = buildCheckParams({ ...common, standard: { ...base, files } });
  expect(r).toMatchObject({ ok: false, code: "STANDARD_CORRUPT" });
  const files2 = new Map(base.files);
  files2.set("rules/forge614-rule-package-naming/manifest.json", JSON.stringify({ schemaVersion: 1 }));
  expect(buildCheckParams({ ...common, standard: { ...base, files: files2 } })).toMatchObject({ ok: false, code: "STANDARD_CORRUPT" });
});
