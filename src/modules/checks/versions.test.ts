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
  expect(behind.evidence).toEqual(["package.json version 0.1.0 is behind highest tag v0.2.0"]);
});

test("a package version equal to or ahead of the highest tag passes, but a lower version fails", () => {
  expect(versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.1.0"] }), params).evidence).toEqual([]);
  const ahead = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.0.9"] }), params);
  expect(ahead.verdict).toBe("pass");
  const behind = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.2.0"] }), params);
  expect(behind.verdict).toBe("fail");
  expect(behind.evidence).toEqual(["package.json version 0.1.0 is behind highest tag v0.2.0"]);
});

test("allows an untagged package version above the latest tag but rejects a version behind it", () => {
  const newer = snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.1.0"] });
  const newerFiles = new Map(newer.files);
  newerFiles.set("package.json", JSON.stringify({ name: "fixture", version: "0.2.0" }));
  newerFiles.set("docs/notion-map.json", JSON.stringify({ productVersion: "0.2.0" }));
  expect(versionsCheck.run({ ...newer, files: newerFiles }, params).verdict).toBe("pass");

  const older = snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.2.0"] });
  expect(versionsCheck.run(older, params).evidence).toContain("package.json version 0.1.0 is behind highest tag v0.2.0");
});

test("requires package.json to match the version tag on the checked-out commit", () => {
  const snapshot = snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.1.0"], gitRefName: "v0.2.0" });
  const files = new Map(snapshot.files);
  files.set("package.json", JSON.stringify({ name: "fixture", version: "0.3.0" }));
  files.set("docs/notion-map.json", JSON.stringify({ productVersion: "0.3.0" }));
  const r = versionsCheck.run({ ...snapshot, files }, testParams({ templates: new Map([["install.mjs", "template"]]) }));
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toContain("package.json version 0.3.0 vs publishing tag v0.2.0");
});

test("a historical tag at HEAD does not count as the tag currently being published", () => {
  const snapshot = snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["v0.2.0"] });
  const files = new Map(snapshot.files);
  files.set("package.json", JSON.stringify({ name: "fixture", version: "0.2.1" }));
  files.set("docs/notion-map.json", JSON.stringify({ productVersion: "0.2.1" }));
  expect(versionsCheck.run({ ...snapshot, files }, params).verdict).toBe("pass");
});

test("a git checkout without v* tags (a shallow CI clone) compares package.json with notion-map only", () => {
  const r = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: [] }), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual([]);
});

test("in new-template mode rejects tags that look like versions but omit v", () => {
  const r = versionsCheck.run(snapshotFromDir("versions/pass", { gitAvailable: true, gitTags: ["0.1.0", "standard-v1.2.0"] }), testParams({ templates: new Map([["install.mjs", "template"]]) }));
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toContain("git tag '0.1.0' looks like a version but must start with v");
});

test("missing or invalid version fields are evidence", () => {
  const r = versionsCheck.run(snapshotFrom({ "package.json": JSON.stringify({ version: "1.0" }) }), params);
  expect(r.evidence).toEqual(expect.arrayContaining(["package.json: version '1.0' is not X.Y.Z", "docs/notion-map.json missing"]));
});
