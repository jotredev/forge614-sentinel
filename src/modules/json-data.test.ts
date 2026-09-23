import { expect, test } from "bun:test";
import { parseJsonData } from "./json-data";

test("returns the parsed value for valid JSON", () => {
  expect(parseJsonData("a.json", '{"x":1}')).toEqual({ ok: true, data: { x: 1 } });
});

test("turns a parse failure into evidence naming the path, never a throw", () => {
  const result = parseJsonData("standard/x.json", "{ not json");
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.evidence).toStartWith("standard/x.json: invalid JSON: ");
});
