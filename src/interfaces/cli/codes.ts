// Every error code Sentinel can emit (spec §7 plus INVALID_ARGUMENTS).
// `--help` prints this list, and node-contract cross-checks CONTRACT.md
// against these literals.
export const SENTINEL_ERROR_CODES: readonly string[] = [
  "INVALID_ARGUMENTS",
  "NODE_POINTER_INVALID",
  "STANDARD_UNAVAILABLE",
  "STANDARD_CORRUPT",
  "STANDARD_FETCH_FAILED",
  "CHECK_FAILED",
  "SENTINEL_FAILED",
];
