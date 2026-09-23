export const PACKAGE_KINDS = ["rule", "skill", "mcp", "plugin", "policy", "pack"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

export function isPackageKind(value: string): value is PackageKind {
  return PACKAGE_KINDS.some((kind) => kind === value);
}

export const PACKAGE_NAME_PATTERN = /^([a-z0-9]+)-(rule|skill|mcp|plugin|policy|pack)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parsePackageName(name: string): { origin: string; kind: PackageKind; slug: string } | null {
  const m = PACKAGE_NAME_PATTERN.exec(name);
  if (!m) return null;
  const [, origin, kind, slug] = m;
  if (!origin || !kind || !slug || !isPackageKind(kind)) return null;
  return { origin, kind, slug };
}
