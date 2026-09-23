export function printJson(payload: Record<string, unknown> & { schemaVersion: number }): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function printError(code: string, error: string, schemaVersion = 1): void {
  process.stderr.write(`${JSON.stringify({ schemaVersion, code, error })}\n`);
}

// Every CLI ends with `process.exit(await runCli(CODE, main))`: whatever
// `main` throws leaves through the error envelope with that code and exit 1,
// never as a raw stack trace (acta 0013). A normal return passes through.
export async function runCli(failureCode: string, main: () => number | Promise<number>): Promise<number> {
  try {
    return await main();
  } catch (error) {
    printError(failureCode, error instanceof Error ? error.message : String(error));
    return 1;
  }
}
