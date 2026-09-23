import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256File, sha256Hex, sha256Text } from "./hashing";

test("sha256 of empty input", () => expect(sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));

test("sha256Text hashes the UTF-8 bytes", () => {
  expect(sha256Text("forge614")).toBe("78ce873de4bc32d8f641c3de7a55df80b2ca8e2bcae899d4737b851deba28a79");
});

test("sha256File hashes the bytes on disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "hashing-"));
  const path = join(dir, "sample.txt");
  writeFileSync(path, "forge614 sentinel\n", "utf8");
  expect(sha256File(path)).toBe(sha256Text("forge614 sentinel\n"));
});
