const PLACEHOLDER = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

export function placeholdersOf(content: string): string[] {
  return [...new Set([...content.matchAll(PLACEHOLDER)].map((m) => m[1] ?? ""))];
}

export function renderTemplate(content: string, vars: Readonly<Record<string, string>>): string {
  const out = content.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? (vars[name] ?? whole) : whole));
  const left = placeholdersOf(out);
  if (left.length > 0) throw new Error(`unresolved placeholders: ${left.join(", ")}`);
  return out;
}
