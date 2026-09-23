import { expect, test } from "bun:test";
import { parseSha256Sums } from "./sha256sums";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";

test("parses sha256sum lines and ignores blank lines", () => {
  expect(parseSha256Sums(`${SHA}  standard-1.0.0.tar.gz\n\n`)).toEqual([{ sha256: SHA, file: "standard-1.0.0.tar.gz" }]);
});

test("rejects a single space separator, a short hash or an empty file", () => {
  expect(parseSha256Sums(`${SHA} standard-1.0.0.tar.gz\n`)).toBeNull();
  expect(parseSha256Sums(`abc  x\n`)).toBeNull();
  expect(parseSha256Sums("")).toBeNull();
});
