import { expect, test } from "bun:test";
import { run } from "./process";

// These tests drive `bash`, which a Windows runner does not ship by default;
// they are skipped there with a reason rather than failing on a missing binary.
const onWindows = process.platform === "win32";
const WINDOWS_REASON = onWindows ? " (skipped: bash is not available on Windows)" : "";

test.skipIf(onWindows)(`run captures stdout and exit code${WINDOWS_REASON}`, () => {
  const r = run(["bash", "-c", "printf hi; exit 3"]);
  expect(r.stdout).toBe("hi");
  expect(r.exitCode).toBe(3);
});

test.skipIf(onWindows)(`run captures stderr${WINDOWS_REASON}`, () => {
  const r = run(["bash", "-c", "printf err >&2; exit 0"]);
  expect(r.stderr).toBe("err");
  expect(r.exitCode).toBe(0);
});

test.skipIf(onWindows)(`run forwards stdin when provided${WINDOWS_REASON}`, () => {
  const r = run(["bash", "-c", "cat"], { stdin: "from-stdin" });
  expect(r.stdout).toBe("from-stdin");
  expect(r.exitCode).toBe(0);
});

test("env is merged over the parent environment", () => {
  const r = run(["bun", "-e", "console.log(process.env.SENTINEL_TEST_VAR)"], { env: { SENTINEL_TEST_VAR: "on" } });
  expect(r.stdout.trim()).toBe("on");
});
