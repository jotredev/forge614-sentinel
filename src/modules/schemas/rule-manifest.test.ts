import { describe, expect, test } from "bun:test";
import { RuleManifestSchema } from "./rule-manifest";

const valid = {
  schemaVersion: 1, name: "forge614-rule-package-naming", version: "1.0.0", level: "core",
  title: { es: "Nombres de paquetes", en: "Package names" },
  appliesWhen: [], validator: "package-naming", decisions: ["0016"],
};

describe("rule manifest", () => {
  test("valid core rule", () => expect(RuleManifestSchema.parse(valid).name).toBe(valid.name));
  test("stack rule needs appliesWhen", () => {
    expect(RuleManifestSchema.safeParse({ ...valid, level: "stack" }).success).toBe(false);
    expect(RuleManifestSchema.safeParse({ ...valid, level: "stack", appliesWhen: [{ fileExists: "tsconfig.json" }] }).success).toBe(true);
  });
  test("rejects non-canonical name and unknown keys", () => {
    expect(RuleManifestSchema.safeParse({ ...valid, name: "package-naming" }).success).toBe(false);
    expect(RuleManifestSchema.safeParse({ ...valid, foo: 1 }).success).toBe(false);
  });
  test("structural package without sunset is valid", () => {
    expect(RuleManifestSchema.safeParse({ ...valid, compensates: "structural" }).success).toBe(true);
  });
  test("model-limitation package without sunset is rejected", () => {
    expect(RuleManifestSchema.safeParse({ ...valid, compensates: "model-limitation" }).success).toBe(false);
  });
  test("model-limitation package with sunset is valid", () => {
    const result = RuleManifestSchema.safeParse({
      ...valid,
      compensates: "model-limitation",
      sunset: { condition: "cuando el modelo lo haga nativo", reviewBy: "2026-12-31" },
    });
    expect(result.success).toBe(true);
  });
  test("structural package with sunset is rejected", () => {
    const result = RuleManifestSchema.safeParse({
      ...valid,
      compensates: "structural",
      sunset: { condition: "x", reviewBy: "2026-12-31" },
    });
    expect(result.success).toBe(false);
  });
  test("accepts an optional non-negative tokens estimate", () => {
    expect(RuleManifestSchema.safeParse({ ...valid, tokens: 120 }).success).toBe(true);
    expect(RuleManifestSchema.safeParse({ ...valid, tokens: -1 }).success).toBe(false);
  });
});
