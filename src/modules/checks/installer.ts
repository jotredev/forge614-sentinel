import { fail, pass, type CheckDefinition } from "../check";
import { lineDiff } from "../line-diff";
import { read } from "../snapshot";
import { renderTemplate } from "../template";

const SH_REPO = /^REPO="([^"]+)"$/m;
// install.ps1 declares its variables on one line
// (`$NodeName = "…"; $Repo = "…"; $AssetPrefix = "…"`), so no ^ anchor.
const PS_REPO = /\$Repo = "([^"]+)"/m;

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
