import { run, type RunOptions, type RunResult } from "../infrastructure/process";

export function runCommand(cmd: string[], options: RunOptions = {}): RunResult {
  return run(cmd, options);
}
