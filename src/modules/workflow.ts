import { z } from "zod";

const UsesStep = z
  .object({
    uses: z.string(),
    with: z.record(z.string(), z.unknown()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    name: z.string().optional(),
  })
  .strict();
const RunStep = z
  .object({
    run: z.string(),
    env: z.record(z.string(), z.string()).optional(),
    name: z.string().optional(),
  })
  .strict();
export const StepSchema = z.union([UsesStep, RunStep]);
// spec §4.7: every job declares `timeout-minutes`; no stage may run without
// a limit (a release once hung in `bun test` on a suite with no timeout).
const Job = z
  .object({
    "runs-on": z.string(),
    "timeout-minutes": z.number().int().positive(),
    steps: z.array(StepSchema).min(1),
    needs: z.union([z.string(), z.array(z.string())]).optional(),
    // R28: a parity matrix declares `fail-fast: false` so every operating
    // system reports its own result instead of being cancelled by the first
    // failure; still strict, so no other strategy key slips through.
    strategy: z
      .object({ "fail-fast": z.boolean().optional(), matrix: z.record(z.string(), z.unknown()) })
      .strict()
      .optional(),
    permissions: z.record(z.string(), z.string()).optional(),
  })
  .strict();
export const WorkflowSchema = z.object({ name: z.string().min(1), on: z.record(z.string(), z.unknown()), jobs: z.record(z.string(), Job) }).strict();
export type Workflow = z.infer<typeof WorkflowSchema>;

export const ALLOWED_RUN = /^(bun install --frozen-lockfile|bun test|bun run [a-z0-9:.-]+)$/;
export const PINNED_USES = /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}(\s+#.*)?$/;

export function checkWorkflowShape(w: Workflow, id: string): string[] {
  const out: string[] = [];
  for (const [job, def] of Object.entries(w.jobs)) {
    def.steps.forEach((s, i) => {
      if ("uses" in s && !PINNED_USES.test(s.uses)) {
        out.push(`${id}: job ${job} step ${i + 1}: uses not pinned to a 40-hex SHA: ${s.uses}`);
      }
      if ("run" in s && !ALLOWED_RUN.test(s.run.trim())) {
        out.push(`${id}: job ${job} step ${i + 1}: run must be 'bun run <script>', 'bun test' or 'bun install --frozen-lockfile': ${s.run.trim()}`);
      }
    });
  }
  return out;
}

export function jobsOf(w: Workflow): string[] {
  return Object.keys(w.jobs);
}

export function runStepsOf(w: Workflow, job: string): string[] {
  const def = w.jobs[job];
  if (!def) return [];
  return def.steps.flatMap((s) => ("run" in s ? [s.run.trim()] : []));
}
