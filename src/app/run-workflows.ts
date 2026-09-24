import { parse } from "yaml";
import { read, type RepoSnapshot } from "../modules/snapshot";
import { jobsOf, runStepsOf, WorkflowSchema } from "../modules/workflow";

type Exec = (cmd: string[]) => { exitCode: number; stdout: string; stderr: string };

export interface WorkflowRunResult {
  schemaVersion: 1;
  workflow: string;
  jobs: Array<{ job: string; steps: Array<{ run: string; exitCode: number }> }>;
  ok: boolean;
}

// Runs the `run` steps of every job of .github/workflows/<name>.yml locally,
// in order, stopping a job at its first failing step (what CI would do).
// Workflows are thin (acta 0019), so every step is a plain command line.
export function runWorkflow(snapshot: RepoSnapshot, name: string, exec: Exec): WorkflowRunResult {
  const raw = read(snapshot, `.github/workflows/${name}.yml`);
  if (raw === undefined) throw new Error(`workflow not found: ${name}`);
  const workflow = WorkflowSchema.parse(parse(raw));

  const jobs: WorkflowRunResult["jobs"] = [];
  let ok = true;
  for (const job of jobsOf(workflow)) {
    const steps: Array<{ run: string; exitCode: number }> = [];
    for (const run of runStepsOf(workflow, job)) {
      const result = exec(run.split(/\s+/));
      steps.push({ run, exitCode: result.exitCode });
      if (result.exitCode !== 0) {
        ok = false;
        break;
      }
    }
    jobs.push({ job, steps });
  }
  return { schemaVersion: 1, workflow: name, jobs, ok };
}
