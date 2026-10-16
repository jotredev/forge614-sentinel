import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodePointerSchema, type NodePointer } from "../modules/schemas/node-pointer";

export type Classification =
  | { kind: "node"; pointer: NodePointer }
  | { kind: "missing-pointer" }
  | { kind: "external-project" }
  | { kind: "not-a-forge614-repo" }
  | { kind: "invalid-pointer"; error: string };

function issuesOf(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues.map((i) => (i.path.length > 0 ? `${i.path.map(String).join(".")}: ${i.message}` : i.message)).join("; ");
}

// Identity files only (acta 0023, spec §4): never the folder name, never
// git remotes, never what is next to it on disk. Two existence checks and
// one strict parse: a foreign folder is answered without reading its tree.
export function classifyRepository(root: string): Classification {
  const pointerPath = join(root, "forge614.node.json");
  if (existsSync(pointerPath)) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(pointerPath, "utf8"));
    } catch (error) {
      return { kind: "invalid-pointer", error: `forge614.node.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
    const parsed = NodePointerSchema.safeParse(raw);
    if (!parsed.success) return { kind: "invalid-pointer", error: `forge614.node.json does not match NodePointerSchema: ${issuesOf(parsed.error)}` };
    return { kind: "node", pointer: parsed.data };
  }
  const projectPath = join(root, ".forge614", "project.json");
  if (existsSync(projectPath)) {
    try {
      const project = JSON.parse(readFileSync(projectPath, "utf8")) as { ecosystem?: { name?: unknown } };
      if (project.ecosystem?.name === "forge614") return { kind: "missing-pointer" };
    } catch {
      // An unreadable or malformed third-party project file is not a node identity.
    }
    return { kind: "external-project" };
  }
  return { kind: "not-a-forge614-repo" };
}
