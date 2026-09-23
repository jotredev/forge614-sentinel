import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { ecosystemContractCheck } from "./ecosystem-contract";

const params = testParams({ ecosystemContract: "A\n" });

test("root copy must be byte-identical to the canonical text; an absent copy passes", () => {
  expect(ecosystemContractCheck.run(snapshotFromDir("ecosystem-contract/pass"), params).verdict).toBe("pass");
  expect(ecosystemContractCheck.run(snapshotFrom({ "FORGE614_ECOSYSTEM_CONTRACT.md": "A\n" }), params).verdict).toBe("pass");
  const r = ecosystemContractCheck.run(snapshotFromDir("ecosystem-contract/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(["FORGE614_ECOSYSTEM_CONTRACT.md differs from the published contract (sha256 mismatch)"]);
});
