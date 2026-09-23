import { describe, expect, test } from "bun:test";
import { SupportMatrixSchema } from "./support-matrix";
const valid = {
  schemaVersion: 1, nodes: ["engines", "workers"], agents: ["claude-code"],
  cells: [{ node: "engines", agent: "claude-code", status: "supported", verifiedAt: "2026-09-22", verifiedBy: "owner", notes: "" }],
};
describe("support matrix", () => {
  test("valid", () => expect(SupportMatrixSchema.parse(valid).cells).toHaveLength(1));
  test("rejects unknown keys at the root and inside a cell", () => {
    expect(SupportMatrixSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(SupportMatrixSchema.safeParse({ ...valid, cells: [{ ...valid.cells[0], extra: 1 }] }).success).toBe(false);
  });
  test("revalidate requires since date and a reason", () => {
    const cell = { node: "engines", agent: "claude-code", status: "revalidate", verifiedAt: "2026-09-22", verifiedBy: "owner", notes: "" };
    expect(SupportMatrixSchema.safeParse({ ...valid, cells: [cell] }).success).toBe(false);
    expect(SupportMatrixSchema.safeParse({ ...valid, cells: [{ ...cell, revalidateSince: "2026-09-22" }] }).success).toBe(false);
    expect(
      SupportMatrixSchema.safeParse({ ...valid, cells: [{ ...cell, revalidateSince: "2026-09-22", reason: "hook con startup-context unbound" }] })
        .success,
    ).toBe(true);
  });
  test("cell must reference declared node and agent", () => {
    expect(SupportMatrixSchema.safeParse({ ...valid, cells: [{ ...valid.cells[0], node: "hub" }] }).success).toBe(false);
  });
  test("accepts not-applicable status without revalidate fields", () => {
    const cell = { node: "engram", agent: "claude-code", status: "not-applicable", verifiedAt: "2026-09-22", verifiedBy: "owner", notes: "" };
    expect(SupportMatrixSchema.safeParse({ ...valid, nodes: ["engram"], cells: [cell] }).success).toBe(true);
  });
  test("accepts optional deadline alongside revalidate", () => {
    const cell = {
      node: "engines",
      agent: "claude-code",
      status: "revalidate",
      verifiedAt: "2026-09-22",
      verifiedBy: "owner",
      notes: "",
      revalidateSince: "2026-09-22",
      reason: "hook con startup-context unbound",
      deadline: "2026-10-22",
    };
    expect(SupportMatrixSchema.safeParse({ ...valid, cells: [cell] }).success).toBe(true);
  });
});
