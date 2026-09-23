// A line inside a fenced code block (``` ... ```) is never a heading, even
// when it starts with '#': shell comments and sample Markdown would
// otherwise be counted and break the es/en parity check.
export function headingLines(text: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && /^#{1,6}\s/.test(line)) out.push(line);
  }
  return out;
}

export function countHeadings(text: string): number {
  return headingLines(text).length;
}

// Leading number (or Anexo/Appendix letter) of every numbered heading, in
// document order, so an es/en pair can be compared by order and numbering.
export function headingNumbering(text: string): string[] {
  const tokens: string[] = [];
  for (const line of headingLines(text)) {
    const body = line.replace(/^#{1,6}\s+/, "");
    const numbered = /^(\d+(?:\.\d+)*)\./.exec(body)?.[1];
    if (numbered) {
      tokens.push(numbered);
      continue;
    }
    const lettered = /^(?:Anexo|Appendix)\s+([A-Za-z0-9]+)/i.exec(body)?.[1];
    if (lettered) tokens.push(lettered.toUpperCase());
  }
  return tokens;
}

// Rows of the first Markdown table found after `heading` (a "## …" line),
// excluding the header row and the separator; each row is its cells trimmed.
export function tableRowsAfter(text: string, heading: string): string[][] {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return [];
  const rows: string[][] = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim().startsWith("|")) {
      if (inTable) break;
      continue;
    }
    inTable = true;
    const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator
    rows.push(cells);
  }
  return rows.slice(1); // drop the header row
}
