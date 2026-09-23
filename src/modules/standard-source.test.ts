import { expect, test } from "bun:test";
import { STANDARD_REPOSITORY, StandardSourceSchema, standardSource } from "./standard-source";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";

test("standardSource builds the spec §5.2 shape, with or without a fingerprint", () => {
  expect(standardSource("1.0.0", SHA)).toEqual({ kind: "github-release", repository: STANDARD_REPOSITORY, version: "1.0.0", sha256: SHA });
  expect(standardSource("1.1.0")).toEqual({ kind: "github-release", repository: "jotredev/forge614-ai", version: "1.1.0" });
  expect("sha256" in standardSource("1.1.0")).toBe(false);
});

test("the schema is strict and validates version and fingerprint", () => {
  expect(StandardSourceSchema.safeParse(standardSource("1.0.0", SHA)).success).toBe(true);
  expect(StandardSourceSchema.safeParse({ ...standardSource("1.0.0"), kind: "url" }).success).toBe(false);
  expect(StandardSourceSchema.safeParse({ ...standardSource("1.0.0"), extra: 1 }).success).toBe(false);
  expect(StandardSourceSchema.safeParse(standardSource("v1", SHA)).success).toBe(false);
  expect(StandardSourceSchema.safeParse(standardSource("1.0.0", "abc")).success).toBe(false);
});
