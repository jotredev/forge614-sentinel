import { fail, pass, type CheckDefinition } from "../check";
import { deepDiff } from "../deep-diff";
import { has, read, readRaw } from "../snapshot";
import { PINNED_USES, WorkflowSchema, type Workflow } from "../workflow";

const WORKFLOWS = ["verify.yml", "release.yml"] as const;

function parseWorkflow(text: string, parseYaml: (t: string) => unknown): Workflow | string {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    return `YAML parse error: ${e instanceof Error ? e.message : String(e)}`;
  }
  const parsed = WorkflowSchema.safeParse(raw);
  return parsed.success ? parsed.data : `schema: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
}

/** Removes only the documented forge614-ai verify-workflow additions before diffing. */
function aiVerifyForComparison(expected: Workflow, actual: Workflow): Workflow {
  const normalized = structuredClone(actual);
  const expectedCheckout = expected.jobs.verify?.steps.find((step) => "uses" in step && step.uses.startsWith("actions/checkout@"));
  const checkoutUses = expectedCheckout && "uses" in expectedCheckout ? expectedCheckout.uses : undefined;
  const steps = normalized.jobs.verify?.steps;
  if (steps === undefined) return normalized;
  for (const step of steps) {
    if ("uses" in step && step.uses === checkoutUses && step.with !== undefined) {
      const settings = { ...step.with };
      delete settings["fetch-depth"];
      delete settings["fetch-tags"];
      if (Object.keys(settings).length === 0) delete step.with;
      else step.with = settings;
    }
  }
  const setupNodeIndexes = steps.flatMap((step, index) => "uses" in step && /^actions\/setup-node@[0-9a-f]{40}$/.test(step.uses) ? [index] : []);
  if (setupNodeIndexes.length === 1) steps.splice(setupNodeIndexes[0]!, 1);
  return normalized;
}

/** Compares raw file bytes without decoding or line-ending normalization. */
function bytesEqual(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
  return left !== undefined && right !== undefined && left.length === right.length && left.every((byte, index) => byte === right[index]);
}

// The template's jobs must be present and identical (name, triggers and
// every step). A repository may add only the jobs in params.allowedExtraJobs
// (spec §13: `parity` is the explicit allowed deviation); `workflows` keeps
// those thin. Every `uses` anywhere is pinned.
export const releaseCheck: CheckDefinition = {
  id: "release",
  appliesWhen: () => true,
  run: (snapshot, params) => {
    const evidence: string[] = [];
    let problems = 0;
    const flag = (line: string): void => {
      evidence.push(line);
      problems += 1;
    };

    for (const name of WORKFLOWS) {
      if (params.pointer.node === "ai" && name === "release.yml") continue;
      const path = `.github/workflows/${name}`;
      const template = params.templates.get(name);
      if (template === undefined) {
        flag(`template ${name} missing from standard ${params.standard.version}`);
        continue;
      }
      const actualText = read(snapshot, path);
      if (actualText === undefined) {
        flag(`${path} missing`);
        continue;
      }
      const expected = parseWorkflow(template, params.parseYaml);
      const parsedActual = parseWorkflow(actualText, params.parseYaml);
      const actual = typeof expected !== "string" && typeof parsedActual !== "string" && params.pointer.node === "ai" && name === "verify.yml"
        ? aiVerifyForComparison(expected, parsedActual)
        : parsedActual;
      if (typeof expected === "string") {
        flag(`template ${name}: ${expected}`);
        continue;
      }
      if (typeof actual === "string") {
        flag(`${name}: ${actual}`);
        continue;
      }
      for (const line of deepDiff(expected.name, actual.name, "name")) flag(`${name}: ${line}`);
      for (const line of deepDiff(expected.on, actual.on, "on")) flag(`${name}: ${line}`);
      for (const job of Object.keys(expected.jobs)) {
        if (!(job in actual.jobs)) {
          flag(`${name}: jobs.${job}: missing`);
          continue;
        }
        for (const line of deepDiff(expected.jobs[job], actual.jobs[job], `jobs.${job}`)) flag(`${name}: ${line}`);
      }
      for (const job of Object.keys(actual.jobs)) {
        if (job in expected.jobs) continue;
        if (params.allowedExtraJobs.includes(job)) evidence.push(`${name}: extra job '${job}' (allowed; its shape is checked by 'workflows')`);
        else flag(`${name}: extra job '${job}' is not in the allowed list (${params.allowedExtraJobs.join(", ")})`);
      }
      for (const [job, def] of Object.entries(actual.jobs)) {
        def.steps.forEach((s, i) => {
          if ("uses" in s && !PINNED_USES.test(s.uses)) flag(`${name}: job ${job} step ${i + 1}: uses not pinned to a 40-hex SHA: ${s.uses}`);
        });
      }
    }
    if (params.pointer.node !== "ai" && params.templates.has("install.mjs")) {
      const template = params.rawTemplates.get("prepare-release-assets.mjs");
      const actual = readRaw(snapshot, "scripts/prepare-release-assets.mjs");
      if (template === undefined) flag(`raw template prepare-release-assets.mjs missing from standard ${params.standard.version}`);
      else if (!bytesEqual(template, actual)) flag("scripts/prepare-release-assets.mjs differs from template bytes");
    }
    if (!has(snapshot, "CHANGELOG.md")) flag("CHANGELOG.md missing");
    return problems === 0 ? pass("releaseOk", {}, evidence) : fail(evidence, "releaseDrifted");
  },
};
