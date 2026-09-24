export function printError(code: string, error: string): void {
  process.stderr.write(`${JSON.stringify({ schemaVersion: 1, code, error })}\n`);
}
printError("INVALID_ARGUMENTS", "unknown flag");
printError("DEMO_FAILED", "unexpected");
