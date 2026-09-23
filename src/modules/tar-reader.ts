// Pure POSIX ustar reader: the counterpart of tar.ts. It reads the archives
// forge614-ai publishes (ustar, no prefix field, no long names, no PAX) and
// refuses anything it does not understand instead of guessing.
export interface TarMember {
  path: string;
  mode: number;
  content?: Uint8Array;
}

const BLOCK = 512;
const decoder = new TextDecoder();

function cstring(block: Uint8Array, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return decoder.decode(end < 0 ? slice : slice.subarray(0, end));
}

function octal(block: Uint8Array, offset: number, length: number): number {
  const text = cstring(block, offset, length).trim();
  if (text === "") return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error(`tar: invalid octal field at ${offset}: '${text}'`);
  return Number.parseInt(text, 8);
}

function isSafePath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((segment) => segment === "" || (segment !== ".." && segment !== "."));
}

export function parseUstar(bytes: Uint8Array): TarMember[] {
  const members: TarMember[] = [];
  let offset = 0;
  while (offset + BLOCK <= bytes.length) {
    const header = bytes.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break; // end-of-archive zero block

    if (cstring(header, 257, 6) !== "ustar") throw new Error(`tar: bad magic at offset ${offset}`);

    let sum = 0;
    for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 0x20 : (header[i] ?? 0);
    if (octal(header, 148, 8) !== sum) throw new Error(`tar: header checksum mismatch at offset ${offset}`);

    const path = cstring(header, 0, 100);
    if (!isSafePath(path)) throw new Error(`tar: unsafe member path '${path}'`);
    const mode = octal(header, 100, 8) & 0o777;
    const size = octal(header, 124, 12);
    const typeflag = header[156];
    const isDirectory = typeflag === 0x35 || (typeflag === 0 && path.endsWith("/"));

    offset += BLOCK;
    if (isDirectory) {
      members.push({ path: path.endsWith("/") ? path : `${path}/`, mode });
      continue;
    }
    if (typeflag !== 0x30 && typeflag !== 0) throw new Error(`tar: unsupported member type '${String.fromCharCode(typeflag ?? 0)}' for '${path}'`);
    if (offset + size > bytes.length) throw new Error(`tar: truncated archive: '${path}' declares ${size} bytes`);
    members.push({ path, mode, content: bytes.slice(offset, offset + size) });
    offset += size + ((BLOCK - (size % BLOCK)) % BLOCK);
  }
  return members;
}
