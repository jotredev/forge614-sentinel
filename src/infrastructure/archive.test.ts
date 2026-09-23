import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractTarGz } from "./archive";
import { sha256Hex } from "./hashing";

const FIXTURE = resolve(import.meta.dir, "../../fixtures/standard/standard-v1.0.0/standard-1.0.0.tar.gz");

test("extracts the published standard 1.0.0 archive: 105 members, VERSION and the ecosystem pack", () => {
  const bytes = new Uint8Array(readFileSync(FIXTURE));
  expect(sha256Hex(bytes)).toBe("18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922");
  const members = extractTarGz(bytes);
  expect(members).toHaveLength(105);
  const version = members.find((m) => m.path === "VERSION");
  expect(new TextDecoder().decode(version?.content)).toBe("1.0.0\n");
  expect(members.some((m) => m.path === "packs/forge614-pack-ecosystem-node/pack.json")).toBe(true);
  expect(members.some((m) => m.path === "templates/install.sh" && m.mode === 0o755)).toBe(true);
  expect(members.filter((m) => m.content === undefined).map((m) => m.path)).toContain("rules/");
});

test("a flipped byte in the CRC32 trailer is rejected (fflate alone does not check it)", () => {
  const bytes = new Uint8Array(readFileSync(FIXTURE));
  const i = bytes.length - 8; // first byte of CRC32
  bytes[i] = (bytes[i] ?? 0) ^ 0xff;
  expect(() => extractTarGz(bytes)).toThrow("gzip: crc mismatch");
});

test("a flipped byte in the ISIZE trailer is rejected, not silently extracted", () => {
  const bytes = new Uint8Array(readFileSync(FIXTURE));
  const i = bytes.length - 3; // second byte of ISIZE
  bytes[i] = (bytes[i] ?? 0) ^ 0xff;
  expect(() => extractTarGz(bytes)).toThrow();
});
