import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync, type Dirent } from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { runCommand } from "./run-command";

const REPOSITORY = "jotredev/forge614-sentinel";

/** Supported actions delegated to the published installer gatekeeper. */
export type InstallerAction = "update" | "uninstall";

/** Process runner used to execute a downloaded gatekeeper; replaceable in tests. */
export type InstallerProcess = (command: string, args: string[], options: { env: Record<string, string> }) => {
  exitCode: number;
  stdout: string;
  stderr: string;
};

/** Inputs shared by update and uninstall installer actions. */
export interface InstallerActionOptions {
  /** Environment passed to the gatekeeper, including temporary HOME values in tests. */
  env?: Record<string, string | undefined>;
  /** Operating system used to select the shell gatekeeper. */
  platform?: string;
  /** HTTP fetch implementation used to download the published gatekeeper. */
  fetcher?: typeof fetch;
  /** Process runner used to execute the downloaded gatekeeper. */
  run?: InstallerProcess;
  /** Executable path of the running Sentinel process; injectable for platform tests. */
  processExecPath?: string;
  /** Schedule deletion of an executable that Windows cannot delete while it is running. */
  scheduleDelete?: (command: string, args: string[]) => void;
}

/** Result returned by a successful self-update. */
export interface UpdateSentinelResult {
  /** Whether the installed version changed. */
  updated: boolean;
  /** Version of the running Sentinel before the installer ran. */
  previousVersion: string;
  /** Version reported by the installed launcher after the installer ran. */
  installedVersion: string;
}

/** Error raised when the published gatekeeper exits with a non-zero status. */
export class InstallerActionError extends Error {
  /** Exit status returned by the gatekeeper process. */
  readonly exitCode: number;

  /** Create an installer action error with the gatekeeper's exit status. */
  constructor(message: string, exitCode: number) {
    super(message);
    this.name = "InstallerActionError";
    this.exitCode = exitCode;
  }
}

/** Read an optional value from an environment map with the current process as fallback. */
function environmentValue(env: Record<string, string | undefined>, key: string): string | undefined {
  return env[key] ?? process.env[key];
}

/** Validate the loopback-only installer base URL and return it without a trailing slash. */
function testBaseUrl(env: Record<string, string | undefined>): string | undefined {
  const value = environmentValue(env, "FORGE614_INSTALL_TEST_BASE_URL");
  if (value === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FORGE614_INSTALL_TEST_BASE_URL only accepts loopback HTTP");
  }
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]", "::1"].includes(url.hostname) || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("FORGE614_INSTALL_TEST_BASE_URL only accepts loopback HTTP");
  }
  return url.origin;
}

/** Return the full URL of the platform's latest published gatekeeper. */
function installerUrl(platform: string, base: string | undefined): string {
  const file = platform === "win32" ? "install.ps1" : "install.sh";
  return base === undefined
    ? `https://github.com/${REPOSITORY}/releases/latest/download/${file}`
    : `${base}/repos/${REPOSITORY}/releases/latest/download/${file}`;
}

/** Resolve the installed Sentinel launcher path for the current operating system. */
function installedLauncher(env: Record<string, string | undefined>, platform: string): string {
  const forgeHome = installationHome(env);
  return join(forgeHome, "sentinel", "bin", `forge614-sentinel${platform === "win32" ? ".exe" : ""}`);
}

/** Resolve the configured Forge614 home used for the cache and installed node. */
function installationHome(env: Record<string, string | undefined>): string {
  return environmentValue(env, "FORGE614_HOME") || join(environmentValue(env, "HOME") || environmentValue(env, "USERPROFILE") || homedir(), ".forge614");
}

/** Compare Windows paths using Windows separators and case-insensitive matching. */
function sameWindowsPath(left: string, right: string): boolean {
  return win32.normalize(left).replaceAll("/", "\\").toLocaleLowerCase("en-US") === win32.normalize(right).replaceAll("/", "\\").toLocaleLowerCase("en-US");
}

/** Park the active installed launcher so the Windows installer can replace or remove its node directory. */
function parkRunningWindowsLauncher(action: InstallerAction, env: Record<string, string | undefined>, processExecPath: string): { original: string; parked: string } | undefined {
  const original = installedLauncher(env, "win32");
  if (!sameWindowsPath(processExecPath, original)) return undefined;
  const parked = action === "update"
    ? `${original}.old-${randomUUID()}`
    : join(installationHome(env), `.forge614-sentinel-old-${randomUUID()}.exe`);
  renameSync(original, parked);
  return { original, parked };
}

/** Best-effort cleanup for old launchers left beside the Windows installation. */
export function cleanupStaleWindowsLaunchers(options: { env?: Record<string, string | undefined>; platform?: string } = {}): void {
  if ((options.platform ?? process.platform) !== "win32") return;
  const directory = dirname(installedLauncher(options.env ?? process.env, "win32"));
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/^forge614-sentinel\.exe\.old-.+$/i.test(entry.name)) continue;
    try { rmSync(join(directory, entry.name), { force: true }); } catch { /* stale launcher cleanup is best-effort */ }
  }
}

/** Schedule deletion of a parked Windows executable after its process has exited. */
function scheduleWindowsLauncherRemoval(file: string, scheduler: (command: string, args: string[]) => void): void {
  const command = `timeout /t 3 /nobreak >nul & del /f /q "${file.replaceAll('"', '""')}"`;
  scheduler("cmd.exe", ["/d", "/c", command]);
}

/** Start the detached Windows command that removes the parked executable. */
function spawnWindowsLauncherRemoval(command: string, args: string[]): void {
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

/** Read the version from the installed launcher, returning the supplied fallback when no launcher is available. */
function readInstalledVersion(env: Record<string, string | undefined>, platform: string, fallback: string): string {
  const launcher = installedLauncher(env, platform);
  const result = runCommand([launcher, "--version"], { env: Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)) });
  const match = result.exitCode === 0 ? /^forge614-sentinel (\d+\.\d+\.\d+)\s*$/.exec(result.stdout) : null;
  return match?.[1] ?? fallback;
}

/** Download and execute the published installer gatekeeper with the requested action. */
export async function runInstallerGate(action: InstallerAction, options: InstallerActionOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const base = testBaseUrl(env);
  const file = platform === "win32" ? "install.ps1" : "install.sh";
  const response = await (options.fetcher ?? fetch)(installerUrl(platform, base));
  if (!response.ok) throw new Error("Could not download the Forge614 Sentinel installer.");
  const directory = mkdtempSync(join(tmpdir(), "forge614-sentinel-installer-"));
  const installer = join(directory, file);
  try {
    writeFileSync(installer, new Uint8Array(await response.arrayBuffer()), { mode: 0o700 });
    chmodSync(installer, 0o700);
    const processEnv = Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    const flag = action === "update" ? "--latest" : "--uninstall";
    const command = platform === "win32" ? "powershell.exe" : "bash";
    const args = platform === "win32" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installer, flag] : [installer, flag];
    const parked = platform === "win32" ? parkRunningWindowsLauncher(action, env, options.processExecPath ?? process.execPath) : undefined;
    try {
      const result = await (options.run ?? ((cmd, argv, runOptions) => runCommand([cmd, ...argv], { env: runOptions.env })))(command, args, { env: processEnv });
      if (result.exitCode !== 0) {
        const detail = result.stderr.trim();
        throw new InstallerActionError(detail || `The Forge614 Sentinel installer exited with code ${result.exitCode}.`, result.exitCode);
      }
    } catch (error) {
      if (parked && !existsSync(parked.original) && existsSync(parked.parked)) {
        try {
          mkdirSync(dirname(parked.original), { recursive: true });
          renameSync(parked.parked, parked.original);
        } catch { /* preserve the installer error if rollback is unavailable */ }
      }
      throw error;
    }
    if (parked && action === "uninstall") {
      try { scheduleWindowsLauncherRemoval(parked.parked, options.scheduleDelete ?? spawnWindowsLauncherRemoval); } catch { /* cleanup is best-effort */ }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Update Sentinel through its published installer and report the installed version. */
export async function updateSentinel(currentVersion: string, options: InstallerActionOptions & {
  /** Optional installed-version reader for deterministic tests. */
  readInstalledVersion?: (env: Record<string, string | undefined>, platform: string, fallback: string) => string;
} = {}): Promise<UpdateSentinelResult> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  await runInstallerGate("update", options);
  const installedVersion = (options.readInstalledVersion ?? readInstalledVersion)(env, platform, currentVersion);
  return { updated: installedVersion !== currentVersion, previousVersion: currentVersion, installedVersion };
}

/** Remove Sentinel through its published installer gatekeeper. */
export async function uninstallSentinel(options: InstallerActionOptions = {}): Promise<void> {
  await runInstallerGate("uninstall", options);
}
