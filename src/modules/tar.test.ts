import { expect, test } from "bun:test";
import { buildUstarArchive, tarMode } from "./tar";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function field(block: Uint8Array, offset: number, length: number): string {
  return decoder.decode(block.subarray(offset, offset + length));
}

test("a single small file yields one header block, one content block, two end blocks, padded to a 10240-byte record", () => {
  const content = encoder.encode("hello\n");
  const out = buildUstarArchive([{ path: "hello.txt", mode: 0o644, content }]);
  expect(out.length).toBe(10240);
  // header, content padded to 512, then two zero blocks
  expect(out.subarray(512, 512 + content.length)).toEqual(content);
  expect(out.subarray(512 + content.length, 1024).every((b) => b === 0)).toBe(true);
  expect(out.subarray(1024, 2048).every((b) => b === 0)).toBe(true);
});

test("file header fields follow POSIX ustar with neutral owner and epoch mtime", () => {
  const content = encoder.encode("abc");
  const out = buildUstarArchive([{ path: "dir/file.md", mode: 0o644, content }]);
  const header = out.subarray(0, 512);
  expect(field(header, 0, 11)).toBe("dir/file.md");
  expect(header[11]).toBe(0);
  expect(field(header, 100, 8)).toBe("0000644\0");
  expect(field(header, 108, 8)).toBe("0000000\0");
  expect(field(header, 116, 8)).toBe("0000000\0");
  expect(field(header, 124, 12)).toBe("00000000003\0");
  expect(field(header, 136, 12)).toBe("00000000000\0");
  expect(field(header, 156, 1)).toBe("0");
  expect(field(header, 257, 6)).toBe("ustar\0");
  expect(field(header, 263, 2)).toBe("00");
  expect(header.subarray(265, 265 + 32).every((b) => b === 0)).toBe(true);
  expect(header.subarray(297, 297 + 32).every((b) => b === 0)).toBe(true);
});

test("directory header uses typeflag 5, size 0 and mode 0755", () => {
  const out = buildUstarArchive([{ path: "rules/", mode: 0o755 }]);
  const header = out.subarray(0, 512);
  expect(field(header, 0, 6)).toBe("rules/");
  expect(field(header, 100, 8)).toBe("0000755\0");
  expect(field(header, 124, 12)).toBe("00000000000\0");
  expect(field(header, 156, 1)).toBe("5");
  // a directory has no content block: end-of-archive zeros start right after the header
  expect(out.subarray(512, 1536).every((b) => b === 0)).toBe(true);
});

test("checksum is the byte sum of the header with the checksum field as spaces, written as 6 octal digits, NUL, space", () => {
  const out = buildUstarArchive([{ path: "x", mode: 0o644, content: encoder.encode("1") }]);
  const header = out.subarray(0, 512);
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 0x20 : (header[i] ?? 0);
  expect(field(header, 148, 8)).toBe(`${sum.toString(8).padStart(6, "0")}\0 `);
});

test("mode is written as octal of mode & 0o777: an executable file gets 0755 and a plain file 0644", () => {
  const out = buildUstarArchive([
    { path: "plain", mode: 0o100644, content: new Uint8Array() },
    { path: "exec", mode: 0o100755, content: new Uint8Array() },
  ]);
  expect(field(out.subarray(0, 512), 100, 8)).toBe("0000644\0");
  expect(field(out.subarray(512, 1024), 100, 8)).toBe("0000755\0");
});

test("tarMode derives the mode from content, never from the filesystem: directories 0755, shebang files 0755, anything else 0644", () => {
  expect(tarMode(undefined)).toBe(0o755); // directory
  expect(tarMode(encoder.encode("#!/bin/sh\necho hi\n"))).toBe(0o755); // starts with "#!"
  expect(tarMode(encoder.encode("#!/usr/bin/env bash\n"))).toBe(0o755);
  expect(tarMode(encoder.encode("1.0.0\n"))).toBe(0o644); // plain file
  expect(tarMode(new Uint8Array())).toBe(0o644); // empty file
  expect(tarMode(encoder.encode("# heading, not a shebang\n"))).toBe(0o644); // "#" but not "#!"
  expect(tarMode(encoder.encode("#"))).toBe(0o644); // a single "#" byte
  expect(tarMode(encoder.encode(" #!/bin/sh\n"))).toBe(0o644); // "#!" not at offset 0
});

test("entries are written in the order given and content is padded to 512 bytes each", () => {
  const a = encoder.encode("a".repeat(513));
  const out = buildUstarArchive([
    { path: "b", mode: 0o644, content: encoder.encode("b") },
    { path: "a", mode: 0o644, content: a },
  ]);
  expect(field(out.subarray(0, 512), 0, 1)).toBe("b");
  // b: header(512) + content padded(512) → a's header at 1024
  expect(field(out.subarray(1024, 1536), 0, 1)).toBe("a");
  expect(field(out.subarray(1024, 1536), 124, 12)).toBe("00000001001\0");
  // a: header at 1024, content 513 bytes padded to 1024 → end zeros at 3072, total padded to 10240
  expect(out.length).toBe(10240);
});

test("rejects a path longer than 100 bytes with a clear message", () => {
  const long = `${"a".repeat(101)}`;
  expect(() => buildUstarArchive([{ path: long, mode: 0o644, content: new Uint8Array() }])).toThrow(/100 bytes/);
});

test("rejects a directory path without trailing slash and a file path with one", () => {
  expect(() => buildUstarArchive([{ path: "dir", mode: 0o755 }])).toThrow(/trailing/);
  expect(() => buildUstarArchive([{ path: "file/", mode: 0o644, content: new Uint8Array() }])).toThrow(/trailing/);
});
