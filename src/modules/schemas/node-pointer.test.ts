import { describe, expect, test } from "bun:test";
import { NodePointerSchema } from "./node-pointer";

const valid = { schemaVersion: 1, node: "engram", kind: "product", standard: { version: "1.0.0", sha256: "a".repeat(64) } } as const;

describe("forge614.node.json", () => {
  test("valid", () => expect(NodePointerSchema.parse(valid)).toEqual(valid));
  test("rejects unknown keys", () => expect(NodePointerSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false));
  test("rejects bad node name / kind / sha", () => {
    expect(NodePointerSchema.safeParse({ ...valid, node: "Engram" }).success).toBe(false);
    expect(NodePointerSchema.safeParse({ ...valid, kind: "tool" }).success).toBe(false);
    expect(NodePointerSchema.safeParse({ ...valid, standard: { version: "1.0.0", sha256: "xyz" } }).success).toBe(false);
  });
  test("accepts an optional ecosystem group name (acta 0022)", () => {
    expect(NodePointerSchema.safeParse({ ...valid, ecosystem: "forge614" }).success).toBe(true);
  });
  test("passes without ecosystem (optional field)", () => {
    expect(NodePointerSchema.safeParse(valid).success).toBe(true);
  });
  test("rejects a non-canonical ecosystem name", () => {
    expect(NodePointerSchema.safeParse({ ...valid, ecosystem: "Forge_614" }).success).toBe(false);
  });
});
