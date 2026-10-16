import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileFetcher } from "../../infrastructure/network";
import { fetchStandard } from "../../app/fetch-standard";
import { loadStandard } from "../../app/load-standard";
import { takeSnapshot } from "../../app/take-snapshot";
import { standardSource } from "../standard-source";
import { DEMO_POINTER, SHA, testParams } from "../../../tests/helpers/params";
import { FIXTURES, snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { installerCheck } from "./installer";

// The real templates of standard 1.0.0, from the fixture archive.
async function realTemplates(): Promise<Map<string, string>> {
  const cacheRoot = mkdtempSync(join(tmpdir(), "sentinel-installer-"));
  await fetchStandard({ source: standardSource("1.0.0"), cacheRoot, fetcher: fileFetcher(), releaseBase: pathToFileURL(resolve(import.meta.dir, "../../../fixtures/standard")).href });
  const r = loadStandard({ version: "1.0.0", expectedSha256: SHA, cacheRoot });
  if (!r.ok) throw new Error(r.error);
  const templates = new Map<string, string>();
  for (const [p, t] of r.standard.files) if (p.startsWith("templates/")) templates.set(p.slice("templates/".length), t);
  return templates;
}

test("forge614-ai is exempt; every other node applies", () => {
  expect(installerCheck.appliesWhen(snapshotFrom({}), testParams({ pointer: { ...DEMO_POINTER, node: "ai" } }))).toBe(false);
  expect(installerCheck.appliesWhen(snapshotFrom({}), testParams())).toBe(true);
});

test("passes when both installers equal the template rendered with the node's variables", async () => {
  const params = testParams({ templates: await realTemplates() });
  const r = installerCheck.run(snapshotFromDir("installer/pass"), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual([]);
});

test("reports a line diff for a drifted install.sh and a missing install.ps1", async () => {
  const params = testParams({ templates: await realTemplates() });
  const r = installerCheck.run(snapshotFromDir("installer/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence[0]).toMatch(/^install\.sh:\d+: expected 'set -euo pipefail' got 'set -eu'$/);
  expect(r.evidence).toContain("install.ps1 missing");
  expect(r.evidence.some((e) => /^install\.sh: \d+ lines vs template \d+$/.test(e))).toBe(true);
});

test("REPO is taken from the file's own assignment; NODE_NAME, ASSET_PREFIX and STANDARD_VERSION from the pointer", async () => {
  const templates = await realTemplates();
  const params = testParams({ templates });
  const sh = (templates.get("install.sh") ?? "").replace("{{NODE_NAME}}", "demo").replace("{{REPO}}", "acme/forge614-demo").replace("{{ASSET_PREFIX}}", "forge614-demo").replace(/\{\{STANDARD_VERSION\}\}/g, "1.0.0");
  const ps = (templates.get("install.ps1") ?? "").replace("{{NODE_NAME}}", "demo").replace("{{REPO}}", "acme/forge614-demo").replace("{{ASSET_PREFIX}}", "forge614-demo").replace(/\{\{STANDARD_VERSION\}\}/g, "1.0.0");
  expect(installerCheck.run(snapshotFrom({ "install.sh": sh, "install.ps1": ps }), params).verdict).toBe("pass");
  const wrongNode = sh.replace('NODE_NAME="demo"', 'NODE_NAME="other"');
  expect(installerCheck.run(snapshotFrom({ "install.sh": wrongNode, "install.ps1": ps }), params).verdict).toBe("fail");
});

test("STANDARD_VERSION is the version the node declares, also when --standard forces another one", async () => {
  const params = testParams({ templates: await realTemplates(), standard: { version: "1.1.0", sha256: "0".repeat(64), pointerVersionSha256: SHA } });
  expect(installerCheck.run(snapshotFromDir("installer/pass"), params).verdict).toBe("pass");
});

test("a CRLF checkout of install.sh passes", async () => {
  // Bytes with \r\n on disk, read through takeSnapshot: the comparison sees
  // LF text, as a Windows checkout with core.autocrlf=true would.
  const params = testParams({ templates: await realTemplates() });
  const root = mkdtempSync(join(tmpdir(), "sentinel-installer-crlf-"));
  for (const name of ["install.sh", "install.ps1"]) {
    writeFileSync(join(root, name), readFileSync(join(FIXTURES, "installer/pass", name), "utf8").replace(/\n/g, "\r\n"));
  }
  expect(readFileSync(join(root, "install.sh"), "utf8")).toContain("\r\n");
  expect(installerCheck.run(takeSnapshot(root), params).verdict).toBe("pass");
});

test("new-template mode compares install.mjs and both porters as raw bytes", () => {
  const templates = new Map([
    ["install.mjs", "export const installer = true;\n"],
    ["install.sh", 'NODE_NAME="{{NODE_NAME}}"\nREPO="{{REPO}}"\n'],
    ["install.ps1", '\uFEFF$NodeName = "{{NODE_NAME}}"; $Repo = "{{REPO}}"\n'],
  ]);
  const pointer = {
    ...DEMO_POINTER,
    install: {
      repository: "jotredev/forge614-demo",
      minimumNodeVersion: "22.19.0",
      systems: [
        { os: "darwin" as const, architectures: ["arm64" as const, "x64" as const] },
        { os: "linux" as const, architectures: ["arm64" as const, "x64" as const] },
        { os: "windows" as const, architectures: ["x64" as const] },
      ],
      tagFormat: "vX.Y.Z" as const,
      asset: { type: "binary-tar-gzip-or-zip" as const, pattern: "forge614-demo-<plat>-<arch>.tar.gz|.zip", checksumFile: "SHA256SUMS" as const },
      dependencies: [],
      path: { modify: false, retireWhen: null },
      smokeTest: ["--version"],
    },
  };
  const params = testParams({ pointer, templates });
  const good = snapshotFromDir("installer-new/pass");
  expect(installerCheck.run(good, params).verdict).toBe("pass");
  expect(installerCheck.run(snapshotFromDir("installer-new/fail-mjs"), params).verdict).toBe("fail");
  expect(installerCheck.run(snapshotFromDir("installer-new/fail-no-bom"), params).verdict).toBe("fail");
  const crlf = snapshotFrom(Object.fromEntries([...good.files].map(([path, text]) => [path, path === "install.sh" ? text.replace(/\n/g, "\r\n") : text])));
  expect(installerCheck.run(crlf, params).verdict).toBe("fail");
  expect(installerCheck.run(good, testParams({ templates, pointer: DEMO_POINTER })).evidence).toContain("install block missing for new installer template");
  const install = pointer.install;
  const missingPlatform = { ...install, systems: install.systems.filter((system) => system.os !== "windows") };
  const missingPlatformResult = installerCheck.run(good, testParams({ templates, pointer: { ...pointer, install: missingPlatform } }));
  expect(missingPlatformResult.verdict).toBe("fail");
  expect(missingPlatformResult.evidence).toContain("install block is missing required system windows-x64");
  const unresolvedPattern = { ...install, asset: { ...install.asset, pattern: "forge614-demo-<unknown>.tar.gz" } };
  const unresolvedResult = installerCheck.run(good, testParams({ templates, pointer: { ...pointer, install: unresolvedPattern } }));
  expect(unresolvedResult.verdict).toBe("fail");
  expect(unresolvedResult.evidence).toContain("install.asset.pattern cannot resolve darwin-arm64");
});
