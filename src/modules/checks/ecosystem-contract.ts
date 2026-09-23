import { createHash } from "node:crypto";
import { fail, pass, type CheckDefinition } from "../check";
import { read } from "../snapshot";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// A local copy of FORGE614_ECOSYSTEM_CONTRACT.md is optional (repositories
// reference it by pointer), but when present it must be byte-identical to
// the one the loaded standard carries.
export const ecosystemContractCheck: CheckDefinition = {
  id: "ecosystem-contract",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    const local = read(snapshot, "FORGE614_ECOSYSTEM_CONTRACT.md");
    if (local === undefined || sha256(local) === sha256(params.ecosystemContract)) return pass("ecosystemContractOk");
    return fail(["FORGE614_ECOSYSTEM_CONTRACT.md differs from the published contract (sha256 mismatch)"], "ecosystemContractDiverged");
  },
};
