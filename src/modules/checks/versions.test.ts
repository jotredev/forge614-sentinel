import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { versionsCheck } from "./versions";

const params = testParams();

test("applies when package.json exists", () => {
  expect(versionsCheck.appliesWhen(snapshotFrom({}), params)).toBe(false);
  expect(versionsCheck.appliesWhen(snapshotFrom({ "package.json": "{}" }), params)).toBe(true);
});

test("passes when package.json and notion-map agree; without git the evidence says tags were unavailable", () => {
  const r = versionsCheck.run(snapshotFromDir("versions/pass"), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["git tags not available (not a git checkout)"]);
});

test("fails when notion-map disagrees or the highest v* tag differs from package.json", () => {
  const r = versionsCheck.run(snapshotFromDir("versions/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(["git tags not available (not a git checkout)", "package.json version 0.2.0 vs docs/notion-map.json productVersion 0.1.0"]);
  const behind = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.1.0", "v0.2.0", "standard-v1.0.0"] }), params);
  expect(behind.evidence).toEqual(["package.json version 0.1.0 vs highest tag v0.2.0"]);
});

test("the highest v* tag must equal package.json exactly (spec §8.2): equal passes, ahead fails too", () => {
  expect(versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.1.0"] }), params).evidence).toEqual([]);
  const ahead = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.0.9"] }), params);
  expect(ahead.verdict).toBe("fail");
  expect(ahead.evidence).toEqual(["package.json version 0.1.0 vs highest tag v0.0.9"]);
});

test("a git checkout without v* tags (a shallow CI clone) compares package.json with notion-map only", () => {
  const r = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: [] }), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual([]);
});

test("missing or invalid version fields are evidence", () => {
  const r = versionsCheck.run(snapshotFrom({ "package.json": JSON.stringify({ version: "1.0" }) }), params);
  expect(r.evidence).toEqual(expect.arrayContaining(["package.json: version '1.0' is not X.Y.Z", "docs/notion-map.json missing"]));
});
