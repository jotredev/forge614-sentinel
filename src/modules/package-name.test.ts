import { describe, expect, test } from "bun:test";
import { PACKAGE_NAME_PATTERN, isPackageKind, parsePackageName } from "./package-name";

describe("origen-tipo-nombre", () => {
  test("accepts canonical names", () => {
    expect(parsePackageName("forge614-rule-package-naming")).toEqual({ origin: "forge614", kind: "rule", slug: "package-naming" });
    expect(parsePackageName("acme-skill-pdf")).toEqual({ origin: "acme", kind: "skill", slug: "pdf" });
    expect(PACKAGE_NAME_PATTERN.test("forge614-pack-ecosystem-node")).toBe(true);
  });
  test("isPackageKind narrows to the six kinds and nothing else", () => {
    for (const kind of ["rule", "skill", "mcp", "plugin", "policy", "pack"]) expect(isPackageKind(kind), kind).toBe(true);
    for (const other of ["tool", "Rule", "", "rules"]) expect(isPackageKind(other), other).toBe(false);
  });
  test("rejects wrong shape", () => {
    for (const bad of ["create-pdfs", "forge614-create-pdfs", "Forge614-rule-x", "forge614-rule-", "forge-614-rule-x", "forge614-tool-x"]) {
      expect(parsePackageName(bad), bad).toBeNull();
    }
  });
});
