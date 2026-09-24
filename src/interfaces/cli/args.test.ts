import { expect, test } from "bun:test";
import { z } from "zod";
import { issuesOf, parseFlags, parseMixed, parsePairs } from "./args";

test("parseMixed separates value flags, bare flags and positionals", () => {
  expect(parseMixed(["--repo", "/x", "--strict", "--json", "extra"], ["repo", "standard", "only"])).toEqual({ flags: { repo: "/x", strict: true, json: true }, positionals: ["extra"] });
  expect(parseMixed(["--repo"], ["repo"])).toEqual({ flags: { repo: true }, positionals: [] });
  expect(parseMixed(["--repo", "--json"], ["repo"])).toEqual({ flags: { repo: true, json: true }, positionals: [] });
});

test("parsePairs keeps --key value pairs only (workflows-run)", () => {
  expect(parsePairs(["--workflow", "release"])).toEqual({ workflow: "release" });
  expect(parsePairs(["--workflow"])).toEqual({});
  expect(parsePairs(["stray", "x"])).toEqual({});
});

test("parseFlags and issuesOf behave as in forge614-ai", () => {
  expect(parseFlags(["--json", "x"])).toEqual({ json: true, x: true });
  const r = z.object({ a: z.string() }).strict().safeParse({ a: 1, b: 2 });
  expect(r.success).toBe(false);
  if (r.success) return;
  expect(issuesOf(r.error)).toContain("a: ");
});
