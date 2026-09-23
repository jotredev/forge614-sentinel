// Pure POSIX ustar writer, the same one forge614-ai uses to package the
// standard. Sentinel needs it for two things: to build the release archives
// of its own binaries with pinned metadata (build:target) and to produce
// archives in tests for the reader below. Header fields that would depend on
// the machine are pinned: uid/gid 0, empty uname/gname, mtime 0.

export interface TarEntry {
  /** Relative path inside the archive; a directory carries a trailing "/". */
  path: string;
  /** Mode whose low 9 bits are written; see tarMode for the normalization rule. */
  mode: number;
  /** File bytes; undefined means the entry is a directory. */
  content?: Uint8Array;
}

const BLOCK = 512;
const RECORD = 10240;
const NAME_MAX = 100;

const encoder = new TextEncoder();

// The archive mode is derived from CONTENT, never from the filesystem
// (coordinator ruling R18): a directory (undefined content) is 0755, a file
// whose bytes start with "#!" (a shebang script) is 0755, any other file is
// 0644. On-disk modes are not consulted at all: Windows has no execute bit,
// so a checkout there would otherwise yield different header bytes and a
// different sha256, and umask differs per machine. Content is the same on
// every platform, so this rule gives the same header bytes everywhere.
export function tarMode(content: Uint8Array | undefined): number {
  if (content === undefined) return 0o755;
  return content.length >= 2 && content[0] === 0x23 && content[1] === 0x21 ? 0o755 : 0o644;
}

function writeAscii(block: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) block[offset + i] = text.charCodeAt(i);
}

// Octal, zero-padded to `width - 1` digits and NUL-terminated (the ustar
// numeric field convention).
function octal(value: number, width: number): string {
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}

function header(entry: TarEntry): Uint8Array<ArrayBuffer> {
  const isDirectory = entry.content === undefined;
  if (isDirectory !== entry.path.endsWith("/")) {
    throw new Error(`tar entry path must carry a trailing "/" exactly when it is a directory: ${entry.path}`);
  }
  const name = encoder.encode(entry.path);
  if (name.length === 0 || name.length > NAME_MAX) {
    throw new Error(`tar entry path must be 1..${NAME_MAX} bytes (ustar name field, no prefix support): ${entry.path}`);
  }

  const block = new Uint8Array(BLOCK);
  block.set(name, 0);
  writeAscii(block, 100, octal(entry.mode & 0o777, 8));
  writeAscii(block, 108, octal(0, 8)); // uid
  writeAscii(block, 116, octal(0, 8)); // gid
  writeAscii(block, 124, octal(entry.content?.length ?? 0, 12)); // size
  writeAscii(block, 136, octal(0, 12)); // mtime: epoch
  writeAscii(block, 148, "        "); // checksum placeholder: 8 spaces
  block[156] = isDirectory ? 0x35 : 0x30; // typeflag '5' / '0'
  writeAscii(block, 257, "ustar\0"); // magic
  writeAscii(block, 263, "00"); // version
  // uname (265) and gname (297) stay empty; devmajor/devminor are zero.
  writeAscii(block, 329, octal(0, 8));
  writeAscii(block, 337, octal(0, 8));

  let sum = 0;
  for (const byte of block) sum += byte;
  writeAscii(block, 148, `${sum.toString(8).padStart(6, "0")}\0 `);
  return block;
}

function padding(length: number, unit: number): number {
  return (unit - (length % unit)) % unit;
}

export function buildUstarArchive(entries: TarEntry[]): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const entry of entries) {
    parts.push(header(entry));
    total += BLOCK;
    if (entry.content !== undefined && entry.content.length > 0) {
      parts.push(entry.content);
      total += entry.content.length;
      const pad = padding(entry.content.length, BLOCK);
      if (pad > 0) {
        parts.push(new Uint8Array(pad));
        total += pad;
      }
    }
  }
  // Two zero blocks mark the end of the archive; the whole stream is then
  // padded to a full record, which is what tar readers expect.
  total += 2 * BLOCK;
  const out = new Uint8Array(total + padding(total, RECORD));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
