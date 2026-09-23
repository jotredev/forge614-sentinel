import { fail, pass, type CheckDefinition } from "../check";

const ENV_FILE = /^\.env(?:\..+)?$/;
const ENV_EXAMPLE = /^\.env\.(?:example|sample|template|dist)$/;
const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const PLACEHOLDER = /^(?:<.*>|\$\{.*\}|changeme|change-me|xxx+|todo|your[-_].*|)$/i;

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function isExcluded(path: string, excludePaths: readonly string[]): boolean {
  return excludePaths.some((ex) => (ex.endsWith("/") ? path.startsWith(ex) : path === ex));
}

function unquote(value: string): string {
  const v = value.trim().replace(/\s+#.*$/, "");
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

// Evidence names the pattern and the location, never the matched text: the
// report travels through CI logs.
export const secretsHygieneCheck: CheckDefinition = {
  id: "secrets-hygiene",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    const evidence: string[] = [
      params.secrets.source === "builtin"
        ? `secret patterns source: builtin (standard ${params.standard.version} ships no secret-patterns.json)`
        : "secret patterns source: standard/secret-patterns.json",
    ];
    const matchers = params.secrets.patterns.map((p) => [p.id, new RegExp(p.pattern)] as const);
    const hits: string[] = [];
    for (const [path, text] of snapshot.files) {
      if (isExcluded(path, params.secrets.excludePaths)) continue;
      const name = basename(path);
      const envWithValues = ENV_FILE.test(name) && !ENV_EXAMPLE.test(name);
      text.split("\n").forEach((line, i) => {
        for (const [id, re] of matchers) if (re.test(line)) hits.push(`${path}:${i + 1}: ${id}`);
        if (!envWithValues) return;
        const m = ENV_LINE.exec(line);
        if (m?.[1] !== undefined && !PLACEHOLDER.test(unquote(m[2] ?? ""))) hits.push(`${path}:${i + 1}: .env value for ${m[1]}`);
      });
    }
    return hits.length === 0 ? pass("secretsNone", {}, evidence) : fail([...evidence, ...hits], "secretsFound");
  },
};
