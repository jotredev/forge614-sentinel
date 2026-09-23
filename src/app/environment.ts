// The CLIs resolve the cache root and the network from the process
// environment through app, never by importing infrastructure directly
// (layer rule interfaces → app). Same pattern as run-command.ts.
export { cacheRoot, describeCacheLocation } from "../infrastructure/cache";
export { fetcherFromEnv, releaseBaseFromEnv } from "../infrastructure/network";
