import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cleanupStaleWindowsLaunchers, runInstallerGate, updateSentinel, uninstallSentinel } from "./installer-actions";
import { updateMain } from "../interfaces/cli/update";
import { uninstallMain } from "../interfaces/cli/uninstall";

/** Run a test action against a loopback server and an isolated user home. */
async function withGateServer<T>(action: (baseUrl: string, requests: string[], home: string) => Promise<T>, installerScript = "#!/bin/sh\nexit 0\n", checksumContent?: string): Promise<T> {
  const requests: string[] = [];
  const installerHash = createHash("sha256").update(installerScript).digest("hex");
  const sums = checksumContent ?? `${installerHash}  install.sh\n${installerHash}  install.ps1\n`;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(path);
      if (path.endsWith("/releases/latest")) return Response.json({ tag_name: "v0.2.1" });
      if (path.endsWith("/SHA256SUMS")) return new Response(sums);
      return path.endsWith("/install.sh") || path.endsWith("/install.ps1") ? new Response(installerScript) : new Response("missing", { status: 404 });
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

/** Expected request sequence for a latest-release gate and its checksum. */
function latestGateRequests(file: string): string[] {
  return [
    "/repos/jotredev/forge614-sentinel/releases/latest",
    `/repos/jotredev/forge614-sentinel/releases/download/v0.2.1/${file}`,
    "/repos/jotredev/forge614-sentinel/releases/download/v0.2.1/SHA256SUMS",
  ];
}

/** Expected request sequence for a version-targeted gate and its checksum. */
function taggedGateRequests(tag: string, file: string): string[] {
  return [
    `/repos/jotredev/forge614-sentinel/releases/download/${tag}/${file}`,
    `/repos/jotredev/forge614-sentinel/releases/download/${tag}/SHA256SUMS`,
  ];
}

test("latest update pins the resolved release tag when invoking the loopback gate", async () => {
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
    expect(requests).toEqual(latestGateRequests("install.sh"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("sh");
    expect(calls[0]?.args).toEqual([expect.any(String), "--version", "v0.2.1"]);
    expect(calls[0]?.options?.env).toMatchObject({ FORGE614_INSTALL_TEST_BASE_URL: baseUrl, FORGE614_HOME: join(home, ".forge614") });
  });
});

/** A version-targeted update downloads that release's gate and forwards its v-prefixed tag. */
test("version-targeted update downloads the requested release and forwards --version", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    let call: { command: string; args: string[] } | undefined;
    await runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      versionTag: "v0.2.0",
      run: (command, args) => {
        call = { command, args };
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    } as Parameters<typeof runInstallerGate>[1]);
    expect(requests).toEqual(taggedGateRequests("v0.2.0", "install.sh"));
    expect(call?.args).toEqual([expect.any(String), "--version", "v0.2.0"]);
  });
});

/** A downloaded gatekeeper with a mismatched checksum is rejected before execution. */
test("a gatekeeper checksum mismatch prevents execution and exits with code 1", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    let executed = false;
    await expect(runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: () => { executed = true; return { exitCode: 0, stdout: "", stderr: "" }; },
    })).rejects.toMatchObject({ exitCode: 1 });
    expect(executed).toBe(false);
  }, "#!/bin/sh\nexit 0\n", `${"0".repeat(64)}  install.sh\n`);
});

/** A downloaded gatekeeper without a checksum entry is rejected before execution. */
test("a missing gatekeeper checksum entry prevents execution and exits with code 1", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    let executed = false;
    await expect(runInstallerGate("uninstall", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "darwin",
      run: () => { executed = true; return { exitCode: 0, stdout: "", stderr: "" }; },
    })).rejects.toMatchObject({ exitCode: 1 });
    expect(executed).toBe(false);
  }, "#!/bin/sh\nexit 0\n", `${"0".repeat(64)}  install.ps1\n`);
});

/** Gatekeeper manifests reject non-canonical GNU lines and repeated entries before execution. */
test("strict SHA256SUMS rejects malformed and duplicate gatekeeper lines", async () => {
  const hash = createHash("sha256").update("#!/bin/sh\nexit 0\n").digest("hex");
  const malformed = [
    `${hash.toUpperCase()}  install.sh\n`,
    `${hash} *install.sh\n`,
    `${hash} install.sh\n`,
    `${hash}  install.sh\n${hash}  install.sh\n`,
    `${hash}  install.sh\nmalformed manifest line\n`,
  ];
  for (const sums of malformed) {
    await withGateServer(async (baseUrl, _requests, home) => {
      let executed = false;
      await expect(runInstallerGate("update", {
        env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
        platform: "darwin",
        run: () => { executed = true; return { exitCode: 0, stdout: "", stderr: "" }; },
      })).rejects.toMatchObject({ exitCode: 1 });
      expect(executed).toBe(false);
    }, "#!/bin/sh\nexit 0\n", sums);
  }
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
    expect(requests).toEqual(latestGateRequests("install.sh"));
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
    expect(requests).toEqual([...latestGateRequests("install.sh"), ...latestGateRequests("install.sh"), ...latestGateRequests("install.sh")]);
  });
});

test("Windows latest update forwards the resolved release tag to PowerShell", async () => {
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
    expect(requests).toEqual(latestGateRequests("install.ps1"));
    expect(call?.command).toBe("powershell.exe");
    expect(call?.args).toEqual(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", expect.any(String), "--version", "v0.2.1"]);
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

/** Windows launcher matching resolves a symlink alias before comparing executable paths. */
test("Windows update recognizes a process executable path that resolves to the installed launcher", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    const launcher = join(home, ".forge614", "sentinel", "bin", "forge614-sentinel.exe");
    const alias = join(home, "launcher-alias.exe");
    mkdirSync(dirname(launcher), { recursive: true });
    writeFileSync(launcher, "running launcher");
    symlinkSync(launcher, alias);
    await runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      processExecPath: alias,
      run: () => {
        expect(existsSync(launcher)).toBe(false);
        expect(readdirSync(dirname(launcher)).some((name) => name.startsWith("forge614-sentinel.exe.old-"))).toBe(true);
        return { exitCode: 0, stdout: "already up to date", stderr: "" };
      },
    } as Parameters<typeof runInstallerGate>[1]);
    expect(readFileSync(launcher, "utf8")).toBe("running launcher");
  });
});

/** A successful no-op Windows update restores the parked launcher when no replacement was written. */
test("Windows update restores the launcher after a successful gate that writes no replacement", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    const launcher = join(home, ".forge614", "sentinel", "bin", "forge614-sentinel.exe");
    mkdirSync(dirname(launcher), { recursive: true });
    writeFileSync(launcher, "running launcher");
    await runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      processExecPath: launcher,
      run: () => ({ exitCode: 0, stdout: "already up to date", stderr: "" }),
    } as Parameters<typeof runInstallerGate>[1]);
    expect(readFileSync(launcher, "utf8")).toBe("running launcher");
    expect(readdirSync(dirname(launcher)).some((name) => name.startsWith("forge614-sentinel.exe.old-"))).toBe(false);
  });
});

/** A Windows update signal restores the launcher while the gatekeeper is still running. */
test("Windows update restores its launcher when interrupted while the gate runs", async () => {
  for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) {
    await withGateServer(async (baseUrl, _requests, home) => {
      const launcher = join(home, ".forge614", "sentinel", "bin", "forge614-sentinel.exe");
      mkdirSync(dirname(launcher), { recursive: true });
      writeFileSync(launcher, "running launcher");
      await runInstallerGate("update", {
        env: { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
        platform: "win32",
        processExecPath: launcher,
        run: async (_command, _args, options) => {
          let stopped = false;
          (options as { onStarted?: (stop: () => void) => void }).onStarted?.(() => { stopped = true; });
          await new Promise((resolve) => setTimeout(resolve, 5));
          process.emit(signal);
          expect(stopped, signal).toBe(true);
          expect(readFileSync(launcher, "utf8"), signal).toBe("running launcher");
          return { exitCode: 0, stdout: "interrupted", stderr: "" };
        },
      } as Parameters<typeof runInstallerGate>[1]);
    });
  }
});

/** Windows uninstall must move the running executable outside the node folder before removal. */
test("Windows uninstall moves its launcher outside the node tree and schedules delayed deletion", async () => {
  await withGateServer(async (baseUrl, _requests, home) => {
    const forgeHome = join(home, ".forge614");
    const launcher = join(forgeHome, "sentinel", "bin", "forge614-sentinel.exe");
    mkdirSync(dirname(launcher), { recursive: true });
    writeFileSync(launcher, "running launcher");
    let scheduled: { command: string; args: string[]; options: { env: Record<string, string>; detached: boolean; stdio: string; windowsHide: boolean } } | undefined;
    await runInstallerGate("uninstall", {
      env: { HOME: home, FORGE614_HOME: forgeHome, FORGE614_INSTALL_TEST_BASE_URL: baseUrl },
      platform: "win32",
      processExecPath: launcher,
      processId: 4321,
      scheduleDelete: (command: string, args: string[], options: { env: Record<string, string>; detached: boolean; stdio: "ignore"; windowsHide: boolean }) => { scheduled = { command, args, options }; },
      run: () => {
        expect(existsSync(launcher)).toBe(false);
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    } as Parameters<typeof runInstallerGate>[1]);
    expect(existsSync(launcher)).toBe(false);
    const parked = readdirSync(forgeHome).find((name) => /^\.forge614-sentinel-old-.*\.exe$/i.test(name));
    expect(parked).toBeDefined();
    const parkedPath = join(forgeHome, parked ?? "");
    expect(existsSync(parkedPath)).toBe(true);
    expect(scheduled?.command).toBe("powershell.exe");
    expect(scheduled?.args.slice(0, 5)).toEqual(["-NoProfile", "-ExecutionPolicy", "Bypass", "-NonInteractive", "-EncodedCommand"]);
    const encoded = scheduled?.args[5] ?? "";
    const script = Buffer.from(encoded, "base64").toString("utf16le");
    expect(script).toContain("Wait-Process -Id 4321 -Timeout 30");
    expect(script).toContain("$env:FORGE614_SENTINEL_PARKED");
    expect(script).toContain("Remove-Item -LiteralPath $env:FORGE614_SENTINEL_PARKED -Force -ErrorAction SilentlyContinue");
    expect(script).not.toContain(parkedPath);
    expect(scheduled?.args).toHaveLength(6);
    expect(scheduled?.options).toMatchObject({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { FORGE614_SENTINEL_PARKED: parkedPath },
    });
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
  const staleUninstall = join(forgeHome, ".forge614-sentinel-old-abc123.exe");
  const current = join(directory, "forge614-sentinel.exe");
  writeFileSync(stale, "old");
  writeFileSync(staleUninstall, "old uninstall launcher");
  writeFileSync(current, "current");
  cleanupStaleWindowsLaunchers({ env: { HOME: home, FORGE614_HOME: forgeHome }, platform: "win32" });
  expect(existsSync(stale)).toBe(false);
  expect(existsSync(staleUninstall)).toBe(false);
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
    expect(code, stderr.join("\n")).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0] ?? "")).toEqual({ schemaVersion: 1, updated: false, previousVersion: "0.2.1", installedVersion: "0.2.1" });
    expect(requests).toEqual(latestGateRequests("install.sh"));
  });
});

/** The public update command targets a release when --version is supplied. */
test("update --version X.Y.Z downloads that release and returns JSON", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const env = { HOME: home, FORGE614_HOME: join(home, ".forge614"), FORGE614_INSTALL_TEST_BASE_URL: baseUrl };
    const binDirectory = join(env.FORGE614_HOME, "sentinel", "bin");
    mkdirSync(binDirectory, { recursive: true });
    const launcher = join(binDirectory, "forge614-sentinel");
    writeFileSync(launcher, "#!/bin/sh\necho 'forge614-sentinel 0.2.1'\n");
    chmodSync(launcher, 0o755);
    const code = await updateMain(["--version", "0.2.0", "--json"], {
      ...env,
    }, { writeLine: (line) => stdout.push(line), writeError: (line) => stderr.push(line) });
    expect(code, stderr.join("\n")).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({ schemaVersion: 1, updated: false, previousVersion: "0.2.1" });
    expect(requests).toEqual(taggedGateRequests("v0.2.0", "install.sh"));
  });
});

/** The public update command rejects non-SemVer targets without contacting the server. */
test("update --version rejects a non-SemVer target", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await updateMain(["--version", "not-a-version", "--json"], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
    }, { writeLine: (line) => stdout.push(line), writeError: (line) => stderr.push(line) });
    expect(code).toBe(2);
    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr[0] ?? "")).toMatchObject({ code: "INVALID_ARGUMENTS" });
    expect(requests).toEqual([]);
  });
});

/** The update error preserves the gatekeeper's first useful line without exposing paths or traces. */
test("update --json includes the first non-empty gatekeeper error line only", async () => {
  const message = "Forge614 requires Node.js 22.19.0 or later to install.";
  await withGateServer(async (baseUrl, _requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await updateMain(["--json"], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
      FORGE614_LOCALE: "en",
    }, { writeLine: (line) => stdout.push(line), writeError: (line) => stderr.push(line) });
    expect(code).toBe(1);
    expect(stdout).toEqual([]);
    const error = JSON.parse(stderr[0] ?? "");
    expect(error).toMatchObject({ schemaVersion: 1, code: "UPDATE_FAILED" });
    expect(error.error).toContain(message);
    expect(error.error).not.toContain(home);
    expect(error.error).not.toContain("at file:");
  }, `#!/bin/sh\necho >&2\necho '${message}' >&2\necho '    at file:///tmp/private/install.mjs' >&2\nexit 65\n`);
});

/** Installer diagnostics keep URLs intact and replace literal home, temp, and UNC paths. */
test("installer diagnostics preserve URLs and sanitize literal paths including spaces and UNC roots", async () => {
  await withGateServer(async (baseUrl, _requests, root) => {
    const home = join(root, "Forge614 home", "Jorge Trejo");
    const temp = join(root, "Forge614 temp", "Installer cache");
    const unc = "\\\\server\\share\\Users\\Jorge Trejo";
    const stderr = `No se pudo instalar Node.js desde https://nodejs.org; home=${home}; temp=${temp}; perfil=${unc}`;
    let failure: unknown;
    try {
      await runInstallerGate("update", {
      env: {
        HOME: home,
        USERPROFILE: unc,
        FORGE614_HOME: join(home, ".forge614"),
        TMPDIR: temp,
        FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
      },
      platform: "win32",
      run: () => ({ exitCode: 1, stdout: "", stderr }),
      });
    } catch (error) {
      failure = error;
    }
    const message = failure instanceof Error ? failure.message : String(failure);
    expect(failure).toMatchObject({ exitCode: 1 });
    expect(message).toContain("No se pudo instalar Node.js desde https://nodejs.org;");
    expect(message).toContain("<home>");
    expect(message).toContain("<tmp>");
    expect(message).not.toContain(home);
    expect(message).not.toContain(temp);
    expect(message).not.toContain("Jorge Trejo");
    expect(message).not.toContain("\\\\server\\share");
  });
});

/** A missing targeted release includes its tag and HTTP status in the installer error. */
test("a missing release download reports the requested tag and HTTP status", async () => {
  await withGateServer(async (_baseUrl, _requests, home) => {
    let executed = false;
    await expect(runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614") },
      platform: "darwin",
      versionTag: "v9.9.9",
      fetcher: Object.assign(async () => new Response("missing", { status: 404 }), { preconnect: () => {} }),
      run: () => { executed = true; return { exitCode: 0, stdout: "", stderr: "" }; },
    })).rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining("release v9.9.9 not found (HTTP 404)") });
    expect(executed).toBe(false);
  });
});

/** A checksum-manifest download failure reports its HTTP status and never runs the gatekeeper. */
test("a SHA256SUMS download failure includes its HTTP status and prevents execution", async () => {
  await withGateServer(async (_baseUrl, _requests, home) => {
    let requests = 0;
    let executed = false;
    const bytes = new TextEncoder().encode("#!/bin/sh\nexit 0\n");
    await expect(runInstallerGate("update", {
      env: { HOME: home, FORGE614_HOME: join(home, ".forge614") },
      platform: "darwin",
      versionTag: "v0.2.1",
      fetcher: Object.assign(async () => {
        requests += 1;
        return requests === 1 ? new Response(bytes) : new Response("missing", { status: 503 });
      }, { preconnect: () => {} }),
      run: () => { executed = true; return { exitCode: 0, stdout: "", stderr: "" }; },
    })).rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining("SHA256SUMS for release v0.2.1 (HTTP 503)") });
    expect(requests).toBe(2);
    expect(executed).toBe(false);
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
    expect(requests).toEqual(latestGateRequests("install.sh"));
  });
});

/** A terminal uninstall cancellation exits 130 without contacting the installer. */
test("interactive uninstall cancellation returns 130 without downloading the gate", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const prompts: string[] = [];
    const code = await uninstallMain([], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
    }, {
      writeLine: () => {},
      writeError: () => {},
      isTerminal: () => true,
      confirm: async (prompt: string) => { prompts.push(prompt); return "n"; },
    } as Parameters<typeof uninstallMain>[2]);
    expect(code).toBe(130);
    expect(prompts).toEqual(["¿Desinstalar forge614-sentinel? [s/N]"]);
    expect(requests).toEqual([]);
  });
});

/** Ctrl+C and Ctrl+D confirmation aborts are cancellations, not CLI failures. */
test("interactive uninstall maps AbortError to cancellation without output or installer requests", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await uninstallMain([], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
    }, {
      writeLine: (line) => stdout.push(line),
      writeError: (line) => stderr.push(line),
      isTerminal: () => true,
      confirm: async () => { throw new DOMException("prompt aborted", "AbortError"); },
    });
    expect(code).toBe(130);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([]);
    expect(requests).toEqual([]);
  });
});

/** Interactive uninstall proceeds only after a positive Spanish or English confirmation. */
test("interactive uninstall accepts y and invokes the published gate", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    const prompts: string[] = [];
    const code = await uninstallMain([], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
    }, {
      writeLine: () => {},
      writeError: () => {},
      isTerminal: () => true,
      confirm: async (prompt: string) => { prompts.push(prompt); return "y"; },
    } as Parameters<typeof uninstallMain>[2]);
    expect(code).toBe(0);
    expect(prompts).toEqual(["¿Desinstalar forge614-sentinel? [s/N]"]);
    expect(requests).toEqual(latestGateRequests("install.sh"));
  });
});

/** JSON uninstall stays non-interactive even when the process has a terminal. */
test("JSON uninstall does not request terminal confirmation", async () => {
  await withGateServer(async (baseUrl, requests, home) => {
    let prompts = 0;
    const code = await uninstallMain(["--json"], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
    }, {
      writeLine: () => {},
      writeError: () => {},
      isTerminal: () => true,
      confirm: async () => { prompts += 1; return "n"; },
    } as Parameters<typeof uninstallMain>[2]);
    expect(code).toBe(0);
    expect(prompts).toBe(0);
    expect(requests).toEqual(latestGateRequests("install.sh"));
  });
});

/** `uninstall --self` never asks for confirmation, even with a terminal. */
test("uninstall --self never requests terminal confirmation", async () => {
  let prompts = 0;
  const stdout: string[] = [];
  const code = await uninstallMain(["--self"], {}, {
    writeLine: (line) => stdout.push(line),
    writeError: () => {},
    isTerminal: () => true,
    confirm: async () => { prompts += 1; return "n"; },
  });
  expect(code).toBe(0);
  expect(prompts).toBe(0);
  expect(stdout[0]).toContain("no tiene integraciones");
});

/** The uninstall error preserves a localized gatekeeper message without exposing its temporary trace. */
test("uninstall --json includes the first non-empty gatekeeper error line only", async () => {
  const message = "Forge614 requires Node.js 22.19.0 or later to install.";
  await withGateServer(async (baseUrl, _requests, home) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await uninstallMain(["--json"], {
      HOME: home,
      FORGE614_HOME: join(home, ".forge614"),
      FORGE614_INSTALL_TEST_BASE_URL: baseUrl,
      FORGE614_LOCALE: "en",
    }, { writeLine: (line) => stdout.push(line), writeError: (line) => stderr.push(line) });
    expect(code).toBe(1);
    expect(stdout).toEqual([]);
    const error = JSON.parse(stderr[0] ?? "");
    expect(error).toMatchObject({ schemaVersion: 1, code: "UNINSTALL_FAILED" });
    expect(error.error).toContain(message);
    expect(error.error).not.toContain(home);
    expect(error.error).not.toContain("at file:");
  }, `#!/bin/sh\necho >&2\necho '${message}' >&2\necho '    at file:///tmp/private/install.mjs' >&2\nexit 65\n`);
});
