import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { forbiddenMentionsCheck } from "./forbidden-mentions";

const params = testParams({ forbiddenMentions: { terms: ["zzzproduct"], excludePaths: [] } });

test("reports file:line for each forbidden term, case-insensitive, whole word", () => {
  const r = forbiddenMentionsCheck.run(snapshotFromDir("forbidden-mentions/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(["docs/es/01.md:2: zzzproduct"]);
});

test("passes when there are no matches", () => {
  expect(forbiddenMentionsCheck.run(snapshotFromDir("forbidden-mentions/pass"), params).verdict).toBe("pass");
});

test("never scans standard/forbidden-mentions.json itself or anything under .superpowers/", () => {
  const s = snapshotFrom({
    "standard/forbidden-mentions.json": JSON.stringify({ schemaVersion: 1, terms: ["zzzproduct"], excludePaths: [] }),
    ".superpowers/notes/plan.md": "esto menciona zzzproduct en un borrador\n",
  });
  expect(forbiddenMentionsCheck.run(s, params).verdict).toBe("pass");
});

test("excludePaths from the standard's forbidden-mentions.json are honored (prefix with trailing slash, exact path otherwise)", () => {
  const s = snapshotFrom({ "docs/historical/old.md": "zzzproduct aparece aquí\n", "notes.md": "zzzproduct\n" });
  const p = testParams({ forbiddenMentions: { terms: ["zzzproduct"], excludePaths: ["docs/historical/", "notes.md"] } });
  expect(forbiddenMentionsCheck.run(s, p).verdict).toBe("pass");
});

test("with no terms configured the check passes with an informational evidence line, never silently", () => {
  const r = forbiddenMentionsCheck.run(snapshotFrom({ "a.md": "x" }), testParams());
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["no forbidden terms declared by the standard"]);
});
