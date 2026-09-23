import { z } from "zod";
import { fail, pass, type CheckDefinition } from "../check";
import { listUnder, read, type RepoSnapshot } from "../snapshot";
import { checkWorkflowShape, jobsOf, WorkflowSchema } from "../workflow";

const RUN_SCRIPT = /^bun run ([a-z0-9:.-]+)$/;
const PackageJsonScripts = z.object({ scripts: z.record(z.string(), z.string()).optional() }).passthrough();

function documentedJobs(doc: string): Set<string> {
  const jobs = new Set<string>();
  const lines = doc.split("\n");
  lines.forEach((line, i) => {
    if (!/^\|\s*Job\s*\|/i.test(line)) return;
    for (let j = i + 2; j < lines.length && lines[j]?.startsWith("|"); j += 1) {
      const cell = lines[j]?.split("|")[1]?.trim().replace(/`/g, "") ?? "";
      if (cell) jobs.add(cell);
    }
  });
  return jobs;
}

function packageScripts(snapshot: RepoSnapshot): Set<string> | undefined {
  const raw = read(snapshot, "package.json");
  if (raw === undefined) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = PackageJsonScripts.safeParse(data);
  return parsed.success ? new Set(Object.keys(parsed.data.scripts ?? {})) : undefined;
}

export const workflowsCheck: CheckDefinition = {
  id: "workflows",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    const evidence: string[] = [];
    const files = listUnder(snapshot, ".github/workflows/").filter((p) => /\.ya?ml$/.test(p));
    if (files.length === 0) return pass("workflowsNone");

    const docPath = listUnder(snapshot, "docs/es/").find((p) => /docs\/es\/\d{2}-workflows\.md$/.test(p));
    const documented = docPath ? documentedJobs(read(snapshot, docPath) ?? "") : new Set<string>();
    if (!docPath) evidence.push("docs/es/NN-workflows.md missing (no file matches docs/es/[0-9][0-9]-workflows.md)");
    const scripts = packageScripts(snapshot);

    for (const path of files) {
      const id = path.slice(".github/workflows/".length);
      let raw: unknown;
      try {
        raw = params.parseYaml(read(snapshot, path) ?? "");
      } catch (e) {
        evidence.push(`${id}: YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      const parsed = WorkflowSchema.safeParse(raw);
      if (!parsed.success) {
        evidence.push(`${id}: schema: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        continue;
      }
      evidence.push(...checkWorkflowShape(parsed.data, id));
      for (const job of jobsOf(parsed.data)) {
        if (docPath && !documented.has(job)) evidence.push(`${id}: job '${job}' not documented in ${docPath}`);
        if (!scripts) continue;
        parsed.data.jobs[job]?.steps.forEach((s, i) => {
          if (!("run" in s)) return;
          const script = RUN_SCRIPT.exec(s.run.trim())?.[1];
          if (script !== undefined && !scripts.has(script)) evidence.push(`${id}: job ${job} step ${i + 1}: script '${script}' not found in package.json scripts: ${s.run.trim()}`);
        });
      }
    }
    return evidence.length === 0 ? pass("workflowsOk") : fail(evidence, "workflowsInvalid");
  },
};
