import { fail, pass, type CheckDefinition } from "../check";
import { lineDiff } from "../line-diff";
import { read, readRaw } from "../snapshot";
import { renderTemplate } from "../template";
import type { CheckParams } from "../check-params";

const SH_REPO = /^REPO="([^"]+)"$/m;
// install.ps1 declares its variables on one line
// (`$NodeName = "…"; $Repo = "…"; $AssetPrefix = "…"`), so no ^ anchor.
const PS_REPO = /\$Repo = "([^"]+)"/m;

/** Compares two optional byte sequences without decoding or normalization. */
function bytesEqual(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
  return left !== undefined && right !== undefined && left.length === right.length && left.every((byte, index) => byte === right[index]);
}

/** Resolves one declared platform using the standard's asset-pattern tokens. */
function resolveAssetPattern(pattern: string, type: string, os: string, arch: string): string {
  let resolved = pattern.replaceAll("<ver>", "0.0.0").replaceAll("<plat>", os).replaceAll("<arch>", arch);
  if (type === "binary-tar-gzip-or-zip") resolved = resolved.replace(/\.tar\.gz\|\.zip$/, os === "windows" ? ".zip" : ".tar.gz");
  return resolved.replace("[.exe]", os === "windows" ? ".exe" : "");
}

/** Checks the mandatory system matrix and asset pattern from the install block. */
function installBlockEvidence(install: NonNullable<CheckParams["pointer"]["install"]>): string[] {
  const evidence: string[] = [];
  const required = [["darwin", "arm64"], ["darwin", "x64"], ["linux", "arm64"], ["linux", "x64"], ["windows", "x64"]] as const;
  for (const [os, arch] of required) {
    const declared = install.systems.some((system) => system.os === os && system.architectures.includes(arch));
    if (!declared) evidence.push(`install block is missing required system ${os}-${arch}`);
    const resolved = resolveAssetPattern(install.asset.pattern, install.asset.type, os, arch);
    if (resolved.length === 0 || /[<>|]/.test(resolved)) evidence.push(`install.asset.pattern cannot resolve ${os}-${arch}`);
  }
  return evidence;
}

// The installers are the standard's, rendered with the node's variables:
// any local edit is drift. REPO is the one variable the standard cannot
// know, so it is read from the file itself (defaulting to the ecosystem's
// naming); NODE_NAME, ASSET_PREFIX and STANDARD_VERSION come from the
// pointer. STANDARD_VERSION is the version the node declares, never the one
// forced with --standard: the node rendered its installers from its own
// standard, and a forced run must not turn that into drift.
export const installerCheck: CheckDefinition = {
  id: "installer",
  appliesWhen: (_snapshot, params) => params.pointer.node !== "ai",
  run: (snapshot, params) => {
    const newMode = params.templates.has("install.mjs");
    if (newMode) {
      const evidence: string[] = [];
      const install = params.pointer.install;
      if (install === undefined) evidence.push("install block missing for new installer template");
      else evidence.push(...installBlockEvidence(install));
      const repository = install?.repository;
      const vars = { NODE_NAME: params.pointer.node, REPO: repository ?? "" };
      for (const name of ["install.sh", "install.ps1"] as const) {
        const template = params.templates.get(name);
        if (template === undefined) {
          evidence.push(`template ${name} missing from standard ${params.standard.version}`);
          continue;
        }
        const rendered = renderTemplate(template, vars);
        const actual = readRaw(snapshot, name);
        const expectedBytes = new TextEncoder().encode(rendered);
        if (!bytesEqual(expectedBytes, actual)) evidence.push(`${name} differs from the raw rendered template or install.repository`);
        if (name === "install.sh" && actual !== undefined && new TextDecoder("utf-8", { ignoreBOM: true }).decode(actual).includes("\r\n")) evidence.push("install.sh contains CRLF bytes");
      }
      const templateMjs = params.rawTemplates.get("install.mjs");
      const actualMjs = readRaw(snapshot, "install.mjs");
      if (templateMjs === undefined) evidence.push(`raw template install.mjs missing from standard ${params.standard.version}`);
      else if (!bytesEqual(templateMjs, actualMjs)) evidence.push("install.mjs differs from template bytes");
      return evidence.length === 0 ? pass("installerOk") : fail(evidence, "installerDrifted");
    }
    const evidence: string[] = [];
    const node = params.pointer.node;
    const sh = read(snapshot, "install.sh");
    const ps = read(snapshot, "install.ps1");
    const repo = SH_REPO.exec(sh ?? "")?.[1] ?? PS_REPO.exec(ps ?? "")?.[1] ?? `jotredev/forge614-${node}`;
    const vars = { NODE_NAME: node, NODE_TITLE: node, REPO: repo, ASSET_PREFIX: `forge614-${node}`, STANDARD_VERSION: params.pointer.standard.version };

    for (const [name, actual] of [["install.sh", sh], ["install.ps1", ps]] as const) {
      const template = params.templates.get(name);
      if (template === undefined) {
        evidence.push(`template ${name} missing from standard ${params.standard.version}`);
        continue;
      }
      if (actual === undefined) {
        evidence.push(`${name} missing`);
        continue;
      }
      evidence.push(...lineDiff(renderTemplate(template, vars), actual, name));
    }
    return evidence.length === 0 ? pass("installerOk") : fail(evidence, "installerDrifted");
  },
};
