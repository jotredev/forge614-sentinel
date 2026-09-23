// Character-level scanners for the two text shapes the stack check reads:
// TypeScript source (comments, string contents and regular-expression bodies
// are blanked, newlines are kept so line numbers survive) and JSONC
// (comments are removed).

// A "/" starts a regular-expression literal, not a division, when the last
// significant character before it is an operator, an opening bracket, a
// separator or nothing, or when it follows a keyword that takes an
// expression. Without this, a quote inside a pattern such as /["'`]/ would
// open a fake string and blank the rest of the file.
const REGEX_PRECEDERS = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_KEYWORDS = /\b(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

function startsRegex(before: string): boolean {
  const trimmed = before.trimEnd();
  return REGEX_PRECEDERS.has(trimmed.slice(-1)) || REGEX_KEYWORDS.test(trimmed);
}

export function stripCommentsAndStrings(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (c === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += quote;
      i += 1;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") i += 1;
        if (source[i] === "\n") out += "\n";
        i += 1;
      }
      out += quote;
      i += 1;
      continue;
    }
    if (c === "/" && startsRegex(out)) {
      // Regular-expression literal: keep both slashes, blank the body (an
      // escaped "/" or one inside a [...] class does not end it). A literal
      // never spans lines; the flags after it are copied as ordinary text.
      out += "/";
      i += 1;
      let inClass = false;
      while (i < n && source[i] !== "\n") {
        const ch = source[i];
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) break;
        i += 1;
      }
      if (source[i] === "/") {
        out += "/";
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

export function stripJsonComments(jsonc: string): string {
  let out = "";
  let i = 0;
  const n = jsonc.length;
  while (i < n) {
    const c = jsonc[i] ?? "";
    const next = jsonc[i + 1] ?? "";
    if (c === '"') {
      out += c;
      i += 1;
      while (i < n && jsonc[i] !== '"') {
        if (jsonc[i] === "\\") {
          out += jsonc[i] ?? "";
          i += 1;
        }
        out += jsonc[i] ?? "";
        i += 1;
      }
      out += '"';
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < n && jsonc[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(jsonc[i] === "*" && jsonc[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}
