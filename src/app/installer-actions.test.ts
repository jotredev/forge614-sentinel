import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cleanupStaleWindowsLaunchers, runInstallerGate, updateSentinel, uninstallSentinel } from "./installer-actions";
import { updateMain } from "../interfaces/cli/update";
import { uninstallMain } from "../interfaces/cli/uninstall";

/** Run a test action against a loopback server and an isolated user home. */
async function withGateServer<T>(action: (baseUrl: string, requests: string[], home: string) => Promise<T>): Promise<T> {
  const requests: string[] = [];
  const installer = "#!/bin/sh\nexit 0\n";
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(path);
      return path.endsWith("/install.sh") || path.endsWith("/install.ps1") ? new Response(installer) : new Response("missing", { status: 404 });
    },
  });
  const home = mkdtempSync(join(tmpdir(), "sentinel-installer-action-"));
  try {
    return await action(`http://127.0.0.1:${server.port}`, requests, home);
  } finally {
    server.stop(true);
    rmSync(home, { recursive: true, force: true });
  }
}

test("update downloads the loopback gate and runs it with --latest in a temporary environment", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const calls: { command: string; args: string[]; options?: { env?: Record<string, string> } }[] = [];
    await runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: (command, args, options) => {
        calls.push({ command, args, options });
        expect(readFileSync(args[0] ?? "", "utf8")).toBe("#!/bin/sh\nexit 0\n");
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    expect(requests).toEqual(["/repos/jotredev/forge614-sentinel/releases/latest/download/install.sh"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("bash");
    expect(calls[0]?.args[1]).toBe("--latest");
    expect(calls[0]?.options?.env).toMatchObject({ FORGE614_INSTALL_TEST_BASE_URL: baseUrl, FORGE614_HOME: join(home, ".forge614") });
  });
});

test("uninstall downloads the loopback gate and runs it with --uninstall", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    let args: string[] = [];
    await runInstallerGate("uninstall", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: (_command, passedArgs) => {
        args = passedArgs;
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    expect(requests).toHaveLength(1);
    expect(args[1]).toBe("--uninstall");
    const update = await updateSentinel("0.2.1", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: () => ({ exitCode: 0, stdout: "", stderr: "" }),
      readInstalledVersion: () => "0.2.2",
    });
    expect(update).toEqual({ updated: true, previousVersion: "0.2.1", installedVersion: "0.2.2" });
    await uninstallSentinel({
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: (_command, passedArgs) => {
        expect(passedArgs[1]).toBe("--uninstall");
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    expect(requests).toHaveLength(3);
  });
});

test("Windows selects the PowerShell gatekeeper and forwards --latest", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    let call: { command: string; args: string[] } | undefined;
    await runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      run: (command, args) => {
        call = { command, args };
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    expect(requests).toEqual(["/repos/jotredev/forge614-sentinel/releases/latest/download/install.ps1"]);
    expect(call?.command).toBe("powershell.exe");
    expect(call?.args).toEqual(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", expect.any(String), "--latest"]);
  });
});

/** Windows update must move the running launcher before the installer replaces it. */
test("Windows update parks the running launcher beside itself before invoking the gate", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    const launcher = join(home, ".forge614", "sentinel", "bin", "forge614-sentinel.exe");
    mkdirSync(dirname(launcher), { recursive: true });
    writeFileSync(launcher, "running launcher");
    await runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      processExecPath: launcher,
      run: () => {
        expect(existsSync(launcher)).toBe(false);
        expect(readdirSync(dirname(launcher)).some((name) => name.startsWith("forge614-sentinel.exe.old-"))).toBe(true);
        writeFileSync(launcher, "replacement launcher");
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    } as Parameters<typeof runInstallerGate>[1]);
    expect(readFileSync(launcher, "utf8")).toBe("replacement launcher");
    expect(readdirSync(dirname(launcher)).some((name) => name.startsWith("forge614-sentinel.exe.old-"))).toBe(true);
  });
});

/** Windows uninstall must move the running executable outside the node folder before removal. */
test("Windows uninstall moves its launcher outside the node tree and schedules delayed deletion", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    const forgeHome = join(home, ".forge614");
    const launcher = join(forgeHome, "sentinel", "bin", "forge614-sentinel.exe");
    mkdirSync(dirname(launcher), { recursive: true });
    writeFileSync(launcher, "running launcher");
    let scheduled: { command: string; args: string[] } | undefined;
    await runInstallerGate("uninstall", {
      env: { HOME: home, FORGE614_HOME: forgeHome, FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      processExecPath: launcher,
      scheduleDelete: (command: string, args: string[]) => { scheduled = { command, args }; },
      run: () => {
        expect(existsSync(launcher)).toBe(false);
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    } as Parameters<typeof runInstallerGate>[1]);
    expect(existsSync(launcher)).toBe(false);
    expect(scheduled?.command).toBe("cmd.exe");
    expect(scheduled?.args.slice(0, 2)).toEqual(["/d", "/c"]);
    expect(scheduled?.args[2]).toContain("timeout /t");
    expect(scheduled?.args[2]).toContain("del /f /q");
    const parked = readdirSync(forgeHome).find((name) => /^\.forge614-sentinel-old-.*\.exe$/i.test(name));
    expect(parked).toBeDefined();
    expect(existsSync(join(forgeHome, parked ?? ""))).toBe(true);
  });
});

/** A failed Windows uninstall must restore the launcher and avoid scheduling deletion. */
test("Windows uninstall restores its launcher when the gate fails", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    const forgeHome = join(home, ".forge614");
    const launcher = join(forgeHome, "sentinel", "bin", "forge614-sentinel.exe");
    mkdirSync(dirname(launcher), { recursive: true });
    writeFileSync(launcher, "running launcher");
    let scheduled = false;
    await expect(runInstallerGate("uninstall", {
      env: { HOME: home, FORGE614_HOME: forgeHome, FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      processExecPath: launcher,
      scheduleDelete: () => { scheduled = true; },
      run: () => ({ exitCode: 1, stdout: "", stderr: "failed" }),
    } as Parameters<typeof runInstallerGate>[1])).rejects.toMatchObject({ exitCode: 1 });
    expect(readFileSync(launcher, "utf8")).toBe("running launcher");
    expect(scheduled).toBe(false);
  });
});

/** Startup cleanup removes old parked Windows launchers without touching other files. */
test("Windows startup cleanup removes stale parked launchers best-effort", () => {
  const home = mkdtempSync(join(tmpdir(), "sentinel-installer-cleanup-"));
  const forgeHome = join(home, ".forge614");
  const directory = join(forgeHome, "sentinel", "bin");
  mkdirSync(directory, { recursive: true });
  const stale = join(directory, "forge614-sentinel.exe.old-abc123");
  const current = join(directory, "forge614-sentinel.exe");
  writeFileSync(stale, "old");
  writeFileSync(current, "current");
  cleanupStaleWindowsLaunchers({ env: { HOME: home, FORGE614_HOME: forgeHome }, platform: "win32" });
  expect(existsSync(stale)).toBe(false);
  expect(existsSync(current)).toBe(true);
  rmSync(home, { recursive: true, force: true });
});

test("an interrupted uninstall gate preserves exit code 130", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    await expect(runInstallerGate("uninstall", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: () => ({ exitCode: 130, stdout: "", stderr: "cancelled" }),
    })).rejects.toMatchObject({ exitCode: 130 });
  });
});

test("the installer test base rejects non-loopback or non-http URLs before requesting them", async () => {
  await expect(runInstallerGate("update", {
    env: { FORGE614_INSTALL_TEST_BASE_URL: "http://example.com" },
    platform: "darwin",
    run: () => ({ exitCode: 0, stdout: "", stderr: "" }),
  })).rejects.toThrow("FORGE614_INSTALL_TEST_BASE_URL only accepts loopback HTTP");
});

test("update --json reports the result after invoking the local published gate", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const env = { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl };
    const binDir = join(env.FORGE614_HOME, "sentinel", "bin");
    mkdirSync(binDir, { recursive: true });
    const launcher = join(binDir, "forge614-sentinel");
    writeFileSync(launcher, "#!/bin/sh\necho 'forge614-sentinel 0.2.1'\n");
    chmodSync(launcher, 0o755);
    const code = await updateMain(["--json"], env, { writeLine: (line) => stdout.push(line), writeError: (line) => stderr.push(line) });
    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0] ?? "")).toEqual({ schemaVersion: 1, updated: false, previousVersion: "0.2.1", installedVersion: "0.2.1" });
    expect(requests).toEqual(["/repos/jotredev/forge614-sentinel/releases/latest/download/install.sh"]);
  });
});

test("uninstall --json reports removal after invoking the local published gate", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const env = { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl };
    const code = await uninstallMain(["--json"], env, { writeLine: (line) => stdout.push(line), writeError: (line) => stderr.push(line) });
    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0] ?? "")).toEqual({ schemaVersion: 1, result: { removed: true } });
    expect(requests).toEqual(["/repos/jotredev/forge614-sentinel/releases/latest/download/install.sh"]);
  });
});
