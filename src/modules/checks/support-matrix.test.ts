import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { supportMatrixCheck } from "./support-matrix";

const at = (today: string) => testParams({ today });
const m = (cells: unknown[]) => JSON.stringify({ schemaVersion: 1, nodes: ["engines"], agents: ["codex"], cells });

test("applies only when standard/support-matrix.json exists (forge614-ai)", () => {
  expect(supportMatrixCheck.appliesWhen(snapshotFrom({}), at("2026-09-22"))).toBe(false);
  expect(supportMatrixCheck.appliesWhen(snapshotFromDir("support-matrix/pass"), at("2026-09-22"))).toBe(true);
});

test("fails on stale revalidate (> 30 days) and passes on a fresh matrix", () => {
  expect(supportMatrixCheck.run(snapshotFromDir("support-matrix/pass"), at("2026-09-22")).verdict).toBe("pass");
  const r = supportMatrixCheck.run(snapshotFromDir("support-matrix/fail"), at("2026-09-22"));
  expect(r.evidence).toEqual(["engines/codex: in revalidate since 2026-07-01 (> 30 days)"]);
  expect(r.params).toEqual({ days: "30" });
});

test("a revalidate cell exactly 30 days old is not yet stale", () => {
  const s = snapshotFrom({
    "standard/support-matrix.json": m([{ node: "engines", agent: "codex", status: "revalidate", revalidateSince: "2026-08-23", reason: "r", verifiedAt: "2026-08-23", verifiedBy: "o", notes: "" }]),
  });
  expect(supportMatrixCheck.run(s, at("2026-09-22")).verdict).toBe("pass");
});

test("invalid JSON and invalid schema are fail findings with the same evidence as before", () => {
  const bad = supportMatrixCheck.run(snapshotFrom({ "standard/support-matrix.json": "{ not json" }), at("2026-09-22"));
  expect(bad.messageKey).toBe("dataFileInvalidJson");
  expect(bad.evidence[0]).toStartWith("standard/support-matrix.json: invalid JSON: ");
  expect(supportMatrixCheck.run(snapshotFrom({ "standard/support-matrix.json": "{}" }), at("2026-09-22")).messageKey).toBe("supportMatrixInvalid");
});
