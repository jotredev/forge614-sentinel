import { fail, pass, type CheckDefinition } from "../check";

// Always excluded: the standard's own data file when a repository carries a
// copy (it lists the terms as data, not as a mention) and .superpowers/
// (planning scratch space). The standard's excludePaths add to these.
const DEFAULT_EXCLUDES = ["standard/forbidden-mentions.json", ".superpowers/"];

function isExcluded(path: string, excludePaths: readonly string[]): boolean {
  return excludePaths.some((ex) => (ex.endsWith("/") ? path.startsWith(ex) : path === ex));
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// facts.gitLogSubjects is not scanned in 0.1 on purpose: the ported checks
// keep the evidence forge614-ai produced (spec §8.1); commit subjects are an
// additive extension for a later version.
export const forbiddenMentionsCheck: CheckDefinition = {
  id: "forbidden-mentions",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    if (params.forbiddenMentions.terms.length === 0) return pass("forbiddenMentionsNone", {}, ["no forbidden terms declared by the standard"]);
    const excludePaths = [...new Set([...DEFAULT_EXCLUDES, ...params.forbiddenMentions.excludePaths])];
    const matchers = params.forbiddenMentions.terms.map((term) => [term, new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i")] as const);
    const evidence: string[] = [];
    for (const [path, text] of snapshot.files) {
      if (isExcluded(path, excludePaths)) continue;
      text.split("\n").forEach((line, i) => {
        for (const [term, re] of matchers) if (re.test(line)) evidence.push(`${path}:${i + 1}: ${term}`);
      });
    }
    return evidence.length === 0 ? pass("forbiddenMentionsNone") : fail(evidence, "forbiddenMentionsFound");
  },
};
