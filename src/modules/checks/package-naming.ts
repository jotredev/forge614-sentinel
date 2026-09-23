import { fail, pass, type CheckDefinition } from "../check";
import { PACKAGE_NAME_PATTERN } from "../package-name";

// Obligatory everywhere the Hub distributes packages.
const STRICT_ROOTS = ["standard/rules/", "standard/packs/"];

// Under .agents/, only folders that carry a Hub manifest.json are checked:
// the person's own folders (e.g. .agents/skills/deploy/) are never touched.
const HUB_ROOTS = [".agents/rules/", ".agents/skills/", ".agents/policies/", ".agents/mcps/", ".agents/plugins/"];

export const packageNamingCheck: CheckDefinition = {
  id: "package-naming",
  appliesWhen: () => true,
  run: (snapshot) => {
    const bad = new Set<string>();
    for (const path of snapshot.files.keys()) {
      for (const root of STRICT_ROOTS) {
        if (path.startsWith(root)) {
          const dir = path.slice(root.length).split("/")[0] ?? "";
          if (!PACKAGE_NAME_PATTERN.test(dir)) bad.add(root + dir);
        }
      }
      for (const root of HUB_ROOTS) {
        if (path.startsWith(root) && path.endsWith("/manifest.json")) {
          const dir = path.slice(root.length).split("/")[0] ?? "";
          if (!PACKAGE_NAME_PATTERN.test(dir)) bad.add(root + dir);
        }
      }
    }
    return bad.size === 0 ? pass("packageNamesOk") : fail([...bad].sort(), "packageNamesInvalid");
  },
};
