import { expect, test } from "bun:test";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { ERROR_CODE_PATTERN, errorCodesCheck } from "./error-codes";

const params = testParams();

test("accepts canonical codes in CONTRACT.md and source, rejects kebab-case or lowercase", () => {
  expect(ERROR_CODE_PATTERN.test("STANDARD_CORRUPT")).toBe(true);
  expect(errorCodesCheck.run(snapshotFromDir("error-codes/pass"), params).verdict).toBe("pass");
  const r = errorCodesCheck.run(snapshotFromDir("error-codes/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual(["CONTRACT.md: engines-outdated", "src/app/x.ts:1: engines-outdated", "src/app/x.ts:1: Bad_Code"]);
});

test("passes when the repo has no CONTRACT.md and no printError calls; ignores test files under src/", () => {
  expect(errorCodesCheck.run(snapshotFrom({ "README.md": "" }), params).verdict).toBe("pass");
  expect(errorCodesCheck.run(snapshotFrom({ "src/app/x.test.ts": 'printError("bad-code", "x");' }), params).verdict).toBe("pass");
});
