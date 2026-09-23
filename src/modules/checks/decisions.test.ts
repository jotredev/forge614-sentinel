import { describe, expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { decisionsCheck } from "./decisions";

const params = testParams();

describe("decisions (formerly decision-records)", () => {
  test("pass with consecutive numbering, valid states and INDEX.json listing all", () => {
    expect(decisionsCheck.run(snapshotFromDir("decisions/pass"), params).verdict).toBe("pass");
  });

  test("fail on gap, bad state, missing section and record deleted vs INDEX", () => {
    const r = decisionsCheck.run(snapshotFromDir("decisions/fail"), params);
    expect(r.evidence).toEqual(
      expect.arrayContaining([
        "0001-a.md: invalid state 'cancelada'",
        "numbering gap before 0003",
        "0003-c.md: missing section '## Consecuencias'",
        "INDEX.json lists 0002-b.md but file is missing (records are never deleted)",
      ]),
    );
  });

  test("fails with decisionsIndexMissing when INDEX.json does not exist", () => {
    const r = decisionsCheck.run(snapshotFrom({ "docs/decisions/0001-a.md": "# x" }), params);
    expect(r.verdict).toBe("fail");
    expect(r.messageKey).toBe("decisionsIndexMissing");
    expect(r.evidence).toEqual(["docs/decisions/INDEX.json missing"]);
  });

  test("an empty index with no records passes (a young node)", () => {
    expect(decisionsCheck.run(snapshotFrom({ "docs/decisions/INDEX.json": JSON.stringify({ schemaVersion: 1, decisions: [] }) }), params).verdict).toBe("pass");
  });
});
