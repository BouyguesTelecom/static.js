import {spawn, type ChildProcess} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, readdirSync, readFileSync, realpathSync} from "node:fs";
import {cp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:net";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const libDir = join(repoRoot, "lib");
export const fixturesDir = join(repoRoot, "tests/fixtures");

// Apps are installed outside the repository so that Node module resolution
// cannot fall back on the monorepo node_modules and hide missing dependencies.
export const workDir = process.env.STATICJS_TEST_WORKDIR
    ? resolve(process.env.STATICJS_TEST_WORKDIR)
    : join(realpathSync(tmpdir()), "staticjs-tests");

export const viteVersion = process.env.STATICJS_TEST_VITE_VERSION || "^7.0.0";

export interface RunResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

export interface RunOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
}

/**
 * Environment for child processes. Test runners set NODE_ENV=test (vitest), which would
 * make Vite bundle React in development mode, so it is removed unless explicitly provided.
 */
export function childEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {...process.env};
    delete env.NODE_ENV;
    for (const key of Object.keys(env)) {
        if (key.startsWith("VITEST") || key === "TEST") delete env[key];
    }
    return {...env, ...extra};
}

/** Runs a command and resolves with its exit code and output (never rejects on non-zero exit). */
export function run(command: string, args: string[], {cwd, env, timeout = 300_000}: RunOptions): Promise<RunResult> {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {cwd, env: childEnv(env), detached: true});
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.stderr.on("data", (chunk) => (stderr += chunk));
        const timer = setTimeout(() => {
            killTree(child, "SIGKILL");
            reject(new Error(`Timeout after ${timeout}ms: ${command} ${args.join(" ")}\n${stdout}\n${stderr}`));
        }, timeout);
        child.on("error", reject);
        child.on("close", (code) => {
            clearTimeout(timer);
            resolvePromise({code, stdout, stderr});
        });
    });
}

export async function runOrThrow(command: string, args: string[], options: RunOptions): Promise<RunResult> {
    const result = await run(command, args, options);
    if (result.code !== 0) {
        throw new Error(`Command failed (${result.code}): ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
    }
    return result;
}

function killTree(child: ChildProcess, signal: NodeJS.Signals) {
    if (child.pid === undefined) return;
    try {
        // Negative PID targets the whole process group (npx -> cli -> npx -> tsx -> node).
        process.kill(-child.pid, signal);
    } catch {
        // Process group already gone.
    }
}

/**
 * Builds the library (unless STATICJS_SKIP_LIB_BUILD=1) and packs it with `npm pack`,
 * exactly like `npm publish` would. Returns the absolute path of the tarball.
 */
export async function packLib(): Promise<string> {
    if (process.env.STATICJS_SKIP_LIB_BUILD !== "1") {
        await runOrThrow("npm", ["run", "build"], {cwd: libDir});
    }
    const packDir = join(workDir, "pack");
    await rm(packDir, {recursive: true, force: true});
    await mkdir(packDir, {recursive: true});
    await runOrThrow("npm", ["pack", "--pack-destination", packDir, "--silent"], {cwd: libDir});
    const tarball = readdirSync(packDir).find((file) => file.endsWith(".tgz"));
    if (!tarball) throw new Error(`npm pack produced no tarball in ${packDir}`);
    return join(packDir, tarball);
}

function hashOf(...parts: (string | Buffer)[]): string {
    const hash = createHash("sha256");
    for (const part of parts) hash.update(part);
    return hash.digest("hex");
}

export interface InstallOptions {
    tarball: string;
    /** Name of the directory created under workDir. */
    name: string;
    /** Fixture directory name under tests/fixtures. */
    fixture?: string;
}

/**
 * Copies a fixture app outside the repo and installs the packed StaticJS tarball
 * with npm, as a consumer project would. `npm install` is skipped when the tarball,
 * Vite version and fixture package.json are unchanged since the last install.
 */
export async function installFixtureApp({tarball, name, fixture = "basic-app"}: InstallOptions): Promise<string> {
    const source = join(fixturesDir, fixture);
    const appDir = join(workDir, name);
    const packageJsonTemplate = await readFile(join(source, "package.json"), "utf8");
    const packageJson = packageJsonTemplate
        .replace("__STATICJS__", `file:${tarball}`)
        .replace("__VITE__", viteVersion);
    const installKey = hashOf(readFileSync(tarball), viteVersion, packageJson);
    const keyFile = join(appDir, ".staticjs-install-key");
    const upToDate = existsSync(keyFile) && (await readFile(keyFile, "utf8")) === installKey;

    if (!upToDate) {
        await rm(appDir, {recursive: true, force: true});
    }
    await mkdir(appDir, {recursive: true});

    // Always refresh sources so fixture edits are picked up without reinstalling.
    for (const entry of readdirSync(source)) {
        if (entry === "package.json" || entry === "node_modules") continue;
        await rm(join(appDir, entry), {recursive: true, force: true});
        await cp(join(source, entry), join(appDir, entry), {recursive: true});
    }
    await rm(join(appDir, "_build"), {recursive: true, force: true});
    await writeFile(join(appDir, "package.json"), packageJson);

    if (!upToDate) {
        await rm(join(appDir, "package-lock.json"), {force: true});
        await runOrThrow("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], {cwd: appDir});
        await writeFile(keyFile, installKey);
    }
    return appDir;
}

export interface CloneOptions {
    /** Content of static.config.mjs (exported as default). Omit to keep the fixture config. */
    config?: Record<string, unknown>;
    /** Remove the _build directory from the clone. */
    withoutBuild?: boolean;
    /** Keep _build/cache (it stores absolute paths of the source app, so it is dropped by default). */
    keepCache?: boolean;
}

/**
 * Copies an installed app (node_modules included) so a test can mutate it freely.
 * `_build/cache` is dropped unless `keepCache` is set, because it stores absolute paths of the source app.
 */
export async function cloneApp(sourceDir: string, name: string, {config, withoutBuild, keepCache}: CloneOptions = {}): Promise<string> {
    const target = join(workDir, name);
    await rm(target, {recursive: true, force: true});
    await cp(sourceDir, target, {recursive: true, verbatimSymlinks: true});
    if (!keepCache) await rm(join(target, "_build/cache"), {recursive: true, force: true});
    if (config) await writeStaticConfig(target, config);
    if (withoutBuild) await rm(join(target, "_build"), {recursive: true, force: true});
    return target;
}

export async function writeStaticConfig(appDir: string, config: Record<string, unknown>): Promise<void> {
    await writeFile(join(appDir, "static.config.mjs"), `export default ${JSON.stringify(config, null, 2)};\n`);
}

export function staticBin(appDir: string): string {
    return join(appDir, "node_modules/.bin/static");
}

/** Runs the `static` CLI installed in the app. */
export function runStatic(appDir: string, args: string[], env?: NodeJS.ProcessEnv): Promise<RunResult> {
    return run(staticBin(appDir), args, {cwd: appDir, env});
}

export async function buildApp(appDir: string, env?: NodeJS.ProcessEnv): Promise<RunResult> {
    const result = await runStatic(appDir, ["build"], env);
    if (result.code !== 0) {
        throw new Error(`static build failed in ${appDir}\n${result.stdout}\n${result.stderr}`);
    }
    return result;
}

export function getFreePort(): Promise<number> {
    return new Promise((resolvePromise, reject) => {
        const server = createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            server.close(() => {
                if (address && typeof address === "object") resolvePromise(address.port);
                else reject(new Error("Could not allocate a port"));
            });
        });
    });
}

export async function waitForHttp(url: string, timeoutMs = 60_000, isAlive?: () => boolean): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
        if (isAlive && !isAlive()) throw new Error(`Process exited before ${url} became available`);
        try {
            const response = await fetch(url);
            if (response.status < 500) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

export interface RunningServer {
    url: string;
    port: number;
    logs: () => string;
    stop: () => Promise<void>;
}

export interface StartOptions {
    port?: number;
    env?: NodeJS.ProcessEnv;
    args?: string[];
    /** URL path polled to detect readiness. */
    readyPath?: string;
    timeoutMs?: number;
}

export interface ProcessOptions {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    /** URL polled until it answers with a status < 500. */
    readyUrl: string;
    timeoutMs?: number;
}

/** Spawns a long-running process in its own process group and waits until `readyUrl` answers. */
export async function startProcess(command: string, args: string[], options: ProcessOptions): Promise<Omit<RunningServer, "url" | "port">> {
    const child = spawn(command, args, {cwd: options.cwd, env: childEnv(options.env), detached: true});
    let output = "";
    child.stdout?.on("data", (chunk) => (output += chunk));
    child.stderr?.on("data", (chunk) => (output += chunk));
    let exited = false;
    const exitPromise = new Promise<void>((r) => child.on("exit", () => {
        exited = true;
        r();
    }));

    const stop = async () => {
        killTree(child, "SIGTERM");
        await Promise.race([exitPromise, new Promise((r) => setTimeout(r, 5000))]);
        // CLIs spawn nested processes; make sure none survives in the group.
        killTree(child, "SIGKILL");
    };

    try {
        await waitForHttp(options.readyUrl, options.timeoutMs ?? 60_000, () => !exited);
    } catch (error) {
        await stop();
        throw new Error(`${(error as Error).message}\n--- ${command} output ---\n${output}`);
    }
    return {logs: () => output, stop};
}

/**
 * Starts `static dev` or `static start` and waits until it answers.
 * `static start` forces PORT from its --port option, so the port is passed both ways.
 */
export async function startStatic(appDir: string, mode: "dev" | "start", options: StartOptions = {}): Promise<RunningServer> {
    const port = options.port ?? (await getFreePort());
    const args = [mode, ...(mode === "start" ? ["--port", String(port)] : []), ...(options.args ?? [])];
    const url = `http://127.0.0.1:${port}`;
    const server = await startProcess(staticBin(appDir), args, {
        cwd: appDir,
        env: {PORT: String(port), ...options.env},
        readyUrl: `${url}${options.readyPath ?? "/health"}`,
        timeoutMs: options.timeoutMs,
    });
    return {url, port, ...server};
}
