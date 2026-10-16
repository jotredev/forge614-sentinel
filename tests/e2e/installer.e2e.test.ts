import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SENTINEL_VERSION } from "../../src/interfaces/cli/version";
import { builtBinary } from "./binary";

const REPO_ROOT = resolve(import.meta.dir, "../..");

/** Run a child process asynchronously so the local HTTP release server can keep serving requests. */
async function runAsync(cmd: string[], options: { cwd: string; env: Record<string, string>; timeoutMs?: number }) {
  const proc = Bun.spawn(cmd, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => proc.kill(), options.timeoutMs ?? 120_000);
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    return { exitCode, stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
}

test.skipIf(process.platform === "win32")("real install.sh + install.mjs install, update, targeted update and uninstall (Windows skipped: POSIX shell gate is not available)", async () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-installer-e2e-"));
  const stageRoot = join(root, "source");
  const releaseDir = join(stageRoot, "dist", "release");
  mkdirSync(stageRoot, { recursive: true });
  mkdirSync(releaseDir, { recursive: true });

  for (const name of ["package.json", "forge614.node.json", "install.sh", "install.ps1", "install.mjs"]) {
    cpSync(join(REPO_ROOT, name), join(stageRoot, name));
  }

  const binary = builtBinary();
  expect(existsSync(binary)).toBe(true);
  const hostArchive = process.platform === "darwin"
    ? `forge614-sentinel-darwin-${process.arch}.tar.gz`
    : `forge614-sentinel-linux-${process.arch}.tar.gz`;
  cpSync(join(tmpdir(), `sentinel-e2e-${process.pid}`, hostArchive), join(releaseDir, hostArchive));
  for (const target of ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"]) {
    const archive = `forge614-sentinel-${target}.${target.startsWith("windows") ? "zip" : "tar.gz"}`;
    if (archive !== hostArchive) writeFileSync(join(releaseDir, archive), "unused platform asset");
  }

  const prepareEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[0] !== "GITHUB_REF_NAME"),
  );
  const prepareProcess = Bun.spawnSync(["bun", "run", join(REPO_ROOT, "scripts/prepare-release-assets.mjs")], {
    cwd: stageRoot,
    env: prepareEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
  const prepared = { exitCode: prepareProcess.exitCode, stderr: new TextDecoder().decode(prepareProcess.stderr) };
  expect(prepared.exitCode, prepared.stderr).toBe(0);
  expect(readdirSync(releaseDir).sort()).toEqual([
    "SHA256SUMS",
    "forge614-sentinel-darwin-arm64.tar.gz",
    "forge614-sentinel-darwin-x64.tar.gz",
    "forge614-sentinel-linux-arm64.tar.gz",
    "forge614-sentinel-linux-x64.tar.gz",
    "forge614-sentinel-windows-x64.zip",
    "forge614.node.json",
    "install.mjs",
    "install.ps1",
    "install.sh",
  ]);

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/repos/jotredev/forge614-sentinel/releases/latest") {
        return Response.json({ tag_name: `v${SENTINEL_VERSION}` });
      }
      const prefix = `/repos/jotredev/forge614-sentinel/releases/download/v${SENTINEL_VERSION}/`;
      if (!url.pathname.startsWith(prefix)) return new Response("not found", { status: 404 });
      const name = decodeURIComponent(url.pathname.slice(prefix.length));
      const asset = join(releaseDir, name);
      if (!existsSync(asset)) return new Response("not found", { status: 404 });
      return new Response(readFileSync(asset));
    },
  });

  try {
    const home = join(root, "home");
    const forgeHome = join(home, ".forge614");
    mkdirSync(home, { recursive: true });
    const env = {
      HOME: home,
      FORGE614_HOME: forgeHome,
      FORGE614_INSTALL_TEST_BASE_URL: `http://127.0.0.1:${server.port}`,
    };
    const install = await runAsync(["sh", join(releaseDir, "install.sh"), "--latest"], { cwd: root, env });
    expect(install.exitCode, `${install.stdout}\n${install.stderr}`).toBe(0);

    const installed = join(forgeHome, "sentinel", "bin", "forge614-sentinel");
    expect(existsSync(installed)).toBe(true);
    const version = await runAsync([installed, "--version"], { cwd: root, env });
    expect(version.exitCode, version.stderr).toBe(0);
    expect(version.stdout).toBe(`forge614-sentinel ${SENTINEL_VERSION}\n`);

    const updateLatest = await runAsync([installed, "update", "--json"], { cwd: root, env });
    expect(updateLatest.exitCode, `${updateLatest.stdout}\n${updateLatest.stderr}`).toBe(0);
    expect(JSON.parse(updateLatest.stdout.trim())).toMatchObject({
      schemaVersion: 1,
      updated: false,
      previousVersion: SENTINEL_VERSION,
      installedVersion: SENTINEL_VERSION,
    });

    const updateTarget = await runAsync([installed, "update", "--version", SENTINEL_VERSION, "--json"], { cwd: root, env });
    expect(updateTarget.exitCode, `${updateTarget.stdout}\n${updateTarget.stderr}`).toBe(0);
    expect(JSON.parse(updateTarget.stdout.trim())).toMatchObject({
      schemaVersion: 1,
      updated: false,
      previousVersion: SENTINEL_VERSION,
      installedVersion: SENTINEL_VERSION,
    });

    const uninstall = await runAsync([installed, "uninstall", "--json"], { cwd: root, env });
    expect(uninstall.exitCode, `${uninstall.stdout}\n${uninstall.stderr}`).toBe(0);
    expect(JSON.parse(uninstall.stdout.trim())).toMatchObject({ schemaVersion: 1, result: { removed: true } });
    expect(existsSync(join(forgeHome, "sentinel"))).toBe(false);
    expect(readdirSync(forgeHome)).toEqual([]);
  } finally {
    server.stop(true);
  }
});
