import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface FetchResponse {
  ok: boolean;
  status: number;
  bytes: Uint8Array;
}

export type Fetcher = (url: string) => Promise<FetchResponse>;

export const DEFAULT_RELEASE_BASE = "https://github.com/jotredev/forge614-ai/releases/download";

// Test and CI seam: a file:// base serves a release layout from disk
// (fixtures/standard/), and OFFLINE simulates a machine without network.
// Neither changes what Sentinel verifies: sha256 checks run the same way.
export function releaseBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const base = env.FORGE614_SENTINEL_RELEASE_BASE;
  return base !== undefined && base !== "" ? base.replace(/\/+$/, "") : DEFAULT_RELEASE_BASE;
}

export function httpFetcher(): Fetcher {
  return async (url) => {
    const response = await fetch(url, { redirect: "follow" });
    return { ok: response.ok, status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
  };
}

export function fileFetcher(): Fetcher {
  return async (url) => {
    const path = fileURLToPath(url);
    if (!existsSync(path)) return { ok: false, status: 404, bytes: new Uint8Array() };
    return { ok: true, status: 200, bytes: new Uint8Array(readFileSync(path)) };
  };
}

export function offlineFetcher(): Fetcher {
  return async () => {
    throw new Error("offline: network disabled by FORGE614_SENTINEL_OFFLINE");
  };
}

export function fetcherFromEnv(env: Record<string, string | undefined> = process.env): Fetcher {
  if (env.FORGE614_SENTINEL_OFFLINE === "1") return offlineFetcher();
  if (releaseBaseFromEnv(env).startsWith("file://")) return fileFetcher();
  return httpFetcher();
}
