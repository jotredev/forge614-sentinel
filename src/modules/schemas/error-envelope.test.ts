import { describe, expect, test } from "bun:test";
import { ErrorEnvelopeSchema } from "./error-envelope";
describe("error envelope (acta 0013)", () => {
  test("valid", () => expect(ErrorEnvelopeSchema.parse({ schemaVersion: 1, code: "SCHEMA_UNSUPPORTED", error: "x" }).code).toBe("SCHEMA_UNSUPPORTED"));
  test("rejects unknown keys", () => expect(ErrorEnvelopeSchema.safeParse({ schemaVersion: 1, code: "X_Y", error: "x", extra: 1 }).success).toBe(false));
  test("code must be UPPER_SNAKE", () => expect(ErrorEnvelopeSchema.safeParse({ schemaVersion: 1, code: "bad-code", error: "x" }).success).toBe(false));
});
