import { expect, test } from "bun:test";
import { stripCommentsAndStrings, stripJsonComments } from "./source-text";

test("stripCommentsAndStrings blanks line comments, block comments and string/template contents but keeps line count", () => {
  const src = 'const a = "any"; // any here\nconst b = `x ${y} any`; /* any\nany */ const c: any = 1;\n';
  const out = stripCommentsAndStrings(src);
  expect(out.split("\n")).toHaveLength(src.split("\n").length);
  expect(out).not.toContain('"any"');
  expect(out).toContain("const c: any = 1;");
  expect(/\bany\b/.test(out.split("\n")[0] ?? "")).toBe(false);
});

test("quotes and backticks inside a regular expression literal are not string delimiters; division is not a regex", () => {
  const src = "const re = /[\"'`]/g;\nconst t: any = 1;\nconst half = a / 2; const b = c / d;\nconst p = /<any>|as any/;\n";
  const out = stripCommentsAndStrings(src).split("\n");
  expect(out).toHaveLength(5);
  expect(out[0]).toBe("const re = //g;");
  expect(out[1]).toBe("const t: any = 1;");
  expect(out[2]).toBe("const half = a / 2; const b = c / d;");
  expect(out[3]).toBe("const p = //;");
});

test("stripJsonComments removes // and /* */ outside strings", () => {
  expect(JSON.parse(stripJsonComments('{ // c\n "a": "http://x", /* b */ "b": 1 }'))).toEqual({ a: "http://x", b: 1 });
});
