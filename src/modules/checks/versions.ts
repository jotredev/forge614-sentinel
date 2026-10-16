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

// spec §8.2: package.json cannot lag the highest published v* tag; a new
// package version may be prepared before its tag is created. A release
// checkout must still match the tag pointing at HEAD.
// A shallow CI clone (actions/checkout fetch-depth 1) carries no tags, so
// pull requests compare package.json with notion-map only.
export const versionsCheck: CheckDefinition = {
  id: "versions",
  appliesWhen: (snapshot) => has(snapshot, "package.json"),
  run: (snapshot, params) => {
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
    if (params.templates.has("install.mjs")) {
      for (const tag of snapshot.facts.gitTags) if (/^\d+\.\d+\.\d+$/.test(tag)) flag(`git tag '${tag}' looks like a version but must start with v`);
    }
    const highestTag = highestSemver(snapshot.facts.gitTags.filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).map((t) => t.slice(1)));
    if (highestTag !== undefined && pkgVersion !== undefined && SEMVER_PATTERN.test(pkgVersion)) {
      if (highestSemver([pkgVersion, highestTag]) === highestTag && pkgVersion !== highestTag) {
        flag(`package.json version ${pkgVersion} is behind highest tag v${highestTag}`);
      }
    }
    const publishingTag = snapshot.facts.gitRefName;
    if (publishingTag !== undefined && /^v\d+\.\d+\.\d+$/.test(publishingTag) && pkgVersion !== undefined && SEMVER_PATTERN.test(pkgVersion) && pkgVersion !== publishingTag.slice(1)) {
      flag(`package.json version ${pkgVersion} vs publishing tag ${publishingTag}`);
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
