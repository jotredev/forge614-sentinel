import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { crc32 } from "./crc32";

const encoder = new TextEncoder();

test("crc32 matches the standard check vector", () => {
  expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
});

test("crc32 of empty input is 0", () => {
  expect(crc32(new Uint8Array())).toBe(0);
});

test("crc32 equals the CRC32 field of a gzip trailer written by node:zlib", () => {
  const input = encoder.encode("forge614 sentinel ".repeat(40));
  const gz = new Uint8Array(gzipSync(input));
  const trailer = new DataView(gz.buffer, gz.byteOffset + gz.length - 8, 8);
  expect(crc32(input)).toBe(trailer.getUint32(0, true));
});
