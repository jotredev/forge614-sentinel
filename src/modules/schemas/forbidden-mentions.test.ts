import { describe, expect, test } from "bun:test";
import { ForbiddenMentionsSchema } from "./forbidden-mentions";

const valid = { schemaVersion: 1, terms: ["vendor-x", "vendor-y"], excludePaths: ["node_modules"] };

describe("standard/forbidden-mentions.json", () => {
  test("valid", () => expect(ForbiddenMentionsSchema.parse(valid).terms).toEqual(["vendor-x", "vendor-y"]));
  test("rejects unknown keys", () => expect(ForbiddenMentionsSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false));
  test("rejects empty terms array", () => expect(ForbiddenMentionsSchema.safeParse({ ...valid, terms: [] }).success).toBe(false));
  test("rejects empty term string", () => expect(ForbiddenMentionsSchema.safeParse({ ...valid, terms: [""] }).success).toBe(false));
  test("accepts a lowercase term with a non-ASCII letter such as ñ", () => expect(ForbiddenMentionsSchema.safeParse({ ...valid, terms: ["señal"] }).success).toBe(true));
  test("rejects a term with a non-ASCII uppercase letter such as Ñ", () => expect(ForbiddenMentionsSchema.safeParse({ ...valid, terms: ["Ñandú"] }).success).toBe(false));
  test("rejects non-lowercase term", () => expect(ForbiddenMentionsSchema.safeParse({ ...valid, terms: ["Vendor-X"] }).success).toBe(false));
});
