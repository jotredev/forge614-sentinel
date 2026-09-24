const MAX = 80;

function clip(line: string): string {
  return line.length > MAX ? `${line.slice(0, MAX - 1)}…` : line;
}

// Text lines: a final newline ends the last line, it does not start another.
function linesOf(text: string): string[] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

// Positional line comparison: enough to point a person at the drift in a
// rendered template, cheap and deterministic on every platform.
export function lineDiff(expected: string, actual: string, label: string, limit = 5): string[] {
  const a = linesOf(expected);
  const b = linesOf(actual);
  const out: string[] = [];
  let differing = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] === b[i]) continue;
    differing += 1;
    if (out.length < limit) out.push(`${label}:${i + 1}: expected '${clip(a[i] ?? "")}' got '${clip(b[i] ?? "")}'`);
  }
  if (differing > limit) out.push(`${label}: ${differing - limit} more differing lines`);
  if (a.length !== b.length) out.push(`${label}: ${b.length} lines vs template ${a.length}`);
  // linesOf ignores a final newline, so byte-for-byte equality needs its own check.
  if (expected.endsWith("\n") !== actual.endsWith("\n")) out.push(`${label}: final newline differs from template`);
  return out;
}
