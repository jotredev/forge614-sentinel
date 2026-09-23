import { describe, expect, test } from "bun:test";
import { PackSchema } from "./pack";
describe("pack", () => {
  test("valid", () => {
    expect(PackSchema.parse({ schemaVersion: 1, name: "forge614-pack-ecosystem-node", version: "1.0.0", title: { es: "Nodo", en: "Node" }, rules: ["forge614-rule-package-naming"] }).rules).toHaveLength(1);
  });
  test("rejects unknown keys", () => {
    expect(PackSchema.safeParse({ schemaVersion: 1, name: "forge614-pack-x", version: "1.0.0", title: { es: "a", en: "b" }, rules: ["forge614-rule-x"], extra: 1 }).success).toBe(false);
  });
  test("rules must be canonical rule names", () => {
    expect(PackSchema.safeParse({ schemaVersion: 1, name: "forge614-pack-x", version: "1.0.0", title: { es: "a", en: "b" }, rules: ["forge614-skill-x"] }).success).toBe(false);
  });
});
