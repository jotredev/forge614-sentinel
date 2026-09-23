import { describe, expect, test } from "bun:test";
import { DecisionsIndexSchema } from "./decisions-index";

const valid = {
  schemaVersion: 1,
  decisions: [
    { number: "0016", slug: "package-naming", title: "Package naming", status: "aceptada", date: "2026-09-22", file: "docs/decisions/0016-package-naming.md" },
  ],
};

describe("docs/decisions/INDEX.json", () => {
  test("valid", () => expect(DecisionsIndexSchema.parse(valid).decisions).toHaveLength(1));
  test("optional replacedBy and session accepted", () => {
    const withOptional = {
      schemaVersion: 1,
      decisions: [
        { number: "0017", slug: "x", title: "X", status: "reemplazada", replacedBy: "0018", date: "2026-09-22", session: "s1", file: "docs/decisions/0017-x.md" },
      ],
    };
    expect(DecisionsIndexSchema.safeParse(withOptional).success).toBe(true);
  });
  test("rejects unknown keys", () => expect(DecisionsIndexSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false));
  test("rejects bad number format", () => {
    const bad = { ...valid, decisions: [{ ...valid.decisions[0], number: "16" }] };
    expect(DecisionsIndexSchema.safeParse(bad).success).toBe(false);
  });
  test("rejects bad status", () => {
    const bad = { ...valid, decisions: [{ ...valid.decisions[0], status: "borrador" }] };
    expect(DecisionsIndexSchema.safeParse(bad).success).toBe(false);
  });
});
