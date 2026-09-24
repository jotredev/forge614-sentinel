import type { z } from "zod";

export function parseFlags(argv: string[]): Record<string, true> {
  const out: Record<string, true> = {};
  for (const arg of argv) out[arg.startsWith("--") ? arg.slice(2) : arg] = true;
  return out;
}

// `--key value` CLIs (workflows-run): pairs only; a key without a value at
// the end is dropped, and the strict schema on top rejects unknown keys.
export function parsePairs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith("--") && value !== undefined) out[key.slice(2)] = value;
  }
  return out;
}

// `--key value` for the flags listed in valueFlags, bare `--flag` for the
// rest, and anything without `--` as a positional. A value flag at the end
// without its value becomes `true`, which the strict schema then rejects.
export function parseMixed(argv: string[], valueFlags: readonly string[]): { flags: Record<string, string | true>; positionals: string[] } {
  const flags: Record<string, string | true> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (valueFlags.includes(key)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) flags[key] = true;
      else {
        flags[key] = value;
        i += 1;
      }
      continue;
    }
    flags[key] = true;
  }
  return { flags, positionals };
}

export function issuesOf(error: z.ZodError): string {
  return error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("; ");
}
