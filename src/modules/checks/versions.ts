import { z } from "zod";
import { fail, pass, type CheckDefinition } from "../check";
import { highestSemver, SEMVER_PATTERN } from "../semver";
import { has, read } from "../snapshot";

const PackageVersion = z.object({ version: z.string().optional() }).passthrough();
const NotionMapVersion = z.object({ productVersion: z.string().optional() }).passthrough();

function readJson<T>(schema: z.ZodType<T>, raw: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// spec §8.2 (ruling R29): exact equality of package.json.version, the
// highest v* tag when the checkout has tags, and notion-map productVersion.
// A shallow CI clone (actions/checkout fetch-depth 1) carries no tags, so
// pull requests compare package.json with notion-map only; the release
// workflow runs on the pushed tag, which must then equal package.json.
// `--version` is not executed in 0.1 (machine-contracts, 0.2).
export const versionsCheck: CheckDefinition = {
  id: "versions",
  appliesWhen: (snapshot) => has(snapshot, "package.json"),
  run: (snapshot) => {
    const evidence: string[] = [];
    let problems = 0;
    const flag = (line: string): void => {
      evidence.push(line);
      problems += 1;
    };

    const pkg = readJson(PackageVersion, read(snapshot, "package.json") ?? "");
    const pkgVersion = pkg?.version;
    if (pkg === null) flag("package.json: invalid JSON");
    else if (pkgVersion === undefined) flag("package.json: version missing");
    else if (!SEMVER_PATTERN.test(pkgVersion)) flag(`package.json: version '${pkgVersion}' is not X.Y.Z`);

    if (!snapshot.facts.gitAvailable) evidence.push("git tags not available (not a git checkout)");
    const highestTag = highestSemver(snapshot.facts.gitTags.filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).map((t) => t.slice(1)));
    if (highestTag !== undefined && pkgVersion !== undefined && SEMVER_PATTERN.test(pkgVersion) && pkgVersion !== highestTag) {
      flag(`package.json version ${pkgVersion} vs highest tag v${highestTag}`);
    }

    const mapRaw = read(snapshot, "docs/notion-map.json");
    if (mapRaw === undefined) flag("docs/notion-map.json missing");
    else {
      const map = readJson(NotionMapVersion, mapRaw);
      if (map === null) flag("docs/notion-map.json: invalid JSON");
      else if (map.productVersion === undefined) flag("docs/notion-map.json: productVersion missing");
      else if (pkgVersion !== undefined && map.productVersion !== pkgVersion) flag(`package.json version ${pkgVersion} vs docs/notion-map.json productVersion ${map.productVersion}`);
    }
    return problems === 0 ? pass("versionsOk", {}, evidence) : fail(evidence, "versionsInconsistent");
  },
};
