import { expect, test } from "bun:test";
import { join } from "node:path";
import { cacheRoot, describeCacheLocation, fetcherFromEnv, releaseBaseFromEnv } from "./environment";

test("re-exports the environment readers the CLIs need", async () => {
  expect(cacheRoot({ FORGE614_HOME: "/x/home" })).toBe(join("/x/home", "standard"));
  expect(describeCacheLocation("1.0.0")).toBe("<FORGE614_HOME>/standard/1.0.0");
  expect(releaseBaseFromEnv({})).toBe("https://github.com/jotredev/forge614-ai/releases/download");
  await expect(fetcherFromEnv({ FORGE614_SENTINEL_OFFLINE: "1" })("https://x")).rejects.toThrow(/offline/);
});
