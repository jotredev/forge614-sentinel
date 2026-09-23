import { expect, test } from "bun:test";
import { en } from "./en";
import { es } from "./es";
import { renderBoth, renderMessage } from "./render";
import type { MessageKey } from "./types";

test("renders the same key in both locales with params", () => {
  expect(renderMessage("supportMatrixStale", { days: "30" }, "es")).toBe("Celdas en revalidación vencidas (más de 30 días).");
  expect(renderMessage("supportMatrixStale", { days: "30" }, "en")).toBe("Stale revalidate cells (older than 30 days).");
  expect(renderBoth("notApplicable", { reason: "no package.json" })).toEqual({ es: "No aplica: no package.json.", en: "Not applicable: no package.json." });
});

test("every key renders non-empty text in both languages (parity by compiler, content by test)", () => {
  const keys = Object.keys(es) as MessageKey[];
  expect(keys.length).toBeGreaterThan(40);
  for (const key of keys) {
    expect(es[key]({}).length, `es.${key}`).toBeGreaterThan(0);
    expect(en[key]({}).length, `en.${key}`).toBeGreaterThan(0);
  }
});
