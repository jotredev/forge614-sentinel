import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { run } from "../../infrastructure/process";
import { testParams } from "../../../tests/helpers/params";
import { snapshotFromDir } from "../../../tests/helpers/snapshot-from-dir";
import { snapshotFrom } from "../snapshot";
import { secretsHygieneCheck } from "./secrets-hygiene";

const params = testParams();
// Samples are concatenated so this test file never contains a literal that
// matches a pattern when Sentinel checks its own tree.
const AWS = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
const GH = ["ghp_", "a".repeat(36)].join("");

test("passes on a clean tree and on an .env.example with empty or placeholder values", () => {
  const r = secretsHygieneCheck.run(snapshotFromDir("secrets-hygiene/pass"), params);
  expect(r.verdict).toBe("pass");
  expect(r.evidence).toEqual(["secret patterns source: builtin (standard 1.0.0 ships no secret-patterns.json)"]);
});

test("reports pattern id and location, never the value", () => {
  const r = secretsHygieneCheck.run(snapshotFromDir("secrets-hygiene/fail"), params);
  expect(r.verdict).toBe("fail");
  expect(r.evidence).toEqual([
    "secret patterns source: builtin (standard 1.0.0 ships no secret-patterns.json)",
    ".env:1: connection-string-with-credentials",
    ".env:1: .env value for DB_URL",
    "keys/server.pem:1: private-key",
    "src/config.ts:1: aws-access-key-id",
  ]);
  expect(r.evidence.join("\n")).not.toContain("secret@");
});

test("honors excludePaths from the standard (fixtures/ in the builtin list) and detects tokens", () => {
  const s = snapshotFrom({ "fixtures/x/a.ts": `const k = "${AWS}";`, "src/b.ts": `const t = "${GH}";` });
  const r = secretsHygieneCheck.run(s, params);
  expect(r.evidence).toEqual(expect.arrayContaining(["src/b.ts:1: github-token"]));
  expect(r.evidence.some((e) => e.startsWith("fixtures/"))).toBe(false);
});

// .gitignore ignores .env and *.pem everywhere and re-includes them under
// fixtures/ only. Without that, the fail fixture would never be committed
// and this check's tests would fail in CI only.
const REPO_ROOT = resolve(import.meta.dir, "../../..");
test.skipIf(Bun.which("git") === null || !existsSync(join(REPO_ROOT, ".git")))("git lists the fail fixture's .env and keys/server.pem (they are not ignored)", () => {
  const r = run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "fixtures/secrets-hygiene/fail"], { cwd: REPO_ROOT });
  expect(r.exitCode).toBe(0);
  const listed = r.stdout.split("\n").filter((line) => line !== "");
  expect(listed).toEqual(expect.arrayContaining(["fixtures/secrets-hygiene/fail/.env", "fixtures/secrets-hygiene/fail/keys/server.pem"]));
});

test(".env.example, .env.sample and .env.template are never flagged for values; a real .env with a placeholder is not either", () => {
  const s = snapshotFrom({ ".env.example": "K=real-looking-value\n", ".env.sample": "K=v\n", ".env": "K=<fill me>\nJ=${VAR}\nL=changeme\n" });
  expect(secretsHygieneCheck.run(s, params).verdict).toBe("pass");
});
