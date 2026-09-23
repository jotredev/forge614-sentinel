import { expect, test } from "bun:test";
import { DEMO_POINTER, SHA, testParams } from "../../../tests/helpers/params";
import { snapshotFrom } from "../snapshot";
import { nodePointerCheck } from "./node-pointer";

const OTHER = "0".repeat(64);

test("passes when the pointer's sha256 equals the cached archive of the declared version", () => {
  const r = nodePointerCheck.run(snapshotFrom({}), testParams());
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual([]);
});

test("fails with both fingerprints in the evidence when they differ (hand-edited pointer or changed release)", () => {
  const params = testParams({ pointer: { ...DEMO_POINTER, standard: { version: "1.0.0", sha256: OTHER } } });
  const r = nodePointerCheck.run(snapshotFrom({}), params);
  expect(r.verdict).toBe("fail");
  expect(r.messageKey).toBe("nodePointerMismatch");
  expect(r.evidence).toEqual([`forge614.node.json standard.sha256 ${OTHER} vs cached standard-1.0.0.tar.gz ${SHA}`]);
});

test("is caution, never pass, when the declared version is not cached (forced run with another version)", () => {
  const params = testParams({ standard: { version: "1.1.0", sha256: OTHER, pointerVersionSha256: undefined } });
  const r = nodePointerCheck.run(snapshotFrom({}), params);
  expect(r.verdict).toBe("caution");
  expect(r.messageKey).toBe("nodePointerUnverifiable");
  expect(r.evidence).toEqual(["standard 1.0.0 declared by forge614.node.json is not cached; this run used 1.1.0 (--standard)"]);
});

test("a forced run whose declared version IS cached still cross-checks it and notes the forced version", () => {
  const params = testParams({ standard: { version: "1.1.0", sha256: OTHER, pointerVersionSha256: SHA } });
  const r = nodePointerCheck.run(snapshotFrom({}), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["checked against standard 1.1.0 (--standard); forge614.node.json declares 1.0.0"]);
});
