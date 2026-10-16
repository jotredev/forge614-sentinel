import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync, type Dirent } from "node:fs";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
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
  /** Process ID of the running Sentinel process; injectable for platform tests. */
  processId?: number;
  /** Schedule deletion of an executable that Windows cannot delete while it is running. */
  scheduleDelete?: (command: string, args: string[], options: { env: Record<string, string>; detached: true; stdio: "ignore"; windowsHide: true }) => void;
  /** Optional release tag to use for a version-targeted update. */
  versionTag?: string;
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

/** Return the GitHub API URL used to select the latest stable release once. */
function latestReleaseUrl(base: string | undefined): string {
  return base === undefined
    ? `https://api.github.com/repos/${REPOSITORY}/releases/latest`
    : `${base}/repos/${REPOSITORY}/releases/latest`;
}

/** Return the asset URL for a specific release tag. */
function releaseAssetUrl(base: string | undefined, tag: string, name: string): string {
  const releasePath = `releases/download/${encodeURIComponent(tag)}/${name}`;
  return base === undefined
    ? `https://github.com/${REPOSITORY}/${releasePath}`
    : `${base}/repos/${REPOSITORY}/${releasePath}`;
}

/** Replace literal path values without changing URL text. */
function sanitizeInstallerDetail(detail: string, env: Record<string, string | undefined>, platform: string): string {
  const insensitive = platform === "win32";
  const paths = [
    ...["FORGE614_HOME", "HOME", "USERPROFILE"].map((key) => ({ value: environmentValue(env, key), marker: "<home>" })),
    ...["TMPDIR", "TEMP", "TMP"].map((key) => ({ value: environmentValue(env, key), marker: "<tmp>" })),
  ].filter((entry): entry is { value: string; marker: string } => Boolean(entry.value))
    .sort((left, right) => right.value.length - left.value.length);
  const urls = new Map<string, string>();
  let sanitized = detail.replace(/https?:\/\/[^\s]+/gi, (url) => {
    const token = `__FORGE614_PRESERVED_URL_${randomUUID()}__`;
    urls.set(token, url);
    return token;
  });
  for (const { value, marker } of paths) sanitized = replaceLiteral(sanitized, value, marker, insensitive);
  return sanitized.replace(/__FORGE614_PRESERVED_URL_[0-9a-f-]+__/g, (token) => urls.get(token) ?? token);
}

/** Replace every exact occurrence using the selected platform's path case rules. */
function replaceLiteral(source: string, search: string, replacement: string, insensitive: boolean): string {
  const haystack = insensitive ? source.toLocaleLowerCase("en-US") : source;
  const needle = insensitive ? search.toLocaleLowerCase("en-US") : search;
  let cursor = 0;
  let result = "";
  while (cursor < source.length) {
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) return result + source.slice(cursor);
    result += source.slice(cursor, index) + replacement;
    cursor = index + search.length;
  }
  return result;
}

/** Raise an action error whose detail is safe to return to the CLI. */
function actionFailure(detail: string, env: Record<string, string | undefined>, platform: string): InstallerActionError {
  return new InstallerActionError(sanitizeInstallerDetail(detail, env, platform), 1);
}

/** Fetch an asset while converting network exceptions into a safe action error. */
async function fetchReleaseResponse(fetcher: typeof fetch, url: string, env: Record<string, string | undefined>, platform: string): Promise<Response> {
  try {
    return await fetcher(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network error";
    throw actionFailure(detail, env, platform);
  }
}

/** Resolve the selected release tag before downloading any of its assets. */
async function selectedReleaseTag(base: string | undefined, versionTag: string | undefined, fetcher: typeof fetch, env: Record<string, string | undefined>, platform: string): Promise<string> {
  if (versionTag !== undefined) return versionTag;
  const response = await fetchReleaseResponse(fetcher, latestReleaseUrl(base), env, platform);
  if (!response.ok) throw actionFailure(`Could not resolve the latest Forge614 Sentinel release (HTTP ${response.status}).`, env, platform);
  let tag: unknown;
  try { tag = (await response.json() as { tag_name?: unknown }).tag_name; } catch { tag = undefined; }
  if (typeof tag !== "string" || !/^v?\d+\.\d+\.\d+$/.test(tag)) throw actionFailure("The latest Forge614 Sentinel release has an invalid tag.", env, platform);
  return tag.startsWith("v") ? tag : `v${tag}`;
}

/** Verify the selected gatekeeper bytes against the matching SHA256SUMS entry. */
function verifyGatekeeperChecksum(file: string, bytes: Uint8Array, sums: string): void {
  const entries = sums.split(/\r?\n/).map((line) => /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(line)).filter((match) => match?.[2] === file);
  if (entries.length !== 1 || entries[0]?.[1] === undefined) throw new InstallerActionError(`SHA256SUMS has no unique entry for ${file}.`, 1);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== entries[0][1].toLowerCase()) throw new InstallerActionError(`SHA-256 verification failed for ${file}.`, 1);
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

/** Resolve path aliases when possible, then compare Windows paths case-insensitively. */
function sameWindowsPath(left: string, right: string): boolean {
  let resolvedLeft = left;
  let resolvedRight = right;
  try {
    resolvedLeft = realpathSync.native(left);
    resolvedRight = realpathSync.native(right);
  } catch { /* fall back to normalized paths when either path cannot be resolved */ }
  const normalizedLeft = win32.normalize(resolvedLeft).replaceAll("/", "\\").toLocaleLowerCase("en-US");
  const normalizedRight = win32.normalize(resolvedRight).replaceAll("/", "\\").toLocaleLowerCase("en-US");
  return normalizedLeft === normalizedRight;
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

/** Restore an update's parked launcher only when the installer did not create a replacement. */
function restoreParkedWindowsLauncher(parked: { original: string; parked: string } | undefined): void {
  if (!parked || existsSync(parked.original) || !existsSync(parked.parked)) return;
  try {
    mkdirSync(dirname(parked.original), { recursive: true });
    renameSync(parked.parked, parked.original);
  } catch { /* preserve the gatekeeper result if rollback is unavailable */ }
}

/** Best-effort cleanup for old launchers left beside the Windows installation. */
export function cleanupStaleWindowsLaunchers(options: { env?: Record<string, string | undefined>; platform?: string } = {}): void {
  if ((options.platform ?? process.platform) !== "win32") return;
  const env = options.env ?? process.env;
  const directories = [dirname(installedLauncher(env, "win32")), installationHome(env)];
  for (const directory of directories) {
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const stale = directory === installationHome(env)
        ? /^\.forge614-sentinel-old-.+\.exe$/i.test(entry.name)
        : /^forge614-sentinel\.exe\.old-.+$/i.test(entry.name);
      if (!entry.isFile() || !stale) continue;
      try { rmSync(join(directory, entry.name), { force: true }); } catch { /* stale launcher cleanup is best-effort */ }
    }
  }
}

/** Schedule deletion after Sentinel exits, keeping the parked path in the child environment. */
function scheduleWindowsLauncherRemoval(
  file: string,
  processId: number,
  env: Record<string, string | undefined>,
  scheduler: (command: string, args: string[], options: { env: Record<string, string>; detached: true; stdio: "ignore"; windowsHide: true }) => void,
): void {
  const script = `try { Wait-Process -Id ${processId} -Timeout 30 -ErrorAction SilentlyContinue } catch {}; Remove-Item -LiteralPath $env:FORGE614_SENTINEL_PARKED -Force -ErrorAction SilentlyContinue`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const childEnv = Object.fromEntries(Object.entries({ ...process.env, ...env, FORGE614_SENTINEL_PARKED: file }).filter((entry): entry is [string, string] => entry[1] !== undefined));
  scheduler("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-NonInteractive", "-EncodedCommand", encoded], {
    env: childEnv,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
}

/** Start the detached PowerShell process that removes the parked executable. */
function spawnWindowsLauncherRemoval(
  command: string,
  args: string[],
  options: { env: Record<string, string>; detached: true; stdio: "ignore"; windowsHide: true },
): void {
  const child = spawn(command, args, options);
  child.unref();
}

/** Keep the first useful gatekeeper message while replacing absolute paths with a marker. */
function firstSafeInstallerErrorLine(stderr: string, env: Record<string, string | undefined>, platform: string): string | undefined {
  const line = stderr.split(/\r?\n/).map((entry) => entry.trim()).find((entry) => entry.length > 0);
  return line === undefined ? undefined : sanitizeInstallerDetail(line, env, platform);
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
  const fetcher = options.fetcher ?? fetch;
  const tag = await selectedReleaseTag(base, action === "update" ? options.versionTag : undefined, fetcher, env, platform);
  const installerResponse = await fetchReleaseResponse(fetcher, releaseAssetUrl(base, tag, file), env, platform);
  if (!installerResponse.ok) {
    const detail = installerResponse.status === 404
      ? `release ${tag} not found (HTTP 404)`
      : `Could not download the Forge614 Sentinel installer for release ${tag} (HTTP ${installerResponse.status}).`;
    throw actionFailure(detail, env, platform);
  }
  let installerBytes: Uint8Array;
  try {
    installerBytes = new Uint8Array(await installerResponse.arrayBuffer());
  } catch (error) {
    throw actionFailure(error instanceof Error ? error.message : "installer download failed", env, platform);
  }
  const checksumResponse = await fetchReleaseResponse(fetcher, releaseAssetUrl(base, tag, "SHA256SUMS"), env, platform);
  if (!checksumResponse.ok) throw actionFailure(`Could not download SHA256SUMS for release ${tag} (HTTP ${checksumResponse.status}).`, env, platform);
  let sums: string;
  try { sums = await checksumResponse.text(); } catch (error) {
    throw actionFailure(error instanceof Error ? error.message : "SHA256SUMS download failed", env, platform);
  }
  verifyGatekeeperChecksum(file, installerBytes, sums);
  const directory = mkdtempSync(join(tmpdir(), "forge614-sentinel-installer-"));
  const installer = join(directory, file);
  try {
    writeFileSync(installer, installerBytes, { mode: 0o700 });
    chmodSync(installer, 0o700);
    const processEnv = Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    const flag = action === "update" ? (options.versionTag === undefined ? "--latest" : "--version") : "--uninstall";
    const command = platform === "win32" ? "powershell.exe" : "sh";
    const actionArgs = options.versionTag === undefined ? [flag] : [flag, options.versionTag];
    const args = platform === "win32" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installer, ...actionArgs] : [installer, ...actionArgs];
    const parked = platform === "win32" ? parkRunningWindowsLauncher(action, env, options.processExecPath ?? process.execPath) : undefined;
    const updateParked = action === "update" ? parked : undefined;
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", ...(platform === "win32" ? ["SIGBREAK" as const] : [])];
    const restoreOnSignal = () => restoreParkedWindowsLauncher(updateParked);
    if (updateParked) for (const signal of signals) process.on(signal, restoreOnSignal);
    try {
      const result = await (options.run ?? ((cmd, argv, runOptions) => runCommand([cmd, ...argv], { env: runOptions.env })))(command, args, { env: processEnv });
      if (result.exitCode !== 0) {
        const detail = firstSafeInstallerErrorLine(result.stderr, env, platform);
        throw new InstallerActionError(detail || `The Forge614 Sentinel installer exited with code ${result.exitCode}.`, result.exitCode);
      }
    } catch (error) {
      if (action === "uninstall") restoreParkedWindowsLauncher(parked);
      throw error;
    } finally {
      if (updateParked) {
        for (const signal of signals) process.off(signal, restoreOnSignal);
        restoreParkedWindowsLauncher(updateParked);
      }
    }
    if (parked && action === "uninstall") {
      try {
        scheduleWindowsLauncherRemoval(parked.parked, options.processId ?? process.pid, env, options.scheduleDelete ?? spawnWindowsLauncherRemoval);
      } catch { /* cleanup is best-effort */ }
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
