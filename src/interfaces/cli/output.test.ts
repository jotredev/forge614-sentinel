import { afterEach, beforeEach, expect, test } from "bun:test";
import { printError, printJson, runCli } from "./output";

let stdoutSpy: string[] = [];
let stderrSpy: string[] = [];
let stdoutWrite: typeof process.stdout.write;
let stderrWrite: typeof process.stderr.write;

beforeEach(() => {
  stdoutSpy = [];
  stderrSpy = [];
  stdoutWrite = process.stdout.write.bind(process.stdout);
  stderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string) => {
    stdoutSpy.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => {
    stderrSpy.push(chunk);
    return true;
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stdout.write = stdoutWrite;
  process.stderr.write = stderrWrite;
});

test("printJson writes a single JSON line to stdout", () => {
  printJson({ schemaVersion: 1, ok: true });
  expect(stdoutSpy).toEqual([`${JSON.stringify({ schemaVersion: 1, ok: true })}\n`]);
});

test("printError writes an error envelope to stderr", () => {
  printError("STANDARD_CORRUPT", "boom");
  expect(stderrSpy).toEqual([`${JSON.stringify({ schemaVersion: 1, code: "STANDARD_CORRUPT", error: "boom" })}\n`]);
});

test("runCli returns main's exit code untouched (sync and async)", async () => {
  expect(await runCli("X_FAILED", () => 3)).toBe(3);
  expect(await runCli("X_FAILED", async () => 2)).toBe(2);
  expect(stderrSpy).toEqual([]);
});

test("runCli turns a throw or a rejection into the envelope with exit 1", async () => {
  expect(
    await runCli("SENTINEL_FAILED", () => {
      throw new Error("disk is full");
    }),
  ).toBe(1);
  expect(await runCli("SENTINEL_FAILED", async () => Promise.reject(new Error("later")))).toBe(1);
  expect(stderrSpy).toEqual([
    `${JSON.stringify({ schemaVersion: 1, code: "SENTINEL_FAILED", error: "disk is full" })}\n`,
    `${JSON.stringify({ schemaVersion: 1, code: "SENTINEL_FAILED", error: "later" })}\n`,
  ]);
});
