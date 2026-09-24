import { expect, test } from "bun:test";
import { placeholdersOf, renderTemplate } from "./template";

test("replaces {{VAR}} and lists placeholders", () => {
  expect(placeholdersOf("a {{X}} b {{Y_2}} {{X}}")).toEqual(["X", "Y_2"]);
  expect(renderTemplate("hi {{NODE_NAME}}", { NODE_NAME: "engram" })).toBe("hi engram");
});

test("throws on unresolved placeholder", () => {
  expect(() => renderTemplate("{{NODE_NAME}} {{MISSING}}", { NODE_NAME: "x" })).toThrow("unresolved placeholders: MISSING");
});
